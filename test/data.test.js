import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createApp } from "../src/app.js";
import { getOverview, hydrateFromMysql } from "../src/modules/data/overview.js";
import { patchAppSource } from "../src/modules/data/patch-app.js";
import {
  DATA_OVERLAY_FILES,
  assertDataOnlyPaths,
  isAllowedDataPath,
  isForbiddenReleasePath
} from "../src/modules/data/release-files.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function withServer(fn) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function get(base, pathname) {
  const res = await fetch(`${base}${pathname}`);
  const text = await res.text();
  return { res, text };
}

test("GET /api/data/overview returns demo cards and five events", async () => {
  await withServer(async (base) => {
    const { res, text } = await get(base, "/api/data/overview");
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    const expected = await getOverview();
    assert.equal(body.ok, true);
    assert.equal(body.demo, true);
    assert.equal(body.notice, "演示数据");
    assert.equal(body.cards.length, 4);
    assert.deepEqual(
      body.cards.map((c) => c.label),
      ["今日订单", "待处理", "在职人数", "本周发布次数"]
    );
    assert.equal(body.events.length, 5);
    assert.deepEqual(body, expected);
  });
});

test("hydrateFromMysql stays exported for live notes-store smoke import", async () => {
  assert.equal(typeof hydrateFromMysql, "function");
  const { hydrateFromMysql: hydrateData } = await import("../src/modules/data/overview.js");
  const result = await hydrateData();
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test("GET /data is the data center page with title, cards, table, and left-shell mount", async () => {
  await withServer(async (base) => {
    const { res, text } = await get(base, "/data");
    assert.equal(res.status, 200);
    assert.match(text, /<h1>数据中心<\/h1>/);
    assert.match(text, /今日订单/);
    assert.match(text, /待处理/);
    assert.match(text, /在职人数/);
    assert.match(text, /本周发布次数/);
    assert.match(text, /演示数据/);
    assert.match(text, /最近数据事件/);
    assert.match(text, /\/api\/data\/overview/);
    assert.match(text, /shared\/layout\.css/);
    assert.match(text, /shared\/nav\.js/);
    assert.match(text, /id="site-nav"/);
    assert.match(text, /<main class="xm-page">/);
    assert.match(text, /class="kpi-grid"/);
    assert.match(text, /data-subnav\.js/);
    assert.match(text, /id="data-subnav"/);
    assert.doesNotMatch(text, /class="site-header"/);
    assert.doesNotMatch(text, /aria-label="全站导航"/);
    assert.doesNotMatch(text, /class="app-shell"/);
  });
});

test("GET /api/data/nav lists the data-center children including 数据总揽", async () => {
  await withServer(async (base) => {
    const { res, text } = await get(base, "/api/data/nav");
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    assert.equal(body.ok, true);
    assert.equal(body.parent.label, "数据中心");
    assert.deepEqual(
      body.children.map((c) => c.label),
      ["店铺实时数据", "店铺数据总揽", "商品数据总揽", "数据总揽"]
    );
    assert.equal(
      body.children.some((c) => /公司/.test(c.label)),
      false
    );
  });
});

test("data child pages and demo APIs respond", async () => {
  await withServer(async (base) => {
    const pages = [
      ["/data/stores/live", "店铺实时数据", "/api/data/stores/live"],
      ["/data/stores/overview", "店铺数据总揽", "/api/data/stores/overview"],
      ["/data/goods/overview", "商品数据总揽", "/api/data/goods/overview"]
    ];
    for (const [pagePath, title, apiPath] of pages) {
      const page = await get(base, pagePath);
      assert.equal(page.res.status, 200, pagePath);
      assert.match(page.text, new RegExp(`<h1>${title}</h1>`));
      assert.match(page.text, /id="data-subnav"/);
      const api = await get(base, apiPath);
      assert.equal(api.res.status, 200, apiPath);
      const body = JSON.parse(api.text);
      assert.equal(body.ok, true);
      assert.equal(body.demo, true);
      assert.ok(body.cards.length > 0);
      assert.ok(body.rows.length > 0);
    }
    const subnav = await get(base, "/data-subnav.js");
    assert.equal(subnav.res.status, 200);
    assert.match(subnav.text, /店铺实时数据/);
    assert.match(subnav.text, /店铺数据总揽/);
    assert.match(subnav.text, /商品数据总揽/);
    assert.match(subnav.text, /数据总揽/);
    assert.doesNotMatch(subnav.text, /公司/);
    const overviewPage = await get(base, "/data/overview");
    assert.equal(overviewPage.res.status, 200);
    assert.match(overviewPage.text, /<h1>数据总揽<\/h1>/);
    assert.match(overviewPage.text, /data-view="team"/);
    assert.doesNotMatch(overviewPage.text, /公司/);
    const teamApi = await get(base, "/api/data/team");
    assert.equal(teamApi.res.status, 200);
    const team = JSON.parse(teamApi.text);
    assert.equal(team.ok, true);
    assert.equal(team.scope, "团队");
    assert.equal(team.cards.length, 17);
    assert.equal(team.liveIndex.group, "按店铺");
    assert.match(JSON.stringify(team), /RASW家居旗舰店/);
    assert.match(JSON.stringify(team), /AILUKI居家布艺旗舰店/);
    assert.doesNotMatch(JSON.stringify(team), /公司/);
    const demoFile = await get(base, "/data/team-demo.json");
    assert.equal(demoFile.res.status, 200);
    const demo = JSON.parse(demoFile.text);
    assert.equal(demo.cards.length, 17);
  });
});

test("patchAppSource only inserts the data API mount", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ dataRouter \} from "\.\/modules\/data\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/data", dataRouter\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});

test("patchAppSource keeps notes routes and attachHome from live mengkai app.js", () => {
  const original = `import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addNote, listNotes } from "./notes-store.js";
import { attachHome } from "./modules/home/attach.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/notes", (_req, res) => {
    res.json(listNotes());
  });

  app.post("/api/notes", (req, res) => {
    try {
      const note = addNote(req.body?.text);
      res.status(201).json(note);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.use(express.static(join(__dirname, "..", "public")));

  attachHome(app);
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ dataRouter \} from "\.\/modules\/data\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/data", dataRouter\);/);
  assert.match(patched, /app\.get\("\/api\/notes"/);
  assert.match(patched, /app\.post\("\/api\/notes"/);
  assert.match(patched, /attachHome\(app\);/);
  assert.match(patched, /import \{ attachHome \} from "\.\/modules\/home\/attach\.js";/);
  assert.equal(patchAppSource(patched), patched);
});

test("apply script never restarts production", () => {
  const source = fs.readFileSync(path.join(repoRoot, "scripts/apply-data-to-mengkai.mjs"), "utf8");
  assert.doesNotMatch(source, /systemctl\s+restart/);
  assert.doesNotMatch(source, /spawnSync/);
  assert.doesNotMatch(source, /docker compose/);
});

test("GitHub overlay workflow only SSHs data files and never restarts", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, ".github/workflows/apply-data-overlay.yml"),
    "utf8"
  );
  assert.match(source, /workflow_dispatch/);
  assert.match(source, /pull_request:/);
  assert.match(source, /cursor\/data-center-dashboard-c02b/);
  assert.match(source, /ssh-apply-data-to-mengkai\.mjs/);
  assert.match(source, /ALIYUN_SSH_PRIVATE_KEY is not set in GitHub secrets; skipping ECS overlay/);
  assert.match(source, /MENGKAI_DIR: \/opt\/mengkai/);
  assert.doesNotMatch(source, /systemctl/);
  assert.doesNotMatch(source, /docker compose/);
  assert.doesNotMatch(source, /\/opt\/yunyingbu/);
  assert.doesNotMatch(source, /^on:\s*\n\s*push:/m);
});

test("apply script refuses when mengkai tree is missing", async () => {
  const missing = path.join(os.tmpdir(), `no-mengkai-${Date.now()}`);
  const child = spawn(process.execPath, [path.join(repoRoot, "scripts/apply-data-to-mengkai.mjs")], {
    env: { ...process.env, MENGKAI_DIR: missing }
  });
  const [code, stderr] = await Promise.all([
    new Promise((resolve) => child.on("close", resolve)),
    new Promise((resolve) => {
      const chunks = [];
      child.stderr.on("data", (c) => chunks.push(c));
      child.stderr.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    })
  ]);
  assert.equal(code, 1);
  assert.match(stderr, /MENGKAI_DIR not found/);
});

test("ssh apply script refuses without a key and never restarts", async () => {
  const source = fs.readFileSync(path.join(repoRoot, "scripts/ssh-apply-data-to-mengkai.mjs"), "utf8");
  assert.doesNotMatch(source, /systemctl\s+restart/);
  assert.doesNotMatch(source, /docker compose/);
  assert.match(source, /Append this public key to \/root\/\.ssh\/authorized_keys/);
  const child = spawn(process.execPath, [path.join(repoRoot, "scripts/ssh-apply-data-to-mengkai.mjs")], {
    env: {
      ...process.env,
      ALIYUN_SSH_PRIVATE_KEY: "",
      ALIYUN_SSH_KEY_FILE: path.join(os.tmpdir(), "no-such-yunyingbu-key")
    }
  });
  const [code, stderr] = await Promise.all([
    new Promise((resolve) => child.on("close", resolve)),
    new Promise((resolve) => {
      const chunks = [];
      child.stderr.on("data", (c) => chunks.push(c));
      child.stderr.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    })
  ]);
  assert.equal(code, 2);
  assert.match(stderr, /ALIYUN_SSH_PRIVATE_KEY/);
});

test("apply script stages overlay onto a mengkai tree without touching other modules", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mengkai-data-"));
  const notes = `import express from "express";

export function createApp() {
  const app = express();
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/notes", (_req, res) => res.json([]));
  return app;
}
`;
  fs.mkdirSync(path.join(tmp, "src"));
  fs.mkdirSync(path.join(tmp, "public"));
  fs.writeFileSync(path.join(tmp, "src/app.js"), notes);
  fs.writeFileSync(path.join(tmp, "public/index.html"), "<html><body>home</body></html>");

  const child = spawn(process.execPath, [path.join(repoRoot, "scripts/apply-data-to-mengkai.mjs")], {
    env: { ...process.env, MENGKAI_DIR: tmp }
  });
  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 0);

  const appJs = fs.readFileSync(path.join(tmp, "src/app.js"), "utf8");
  assert.match(appJs, /app\.use\("\/api\/data", dataRouter\);/);
  assert.match(appJs, /app\.get\("\/api\/notes"/);
  assert.match(appJs, /app\.get\("\/api\/health"/);
  assert.ok(fs.existsSync(path.join(tmp, "public/data.html")));
  assert.ok(fs.existsSync(path.join(tmp, "public/data/placeholder/index.html")));
  assert.ok(fs.existsSync(path.join(tmp, "public/data/overview/index.html")));
  assert.ok(fs.existsSync(path.join(tmp, "src/modules/data/router.js")));
  assert.match(fs.readFileSync(path.join(tmp, "src/app.js"), "utf8"), /app\.get\("\/api\/health"/);
  assert.equal(fs.readFileSync(path.join(tmp, "public/index.html"), "utf8"), "<html><body>home</body></html>");
  assert.equal(fs.existsSync(path.join(tmp, "src/modules/home")), false);
  assert.equal(fs.existsSync(path.join(tmp, "src/modules/people")), false);
});

test("release allowlist never includes the live site entrypoint", () => {
  assert.equal(DATA_OVERLAY_FILES.includes("src/app.js"), false);
  assert.equal(isForbiddenReleasePath("src/app.js"), true);
  assert.equal(isAllowedDataPath("src/app.js"), false);
  assert.equal(isAllowedDataPath("public/shared/nav.js"), false);
  assert.equal(isAllowedDataPath("src/modules/data/overview.js"), true);
  assert.equal(isAllowedDataPath("public/data/placeholder/index.html"), true);
  assert.equal(isAllowedDataPath("public/data/overview/index.html"), true);
  assert.equal(isAllowedDataPath("public/data-overview.js"), true);
  assert.equal(isAllowedDataPath("public/data/team-demo.json"), true);
  const demo = JSON.parse(fs.readFileSync(path.join(repoRoot, "public/data/team-demo.json"), "utf8"));
  assert.equal(demo.cards.length, 17);
  assert.equal(demo.scope, "团队");
  assert.throws(() => assertDataOnlyPaths(["src/app.js"]), /src\/app\.js/);
  const apply = fs.readFileSync(path.join(repoRoot, "scripts/apply-data-to-mengkai.mjs"), "utf8");
  assert.match(apply, /DATA_OVERLAY_FILES/);
  assert.doesNotMatch(apply, /copyFile\("src\/app\.js"/);
});

test("submit-data-release posts version applicant module summary", async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/releases") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        received.push(body);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, item: { id: "rel-1", status: "queued", ...body } }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const child = spawn(process.execPath, [path.join(repoRoot, "scripts/submit-data-release.mjs")], {
      env: {
        ...process.env,
        RELEASES_API: `http://127.0.0.1:${port}/api/releases`,
        RELEASE_VERSION: "0.1.0-data",
        RELEASE_APPLICANT: "数据中心"
      }
    });
    const [code] = await Promise.all([
      new Promise((resolve) => child.on("close", resolve))
    ]);
    assert.equal(code, 0);
    assert.equal(received.length, 1);
    assert.equal(received[0].applicant, "数据中心");
    assert.equal(received[0].module, "数据中心");
    assert.equal(received[0].version, "0.1.0-data");
    assert.ok(received[0].summary);
    assert.ok(Array.isArray(received[0].files));
    assert.equal(received[0].files.includes("src/app.js"), false);
    assert.equal(Object.keys(received[0].contents || {}).includes("src/app.js"), false);
    for (const rel of received[0].files) {
      assert.ok(isAllowedDataPath(rel), rel);
    }
    const refuse = spawn(process.execPath, [path.join(repoRoot, "scripts/submit-data-release.mjs")], {
      env: {
        ...process.env,
        RELEASES_API: `http://127.0.0.1:${port}/api/releases`,
        RELEASE_FILES: "src/app.js"
      }
    });
    const refuseCode = await new Promise((resolve) => refuse.on("close", resolve));
    assert.notEqual(refuseCode, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
