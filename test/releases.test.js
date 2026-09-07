import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { parseMainBrainOrder } from "../src/modules/releases/document.js";
import { filesNeedProcessRestart, ticketNeedsProcessRestart } from "../src/modules/releases/restart.js";
import {
  allocateReleaseVersion,
  findVersionClash,
  resolveReleaseVersion,
  VERSION_GATE_ERROR
} from "../src/modules/releases/version.js";
import { formatExecError, hasApplyReceipt, pushXingmaiToEcs, restoreSnapshot, sourceRoot } from "../src/modules/releases/push.js";
import {
  fetchGithubFile,
  githubPathCandidates,
  normalizeContents,
  parseGitRef,
  shouldRejectUnchangedAtCreate
} from "../src/modules/releases/stage.js";
import { NOOP_APPLY_ERROR } from "../src/modules/releases/charter.js";
import { DEMO_INITIAL_PASSWORD, DEMO_USERNAME } from "../src/modules/profile/auth.js";

const signedInUser = { username: "罗成" };
let activeCookie = "";

function signedIn(extra = {}) {
  return {
    restart() {},
    async push() {
      return { stdout: "test-push" };
    },
    getUser: () => signedInUser,
    ...extra
  };
}

async function withServer(options, fn) {
  if (typeof options === "function") {
    fn = options;
    options = signedIn();
  } else {
    options = signedIn(options);
  }
  if (!options.stateDir) {
    options = { ...options, stateDir: fs.mkdtempSync(path.join(os.tmpdir(), "rel-state-")) };
  }
  const server = http.createServer(createApp(options));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    activeCookie = options.unauthenticated ? "" : await loginCookie(base);
    await fn(base);
  } finally {
    activeCookie = "";
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function loginCookie(base) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD })
  });
  return (res.headers.getSetCookie?.() || []).map((part) => part.split(";")[0]).join("; ");
}

async function json(base, pathname, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.cookie) {
    headers.Cookie = options.cookie;
  } else if (activeCookie) {
    headers.Cookie = activeCookie;
  }
  const res = await fetch(`${base}${pathname}`, {
    method: options.method || "GET",
    headers,
    body: options.body
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

function apply(slug, applicant, module, summary, extra = {}) {
  const body = {
    slug,
    applicant,
    module,
    summary,
    files: extra.files || ["src/app.js"],
    acceptance: extra.acceptance || "自动化验收",
    restart: extra.restart ?? false
  };
  if (extra.contents) {
    body.contents = extra.contents;
  }
  if (extra.ref) {
    body.ref = extra.ref;
  }
  if (extra.version !== undefined) {
    body.version = extra.version;
  } else if (extra.auto === false) {
    body.version = slug;
  } else {
    body.version = "auto";
  }
  return JSON.stringify(body);
}

function publishBody(order = "按这份文档发版") {
  return JSON.stringify({ order });
}


test("GET /releases is the release center page", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/releases`, { headers: { Cookie: activeCookie } });
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(text, /版本发布中心/);
    assert.match(text, /RELEASE GATE/);
    assert.doesNotMatch(text, /运营中心/);
    assert.doesNotMatch(text, /OPERATING CENTER/);
    assert.match(text, /自动提示/);
    assert.match(text, /不会自动通过/);
    assert.match(text, /watchIncoming/);
    assert.match(text, /提交时间/);
    assert.match(text, /不重启进程/);
    assert.match(text, /统一发放/);
    assert.match(text, /0\.1\.N/);
    assert.match(text, /闸门下一号/);
    assert.match(text, /function setText/);
    assert.match(text, /if \(!el\)/);
    assert.doesNotMatch(text, /data-act="up"/);
    assert.doesNotMatch(text, />上移</);
    assert.doesNotMatch(text, />下移</);
    assert.doesNotMatch(text, /稳定顺序/);
    assert.match(text, /id="refresh-btn"/);
    assert.match(text, /唯一发版闸门/);
    assert.match(text, /只允许「通过」第 1 位/);
    assert.match(text, /id="upgrade-mask"/);
    assert.match(text, /正在升级，请勿关闭/);
    assert.match(text, /\/api\/health/);
    assert.match(text, /location\.replace\("\/releases\?reloaded="/);
    assert.match(text, /oc-after-upgrade/);
    assert.match(text, /正在刷新界面/);
    assert.match(text, /consumePendingUpgrade/);
    assert.match(text, /bootReleases/);
    assert.match(text, /passResult === "reloading"/);
    assert.match(text, /本机落地/);
    assert.match(text, /href="\/releases.css(?:\?[^"]*)?"/);
    assert.doesNotMatch(text, /href="\/shared\/layout.css"/);
    assert.doesNotMatch(text, /src="\/shared\/nav.js"/);
    assert.match(text, /data-tab="queue"/);
    assert.match(text, /data-tab="history"/);
    assert.match(text, /从最新到最老/);
    assert.match(text, /只记每次升级的简要内容/);
    assert.match(text, /<th>摘要<\/th>/);
    assert.match(text, /item\.summary/);
    assert.doesNotMatch(text, /<th>日志<\/th>/);
    assert.match(text, /newestFirst/);
    assert.match(text, /PAGE_SIZE = 20/);
    assert.match(text, /function paginate/);
    assert.match(text, /function renderPager/);
    assert.match(text, /上一页/);
    assert.match(text, /下一页/);
    assert.match(text, /都分页/);
    assert.match(text, /不要先拷到线上/);
    assert.match(text, /点通过才落地/);
    assert.match(text, /新文件只放源目录/);
    assert.match(text, /不读 git/);
    assert.match(text, /contents/);
    assert.match(text, /item\.gitRef/);
    assert.match(text, /Number\(seq\) === 1/);
    assert.doesNotMatch(text, /const isHead = index === 0/);
    assert.match(text, /data-tab="logs"/);
    assert.match(text, /\/api\/releases\/versions/);
    assert.match(text, /待上线是空的，没有等待通过的单据/);
    assert.match(text, /\/api\/releases\/.*rollback/);
    assert.match(text, /回滚到升级前/);
    assert.doesNotMatch(text, /data-tab="feed"/);
    assert.doesNotMatch(text, /data-tab="worker"/);
    assert.doesNotMatch(text, /\/api\/releases\/candidates/);
    assert.doesNotMatch(text, /theme-light/);
    assert.doesNotMatch(text, /文件投喂/);
    assert.doesNotMatch(text, /GitHub 制品/);
    assert.doesNotMatch(text, /<nav class="site-nav"/);
    assert.match(text, /本机落地/);
    assert.match(text, /window\.location\.replace\("\/login"\)/);
    assert.doesNotMatch(text, /id="login-form"/);
    assert.doesNotMatch(text, /id="apply-form"/);
    assert.doesNotMatch(text, /提交发布申请/);
    assert.doesNotMatch(text, /星脉管理系统/);
  });
});

test("releases.html has no login form and sends users to /login", () => {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/releases.html"), "utf8");
  assert.doesNotMatch(html, /id="login-form"/);
  assert.doesNotMatch(html, /<input[^>]*type="password"/);
  assert.match(html, /\/releases.css/);
  assert.doesNotMatch(html, /\/shared\/layout.css/);
  assert.doesNotMatch(html, /\/shared\/nav.js/);
  assert.doesNotMatch(html, /id="apply-form"/);
  assert.doesNotMatch(html, /提交发布申请/);
  assert.match(html, /id="refresh-btn"/);
  assert.match(html, /id="upgrade-mask"/);
  assert.match(html, /location\.replace\("\/releases\?reloaded="/);
  assert.match(html, /oc-after-upgrade/);
  assert.match(html, /正在刷新界面/);
  assert.match(html, /consumePendingUpgrade/);
  assert.match(html, /不会自动通过/);
  assert.match(html, /提交时间/);
  assert.doesNotMatch(html, /data-act="up"/);
  assert.doesNotMatch(html, />上移</);
  assert.doesNotMatch(html, />下移</);
  assert.doesNotMatch(html, /enableDragReorder/);
  assert.match(html, /自动提示/);
  assert.match(html, /watchIncoming/);
  assert.doesNotMatch(html, /setInterval\(function \(\) \{\s*refresh/);
  assert.doesNotMatch(html, /运营中心/);
  assert.match(html, /唯一发版闸门/);
  assert.match(html, /只允许「通过」第 1 位/);
  assert.match(html, /帮我上线/);
  assert.doesNotMatch(html, /shared\/layout\.css/);
  assert.match(html, /\/api\/releases\/.*confirm/);
});

test("login page does not use the operating-center shell", () => {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/login.html"), "utf8");
  assert.doesNotMatch(html, /releases.css/);
  assert.doesNotMatch(html, /oc-top/);
  assert.doesNotMatch(html, /OPERATING CENTER/);
});

test("agent docs say no video unless the UI change is large", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const noVideo = /不做大的界面改动，不用视频测试验证/;
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), noVideo);
  assert.match(fs.readFileSync(path.join(root, "docs/agents/06-releases.md"), "utf8"), noVideo);
  assert.match(fs.readFileSync(path.join(root, "docs/agents/00-release-rules.md"), "utf8"), noVideo);
});

test("GET /releases.css is page-only stylesheet", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/releases.css`, { headers: { Cookie: activeCookie } });
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(text, /\.oc-top/);
    assert.match(text, /\.oc-tab\.active/);
    assert.match(text, /html:has\(\.oc-wrap\)/);
    assert.match(text, /overflow: auto !important/);
    assert.match(text, /\.oc-pager/);
    assert.match(text, /overscroll-behavior: contain/);
    assert.match(text, /--oc-bg:\s*var\(--xm-bg,\s*#f7f7f4\)/);
    assert.match(text, /--oc-text:\s*var\(--xm-ink,\s*#14120b\)/);
    assert.match(text, /\.xm-content button\.oc-tab/);
  });
});

test("unauthenticated page redirects to /login", async () => {
  await withServer({ unauthenticated: true, getUser: () => null }, async (base) => {
    for (const pathname of ["/releases", "/releases.html"]) {
      const res = await fetch(`${base}${pathname}`, { redirect: "manual" });
      assert.equal(res.status, 302, pathname);
      assert.equal(res.headers.get("location"), "/login", pathname);
    }
  });
});

test("unauthenticated APIs return 401 JSON", async () => {
  await withServer({ unauthenticated: true, getUser: () => null }, async (base) => {
    const calls = [
      ["GET", "/api/releases"],
      ["GET", "/api/releases/queue"],
      ["GET", "/api/releases/lock"],
      ["POST", "/api/releases"],
      ["POST", "/api/releases/go"],
      ["POST", "/api/releases/reorder"]
    ];
    for (const [method, pathname] of calls) {
      const { res, body } = await json(base, pathname, {
        method,
        body:
          method === "POST"
            ? pathname.endsWith("/go")
              ? JSON.stringify({ order: "发版" })
              : pathname.endsWith("/reorder")
                ? JSON.stringify({ ids: [] })
                : apply("1.0.0", "Eve", "首页", "no session")
            : undefined
      });
      assert.equal(res.status, 401, pathname);
      assert.equal(body.error, "未登录");
    }
  });
});

test("queue and lock expose charter: gate is not a second 主脑", async () => {
  await withServer(async (base) => {
    const queue = await json(base, "/api/releases/queue");
    assert.equal(queue.body.charter.dispatcher, "罗成");
    assert.equal(queue.body.charter.dispatcherRole, "运营部主脑");
    assert.equal(queue.body.charter.gateRole, "唯一发版闸门");
    assert.equal(queue.body.charter.secondBrain, false);
    assert.equal(queue.body.charter.queue.includes("点一单发一单"), true);
    assert.match(queue.body.charter.queue, /不重启进程/);
    assert.match(queue.body.charter.version, /统一发放|闸门发放/);
    const lock = await json(base, "/api/releases/lock");
    assert.equal(lock.body.charter.gate, "版本发布中心");
    assert.match(lock.body.charter.queue, /第 1 位/);
  });
});

test("invalid or duplicate version is rejected", async () => {
  await withServer(async (base) => {
    const bad = await json(base, "/api/releases", {
      method: "POST",
      body: apply("../etc", "Eve", "首页", "坏版本号", { auto: false })
    });
    assert.equal(bad.res.status, 400);
    assert.match(bad.body.error, /版本号/);

    const space = await json(base, "/api/releases", {
      method: "POST",
      body: apply("1.0 bad", "Eve", "首页", "空格", { auto: false })
    });
    assert.equal(space.res.status, 400);

    const homemade = await json(base, "/api/releases", {
      method: "POST",
      body: apply("ui-cursor-light-3", "Eve", "首页", "自领号", { auto: false })
    });
    assert.equal(homemade.res.status, 409);
    assert.match(homemade.body.error, /统一发放/);

    const first = await json(base, "/api/releases", {
      method: "POST",
      body: apply("gate", "Eve", "首页", "合法")
    });
    assert.equal(first.res.status, 201);
    assert.match(first.body.item.version, /^0\.1\.1-gate$/);
    const otherModule = await json(base, "/api/releases", {
      method: "POST",
      body: apply("same-n", "Eve", "版本发布中心", "跨模块抢同一号段", {
        version: "0.1.1-other"
      })
    });
    assert.equal(otherModule.res.status, 409);
    assert.match(otherModule.body.error, /0\.1\.1/);
    const next = await json(base, "/api/releases/next?slug=sider");
    assert.equal(next.res.status, 200);
    assert.equal(next.body.seq, 2);
    assert.equal(next.body.version, "0.1.2-sider");

    const badPath = await json(base, "/api/releases", {
      method: "POST",
      body: apply("path", "Eve", "首页", "坏路径", { files: ["deploy/secret.sh"] })
    });
    assert.equal(badPath.res.status, 400);
    assert.match(badPath.body.error, /拒绝推送路径/);

    const testFile = await json(base, "/api/releases", {
      method: "POST",
      body: apply("testfile", "Eve", "版本发布中心", "测试文件可交单", {
        files: ["test/releases.test.js"]
      })
    });
    assert.equal(testFile.res.status, 201);
    assert.deepEqual(testFile.body.item.files, ["test/releases.test.js"]);
    assert.match(testFile.body.item.version, /^0\.1\.2-testfile$/);
  });
});

test("queue is submit-time FIFO even when later tickets are foundations", async () => {
  await withServer(async (base) => {
    const gate = await json(base, "/api/releases", {
      method: "POST",
      body: apply("q-gate", "Gate", "版本发布中心", "先交的页面", {
        files: ["public/releases.html"],
        restart: false
      })
    });
    const data = await json(base, "/api/releases", {
      method: "POST",
      body: apply("q-data", "Data", "数据中心", "业务", {
        files: ["public/data.html"],
        restart: true
      })
    });
    const auth = await json(base, "/api/releases", {
      method: "POST",
      body: apply("q-auth", "Auth", "个人中心", "后到的登录", {
        files: ["src/modules/profile/auth.js"],
        restart: true
      })
    });
    const shell = await json(base, "/api/releases", {
      method: "POST",
      body: apply("q-shell", "Home", "首页", "后到的共享壳", {
        files: ["public/shared/nav.js"],
        restart: true
      })
    });
    assert.equal(gate.res.status, 201);
    assert.equal(data.res.status, 201);
    assert.equal(auth.res.status, 201);
    assert.equal(shell.res.status, 201);
    const queue = await json(base, "/api/releases/queue");
    const real = queue.body.items.filter((item) => !item.demo).map((item) => item.id);
    assert.deepEqual(real, [gate.body.item.id, data.body.item.id, auth.body.item.id, shell.body.item.id]);
    assert.match(gate.body.item.version, /^0\.1\.1-q-gate$/);
    assert.match(shell.body.item.version, /^0\.1\.4-q-shell$/);
    assert.match(auth.body.item.log, /提交时间/);
    assert.match(auth.body.item.log, /禁止上移下移/);
  });
});

test("queued tickets stay FIFO by submittedAt", async () => {
  let n = 0;
  await withServer(
    {
      restart() {},
      now() {
        n += 1;
        return `2026-09-04T00:00:0${n}.000Z`;
      }
    },
    async (base) => {
      const a = await json(base, "/api/releases", {
        method: "POST",
        body: apply("1.0.1", "Alice", "首页", "a")
      });
      const b = await json(base, "/api/releases", {
        method: "POST",
        body: apply("1.0.2", "Bob", "数据中心", "b")
      });
      const c = await json(base, "/api/releases", {
        method: "POST",
        body: apply("1.0.3", "Cara", "韩梦凯", "c")
      });
      assert.equal(a.res.status, 201);
      assert.equal(a.body.item.status, "queued");
      const queue = await json(base, "/api/releases/queue");
      const versions = queue.body.items.filter((item) => !item.demo).map((item) => item.version);
      assert.deepEqual(versions, [a.body.item.version, b.body.item.version, c.body.item.version]);
      assert.match(a.body.item.version, /^0\.1\.1-/);
      assert.match(c.body.item.version, /^0\.1\.3-/);
      assert.deepEqual(
        queue.body.items.filter((item) => !item.demo).map((item) => item.queueIndex),
        [1, 2, 3]
      );
      assert.equal(b.body.item.id !== c.body.item.id, true);
    }
  );
});

test("主脑口令 aliases", () => {
  assert.equal(parseMainBrainOrder("发版").kind, "bare");
  assert.equal(parseMainBrainOrder("发板").kind, "bare");
  assert.equal(parseMainBrainOrder("按这份文档发板").kind, "document");
  assert.equal(parseMainBrainOrder("发布 首页").module, "首页");
  assert.equal(parseMainBrainOrder("发版首页").module, "首页");
  assert.equal(parseMainBrainOrder("帮我上线").ok, false);
  assert.match(parseMainBrainOrder("帮我上线").error, /帮我上线/);
  assert.equal(parseMainBrainOrder("帮我上线，发版 首页").ok, false);
  assert.match(parseMainBrainOrder("帮我上线，发版 首页").error, /无效/);
});

test("queued publish without 通过 is 409 未通过禁止发", async () => {
  let restarts = 0;
  const pushed = [];
  await withServer(
    {
      async push(files) {
        pushed.push(files);
        return { stdout: "test-push" };
      },
      restart() {
        restarts += 1;
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("2.0.0", "Eve", "人员管理", "未审核")
      });
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ order: "发板" })
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /未通过禁止发/);
      assert.equal(pushed.length, 0);
      assert.equal(restarts, 0);
      const lock = await json(base, "/api/releases/lock");
      assert.equal(lock.body.locked, false);
    }
  );
});

test("rejected ticket cannot be published", async () => {
  let restarts = 0;
  await withServer(
    {
      restart() {
        restarts += 1;
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("2.0.1", "Eve", "人员管理", "将被驳回")
      });
      const rejected = await json(base, `/api/releases/${created.body.item.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "摘要不合格" })
      });
      assert.equal(rejected.res.status, 200);
      assert.equal(rejected.body.item.status, "rejected");
      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /驳回/);
      assert.equal(restarts, 0);
    }
  );
});

test("通过 one ticket restarts once and does not auto-publish next", async () => {
  let restarts = 0;
  await withServer(
    {
      restart() {
        restarts += 1;
      }
    },
    async (base) => {
      const first = await json(base, "/api/releases", {
        method: "POST",
        body: apply("3.0.0", "Ada", "版本发布中心", "本模块", { restart: true })
      });
      const second = await json(base, "/api/releases", {
        method: "POST",
        body: apply("3.0.1", "Ada", "版本发布中心", "下一条", { restart: true })
      });
      const skipped = await json(base, `/api/releases/${second.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(skipped.res.status, 409);
      assert.match(skipped.body.error, /第 1 位|提交时间|跳单/);
      const pub = await json(base, `/api/releases/${first.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200);
      assert.equal(pub.body.item.status, "success");
      assert.equal(restarts, 1);
      assert.match(pub.body.item.log, /已 systemctl restart mengkai|成功状态已先落盘/);
      const all = await json(base, "/api/releases");
      const a = all.body.items.find((item) => item.id === first.body.item.id);
      const b = all.body.items.find((item) => item.id === second.body.item.id);
      assert.equal(a.status, "success");
      assert.equal(b.status, "queued");
      const lock = await json(base, "/api/releases/lock");
      assert.equal(lock.body.locked, false);
    }
  );
});

test("gate allocates a global 0.1.N and blocks the same series across modules", () => {
  assert.equal(allocateReleaseVersion([], "Sider Always"), "0.1.1-sider-always");
  const held = [{ id: "rel-1", version: "0.1.19-skip-restart", module: "版本发布中心", status: "success" }];
  assert.equal(allocateReleaseVersion(held, "shell-perf"), "0.1.20-shell-perf");
  assert.equal(findVersionClash(held, "0.1.19-shell-perf")?.id, "rel-1");
  assert.equal(findVersionClash(held, "0.1.20-shell-perf"), undefined);
  const failed = [{ id: "rel-2", version: "0.1.18-sider-always", module: "首页", status: "failed" }];
  assert.equal(allocateReleaseVersion(failed, "sider"), "0.1.1-sider");
  const homemade = resolveReleaseVersion([], "ui-cursor-light-3", "x");
  assert.equal(homemade.ok, false);
  assert.equal(homemade.error, VERSION_GATE_ERROR);
});

test("filesNeedProcessRestart is false for public and test files", () => {
  assert.equal(filesNeedProcessRestart(["public/releases.html", "test/releases.test.js"]), false);
  assert.equal(filesNeedProcessRestart(["public/releases.css"]), false);
  assert.equal(filesNeedProcessRestart(["src/modules/releases/router.js"]), true);
  assert.equal(filesNeedProcessRestart(["public/releases.html", "src/server.js"]), true);
  assert.equal(filesNeedProcessRestart(["package.json"]), true);
  assert.equal(filesNeedProcessRestart([]), true);
  assert.equal(ticketNeedsProcessRestart({ restart: true, files: ["public/releases.html"] }), false);
  assert.equal(ticketNeedsProcessRestart({ restart: true, files: ["src/app.js"] }), true);
  assert.equal(ticketNeedsProcessRestart({ restart: false, files: ["src/app.js"] }), false);
});

test("通过 a page-only ticket does not restart the live process", async () => {
  let restarts = 0;
  await withServer(
    {
      restart() {
        restarts += 1;
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("0.1.19-static", "Ada", "版本发布中心", "只改页面", {
          files: ["public/releases.html"],
          restart: true
        })
      });
      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200);
      assert.equal(pub.body.item.status, "success");
      assert.equal(restarts, 0);
      assert.match(pub.body.item.log, /跳过重启/);
    }
  );
});

test("通过 writes success to disk before restart", async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-before-restart-"));
  let persisted = null;
  let createdId = "";
  await withServer(
    {
      stateDir,
      restart() {
        const saved = JSON.parse(fs.readFileSync(path.join(stateDir, "tickets.json"), "utf8"));
        persisted = saved.items.find((item) => item.id === createdId) || null;
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("persist", "Ada", "版本发布中心", "先落盘再重启", { restart: true })
      });
      createdId = created.body.item.id;
      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200);
      assert.ok(persisted);
      assert.equal(persisted.status, "success");
      assert.match(persisted.log, /成功状态已先落盘/);
      assert.ok(persisted.snapshotDir);
    }
  );
});

test("second publish while lock held returns 409 禁止抢发", async () => {
  let releaseHold;
  const hold = new Promise((resolve) => {
    releaseHold = resolve;
  });
  let started = 0;
  await withServer(
    {
      async push() {
        started += 1;
        await hold;
        return { stdout: "test-push" };
      }
    },
    async (base) => {
      const first = await json(base, "/api/releases", {
        method: "POST",
        body: apply("4.0.0", "Lin", "首页", "持锁", { restart: true })
      });
      const second = await json(base, "/api/releases", {
        method: "POST",
        body: apply("4.0.1", "Lin", "首页", "抢发", { restart: true })
      });

      const firstPublish = json(base, `/api/releases/${first.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      for (let i = 0; i < 50; i += 1) {
        const lock = await json(base, "/api/releases/lock");
        if (lock.body.locked) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const lock = await json(base, "/api/releases/lock");
      assert.equal(lock.body.locked, true);
      assert.equal(lock.body.current.version, first.body.item.version);

      const stolen = await json(base, `/api/releases/${second.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(stolen.res.status, 409);
      assert.equal(stolen.body.error, "有发布正在进行，禁止抢发");

      const again = await json(base, `/api/releases/${first.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(again.res.status, 409);
      assert.match(again.body.error, /禁止抢发/);

      releaseHold();
      const done = await firstPublish;
      assert.equal(done.body.item.status, "success");
      assert.equal(started, 1);
      const later = await json(base, "/api/releases");
      assert.equal(later.body.items.find((item) => item.id === second.body.item.id).status, "queued");
    }
  );
});

test("queued cannot jump to success; reject requires reason", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/releases", {
      method: "POST",
      body: apply("5.0.0", "Zoe", "其他", "状态机")
    });
    const badReject = await json(base, `/api/releases/${created.body.item.id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: "  " })
    });
    assert.equal(badReject.res.status, 400);
    const still = await json(base, "/api/releases");
    const item = still.body.items.find((row) => row.id === created.body.item.id);
    assert.equal(item.status, "queued");
  });
});

test("incomplete document still queues for ledger", async () => {
  await withServer(async (base) => {
    const { res, body } = await json(base, "/api/releases", {
      method: "POST",
      body: JSON.stringify({ version: "auto", slug: "nodoc", applicant: "X", module: "首页", summary: "无文件" })
    });
    assert.equal(res.status, 201);
    assert.equal(body.item.status, "queued");
    assert.match(body.item.version, /^0\.1\.1-nodoc$/);
    const queue = await json(base, "/api/releases/queue");
    assert.equal(queue.body.items.some((item) => item.version === body.item.version), true);
  });
});

test("document without 口令 stays queued and does not push", async () => {
  let pushes = 0;
  let restarts = 0;
  await withServer(
    {
      async push() {
        pushes += 1;
      },
      restart() {
        restarts += 1;
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("6.0.0", "Doc", "首页", "仅文档")
      });
      assert.equal(created.body.item.status, "queued");
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: JSON.stringify({})
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /未通过禁止发/);
      assert.equal(pushes, 0);
      assert.equal(restarts, 0);
      const all = await json(base, "/api/releases");
      assert.equal(all.body.items.find((item) => item.id === created.body.item.id).status, "queued");
    }
  );
});

test("口令 发布模块 且 restart=false 只 push 不重启", async () => {
  const pushed = [];
  let restarts = 0;
  await withServer(
    {
      async push(files) {
        pushed.push(files);
        return { stdout: "ok" };
      },
      restart() {
        restarts += 1;
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("6.1.0", "Doc", "韩梦凯", "不重启", {
          files: ["public/han.html"],
          acceptance: "打开 /han",
          restart: false
        })
      });
      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200);
      assert.equal(pub.body.item.status, "success");
      assert.equal(pub.body.version, created.body.item.version);
      assert.match(created.body.item.version, /^0\.1\.1-6-1-0$/);
      assert.deepEqual(pushed, [["public/han.html"]]);
      assert.equal(restarts, 0);
    }
  );
});

test("POST /go 发版 is 409 until 通过", async () => {
  const pushed = [];
  let restarts = 0;
  await withServer(
    {
      async push(files) {
        pushed.push(files);
        return { stdout: "full-sync" };
      },
      restart() {
        restarts += 1;
      }
    },
    async (base) => {
      const pub = await json(base, "/api/releases/go", {
        method: "POST",
        body: JSON.stringify({ order: "发版 首页" })
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /未通过禁止发/);
      assert.equal(pushed.length, 0);
      assert.equal(restarts, 0);
    }
  );
});

test("帮我上线 is not a publish order", async () => {
  let pushes = 0;
  await withServer(
    {
      async push() {
        pushes += 1;
      }
    },
    async (base) => {
      const pub = await json(base, "/api/releases/go", {
        method: "POST",
        body: JSON.stringify({ order: "帮我上线" })
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /帮我上线/);
      assert.equal(pushes, 0);
    }
  );
});

test("confirm 放行 without 口令; move and reorder are forbidden", async () => {
  const pushed = [];
  await withServer(
    {
      async push(files) {
        pushed.push(files);
        return { stdout: "ok" };
      }
    },
    async (base) => {
      const first = await json(base, "/api/releases", {
        method: "POST",
        body: JSON.stringify({
          version: "auto",
          slug: "home-shell",
          applicant: "首页 Agent",
          source: "首页导航与工作台",
          module: "首页",
          summary: "壳",
          files: ["public/shared/nav.js"],
          acceptance: "打开 /",
          restart: false
        })
      });
      const second = await json(base, "/api/releases", {
        method: "POST",
        body: apply("7.0.1", "数据中心 Agent", "数据中心", "看板", {
          files: ["public/data.html"],
          restart: true
        })
      });
      const moved = await json(base, `/api/releases/${second.body.item.id}/move`, {
        method: "POST",
        body: JSON.stringify({ direction: "up" })
      });
      assert.equal(moved.res.status, 409);
      assert.match(moved.body.error, /禁止上移/);
      const afterMove = await json(base, "/api/releases/queue");
      const live = afterMove.body.items.filter((item) => !item.demo);
      assert.equal(live[0].id, first.body.item.id);
      assert.equal(live[1].id, second.body.item.id);

      const reordered = await json(base, "/api/releases/reorder", {
        method: "POST",
        body: JSON.stringify({
          ids: afterMove.body.items.map((item) => item.id)
        })
      });
      assert.equal(reordered.res.status, 409);
      assert.match(reordered.body.error, /禁止上移|拖拽/);

      const skipped = await json(base, `/api/releases/${second.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(skipped.res.status, 409);
      assert.match(skipped.body.error, /第 1 位|提交时间|跳单/);

      const confirmed = await json(base, `/api/releases/${first.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(confirmed.res.status, 200);
      assert.equal(confirmed.body.item.status, "success");
      assert.deepEqual(pushed, [["public/shared/nav.js"]]);
      const still = await json(base, "/api/releases");
      assert.equal(still.body.items.find((item) => item.id === second.body.item.id).status, "queued");
    }
  );
});

test("mismatch 口令 does not push", async () => {
  let pushes = 0;
  await withServer(
    {
      async push() {
        pushes += 1;
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("6.2.0", "Doc", "首页", "错口令")
      });
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ order: "发布个人中心模块" })
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /未通过禁止发/);
      assert.equal(pushes, 0);
    }
  );
});

test("sourceRoot prefers the mengkai tree over leftover apps/xingmai", () => {
  const root = sourceRoot({ MENGKAI_SOURCE_DIR: "" });
  assert.match(root, /\/workspace$/);
  assert.doesNotMatch(root, /apps\/xingmai/);
  assert.equal(fs.existsSync(path.join(root, "public", "releases.html")), true);
});

test("local apply copies listed files and never needs push-xingmai-to-ecs.sh", async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "rel-src-"));
  const live = fs.mkdtempSync(path.join(os.tmpdir(), "rel-live-"));
  fs.mkdirSync(path.join(source, "public"), { recursive: true });
  fs.writeFileSync(path.join(source, "public", "releases.html"), "<html>oc</html>\n");
  const result = await pushXingmaiToEcs(["public/releases.html"], {
    sourceRoot: source,
    liveRoot: live,
    env: { MENGKAI_SKIP_PULL: "1" }
  });
  assert.match(result.stdout, /本机落地/);
  assert.equal(fs.existsSync(path.join(live, "public", "releases.html")), true);
  assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "<html>oc</html>\n");
  fs.mkdirSync(path.join(source, "test"), { recursive: true });
  fs.writeFileSync(path.join(source, "test", "releases.test.js"), "ok\n");
  const withTest = await pushXingmaiToEcs(["test/releases.test.js"], {
    sourceRoot: source,
    liveRoot: live,
    env: { MENGKAI_SKIP_PULL: "1" }
  });
  assert.match(withTest.stdout, /copied test\/releases.test.js/);
  assert.equal(fs.readFileSync(path.join(live, "test", "releases.test.js"), "utf8"), "ok\n");
  await assert.rejects(
    () => pushXingmaiToEcs(["../secret"], { sourceRoot: source, liveRoot: live, env: { MENGKAI_SKIP_PULL: "1" } }),
    /拒绝推送路径/
  );
  await assert.rejects(
    () => pushXingmaiToEcs(["deploy/scripts/push.sh"], { sourceRoot: source, liveRoot: live, env: { MENGKAI_SKIP_PULL: "1" } }),
    /拒绝推送路径/
  );
  await assert.rejects(
    () => pushXingmaiToEcs(["public/missing.html"], { sourceRoot: source, liveRoot: live, env: { MENGKAI_SKIP_PULL: "1" } }),
    (err) => {
      assert.equal(err.code, "ENOENT");
      assert.match(String(err.stderr), /源目录不存在/);
      return true;
    }
  );
  fs.mkdirSync(path.join(live, "public"), { recursive: true });
  fs.writeFileSync(path.join(live, "public", "releases.html"), "<html>oc</html>\n");
  await assert.rejects(
    () => pushXingmaiToEcs(["public/releases.html"], { sourceRoot: source, liveRoot: live, env: { MENGKAI_SKIP_PULL: "1" } }),
    (err) => {
      assert.match(String(err.message), /完全相同/);
      assert.equal(String(err.stderr), NOOP_APPLY_ERROR);
      return true;
    }
  );
  const snapDir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-receipt-"));
  fs.writeFileSync(path.join(source, "public", "releases.html"), "<html>next</html>\n");
  const withReceipt = await pushXingmaiToEcs(["public/releases.html"], {
    sourceRoot: source,
    liveRoot: live,
    snapshotDir: snapDir,
    env: { MENGKAI_SKIP_PULL: "1" }
  });
  assert.equal(hasApplyReceipt(snapDir), true);
  assert.match(withReceipt.stdout, /落地回执/);
  assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "<html>next</html>\n");
});

test("create rejects tickets whose source files are missing", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/releases", {
      method: "POST",
      body: apply("0.1.17-missing", "Ada", "版本发布中心", "缺文件", {
        files: ["public/does-not-exist-gate.html"]
      })
    });
    assert.equal(created.res.status, 400);
    assert.match(created.body.error, /源目录缺少文件/);
    assert.deepEqual(created.body.missing, ["public/does-not-exist-gate.html"]);
  });
});

test("confirm rejects identical source then copies when source is new", async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "rel-src-first-"));
  const live = fs.mkdtempSync(path.join(os.tmpdir(), "rel-live-first-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "rel-state-first-"));
  fs.mkdirSync(path.join(source, "public"), { recursive: true });
  fs.mkdirSync(path.join(live, "public"), { recursive: true });
  fs.writeFileSync(path.join(source, "public", "releases.html"), "SAME\n");
  fs.writeFileSync(path.join(live, "public", "releases.html"), "SAME\n");

  await withServer(
    {
      stateDir: state,
      liveRoot: live,
      async push(files, options) {
        return pushXingmaiToEcs(files, {
          snapshotDir: options.snapshotDir,
          sourceRoot: source,
          liveRoot: live,
          env: { MENGKAI_SKIP_PULL: "1" }
        });
      }
    },
    async (base) => {
      const sameTicket = await json(base, "/api/releases", {
        method: "POST",
        body: apply("source-same", "版本发布中心", "版本发布中心", "源目录与线上相同应失败", {
          files: ["public/releases.html"],
          restart: false
        })
      });
      assert.equal(sameTicket.res.status, 201);
      const same = await json(base, `/api/releases/${sameTicket.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(same.res.status, 500);
      assert.match(String(same.body.error || ""), /完全相同/);
      assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "SAME\n");

      fs.writeFileSync(path.join(source, "public", "releases.html"), "NEW-SOURCE-FIRST\n");
      const fresh = await json(base, "/api/releases", {
        method: "POST",
        body: apply("source-first", "版本发布中心", "版本发布中心", "只改源目录再通过", {
          files: ["public/releases.html"],
          restart: false
        })
      });
      assert.equal(fresh.res.status, 201);
      const pub = await json(base, `/api/releases/${fresh.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200);
      assert.equal(pub.body.item.status, "success");
      assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "NEW-SOURCE-FIRST\n");
      assert.match(pub.body.item.log, /不重启|本机落地/);
    }
  );
});

test("create writes contents into source and rejects identical trees", async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "rel-src-contents-"));
  const live = fs.mkdtempSync(path.join(os.tmpdir(), "rel-live-contents-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "rel-state-contents-"));
  fs.mkdirSync(path.join(source, "public"), { recursive: true });
  fs.mkdirSync(path.join(live, "public"), { recursive: true });
  fs.writeFileSync(path.join(source, "public", "nav.js"), "OLD\n");
  fs.writeFileSync(path.join(live, "public", "nav.js"), "OLD\n");

  await withServer(
    {
      stateDir: state,
      sourceRoot: source,
      liveRoot: live,
      async push(files, options) {
        return pushXingmaiToEcs(files, {
          snapshotDir: options.snapshotDir,
          sourceRoot: source,
          liveRoot: live,
          env: { MENGKAI_SKIP_PULL: "1" }
        });
      }
    },
    async (base) => {
      const same = await json(base, "/api/releases", {
        method: "POST",
        body: apply("same-bytes", "版本发布中心", "版本发布中心", "相同应拒", {
          files: ["public/nav.js"],
          restart: false
        })
      });
      assert.equal(same.res.status, 409);
      assert.match(String(same.body.error || ""), /完全相同/);
      assert.match(String(same.body.hint || ""), /contents|ref/);

      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("with-contents", "版本发布中心", "版本发布中心", "带正文写入源目录", {
          files: ["public/nav.js"],
          contents: { "public/nav.js": "FROM-CONTENTS\n" },
          restart: false
        })
      });
      assert.equal(created.res.status, 201);
      assert.equal(fs.readFileSync(path.join(source, "public", "nav.js"), "utf8"), "FROM-CONTENTS\n");
      assert.equal(fs.readFileSync(path.join(live, "public", "nav.js"), "utf8"), "OLD\n");
      assert.equal(created.body.item.gitRef, "");

      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200);
      assert.equal(fs.readFileSync(path.join(live, "public", "nav.js"), "utf8"), "FROM-CONTENTS\n");
    }
  );
});

test("create fetches ref from GitHub into source", async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "rel-src-ref-"));
  const live = fs.mkdtempSync(path.join(os.tmpdir(), "rel-live-ref-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "rel-state-ref-"));
  fs.mkdirSync(path.join(source, "src"), { recursive: true });
  fs.mkdirSync(path.join(live, "src"), { recursive: true });
  fs.writeFileSync(path.join(source, "src", "server.js"), "OLD\n");
  fs.writeFileSync(path.join(live, "src", "server.js"), "OLD\n");
  let fetchedUrl = "";

  await withServer(
    {
      stateDir: state,
      sourceRoot: source,
      liveRoot: live,
      async fetchImpl(url) {
        fetchedUrl = String(url);
        return {
          ok: true,
          status: 200,
          async arrayBuffer() {
            return Buffer.from("KEEPALIVE\n");
          }
        };
      },
      async push(files, options) {
        return pushXingmaiToEcs(files, {
          snapshotDir: options.snapshotDir,
          sourceRoot: source,
          liveRoot: live,
          env: { MENGKAI_SKIP_PULL: "1" }
        });
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("from-ref", "首页", "首页", "按 ref 拉 GitHub", {
          files: ["src/server.js"],
          ref: "604188a",
          restart: false
        })
      });
      assert.equal(created.res.status, 201, created.body.error);
      assert.match(fetchedUrl, /contents\/src\/server\.js/);
      assert.match(fetchedUrl, /ref=604188a/);
      assert.equal(created.body.item.gitRef, "604188a");
      assert.equal(fs.readFileSync(path.join(source, "src", "server.js"), "utf8"), "KEEPALIVE\n");
      const extra = await json(base, "/api/releases", {
        method: "POST",
        body: apply("bad-contents-path", "首页", "首页", "正文路径不对", {
          files: ["src/server.js"],
          contents: { "public/secret.js": "nope" },
          restart: false
        })
      });
      assert.equal(extra.res.status, 400);
      assert.match(String(extra.body.error || ""), /未交单路径/);
    }
  );
});

test("stage helpers accept contents and ignore same-tree create rejects", () => {
  assert.equal(parseGitRef({ sha: "abc1234" }), "abc1234");
  assert.equal(shouldRejectUnchangedAtCreate("/var/lib/mengkai/source", "/opt/mengkai"), true);
  assert.equal(shouldRejectUnchangedAtCreate("/workspace", "/workspace"), false);
  const files = ["public/nav.js"];
  const map = normalizeContents({ "public/nav.js": "x" }, files);
  assert.equal(Buffer.isBuffer(map["public/nav.js"]), true);
  assert.throws(() => normalizeContents({ "src/app.js": "x" }, files), /未交单路径/);
  assert.deepEqual(githubPathCandidates("public/shared/layout.css"), [
    "public/shared/layout.css",
    "apps/xingmai/public/shared/layout.css"
  ]);
});

test("fetchGithubFile falls back to apps/xingmai prefix", async () => {
  const urls = [];
  const fetched = await fetchGithubFile("public/shared/layout.css", {
    ref: "cursor/cursor-theme-63da",
    async fetchImpl(url) {
      urls.push(String(url));
      if (String(url).includes("/contents/apps/xingmai/public/shared/layout.css")) {
        return {
          ok: true,
          status: 200,
          async arrayBuffer() {
            return Buffer.from("THEME\n");
          }
        };
      }
      return { ok: false, status: 404, async arrayBuffer() { return Buffer.from(""); } };
    }
  });
  assert.equal(fetched.buf.toString(), "THEME\n");
  assert.equal(fetched.remotePath, "apps/xingmai/public/shared/layout.css");
  assert.match(urls[0], /contents\/public\/shared\/layout\.css/);
  assert.match(urls[1], /contents\/apps\/xingmai\/public\/shared\/layout\.css/);
});

test("confirm keeps source when git ref 404s after contents staged", async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "rel-src-keep-"));
  const live = fs.mkdtempSync(path.join(os.tmpdir(), "rel-live-keep-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "rel-state-keep-"));
  fs.mkdirSync(path.join(source, "public", "shared"), { recursive: true });
  fs.mkdirSync(path.join(live, "public", "shared"), { recursive: true });
  fs.writeFileSync(path.join(source, "public", "shared", "layout.css"), "OLD\n");
  fs.writeFileSync(path.join(live, "public", "shared", "layout.css"), "OLD\n");

  await withServer(
    {
      stateDir: state,
      sourceRoot: source,
      liveRoot: live,
      async fetchImpl() {
        return { ok: false, status: 404, async arrayBuffer() { return Buffer.from(""); } };
      },
      async push(files, options) {
        return pushXingmaiToEcs(files, {
          snapshotDir: options.snapshotDir,
          sourceRoot: source,
          liveRoot: live,
          env: { MENGKAI_SKIP_PULL: "1" }
        });
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("keep-source", "首页", "首页", "正文已写入源目录", {
          files: ["public/shared/layout.css"],
          contents: { "public/shared/layout.css": "THEME-CSS\n" },
          ref: "cursor/cursor-theme-63da",
          restart: false
        })
      });
      assert.equal(created.res.status, 201, created.body.error);
      assert.equal(created.body.item.gitRef, "cursor/cursor-theme-63da");
      assert.equal(fs.readFileSync(path.join(source, "public", "shared", "layout.css"), "utf8"), "THEME-CSS\n");
      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200, pub.body.error);
      assert.equal(fs.readFileSync(path.join(live, "public", "shared", "layout.css"), "utf8"), "THEME-CSS\n");
    }
  );
});

test("failed push writes stderr into ticket log", async () => {
  await withServer(
    {
      async push() {
        throw Object.assign(new Error("spawn /opt/mengkai/deploy/scripts/push-xingmai-to-ecs.sh"), {
          code: "ENOENT",
          stderr: "ENOENT: no such file or directory"
        });
      }
    },
    async (base) => {
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("0.1.7-log", "版本发布中心", "版本发布中心", "测失败日志")
      });
      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 500);
      const all = await json(base, "/api/releases");
      const item = all.body.items.find((row) => row.id === created.body.item.id);
      assert.equal(item.status, "failed");
      assert.match(item.log, /stderr: ENOENT/);
      assert.match(item.log, /code=ENOENT/);
    }
  );
});

test("formatExecError keeps stderr for the board", () => {
  const text = formatExecError({
    message: "spawn failed",
    code: "ENOENT",
    stderr: "no such file",
    stdout: ""
  });
  assert.match(text, /stderr: no such file/);
  assert.match(text, /code=ENOENT/);
});

test("successful version cannot be queued again; versions lists current", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/releases", {
      method: "POST",
      body: apply("9.0.0-ver", "Eve", "版本发布中心", "占版本")
    });
    const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(pub.res.status, 200);
    const versions = await json(base, "/api/releases/versions");
    assert.equal(versions.res.status, 200);
    assert.equal(
      versions.body.current.some((row) => row.module === "版本发布中心" && row.version === created.body.item.version),
      true
    );
    assert.equal(versions.body.next.seq, 2);
    const dup = await json(base, "/api/releases", {
      method: "POST",
      body: apply("again", "Eve", "首页", "跨模块再占同一号", { version: created.body.item.version })
    });
    assert.equal(dup.res.status, 409);
    assert.match(dup.body.error, /占用/);
    const queued = await json(base, `/api/releases/${created.body.item.id}/rollback`, {
      method: "POST",
      body: "{}"
    });
    assert.ok(queued.res.status === 409 || queued.res.status === 500);
  });
});

test("queued ticket cannot rollback", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/releases", {
      method: "POST",
      body: apply("9.0.1-q", "Eve", "首页", "排队不可回滚")
    });
    const rb = await json(base, `/api/releases/${created.body.item.id}/rollback`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(rb.res.status, 409);
    assert.match(rb.body.error, /只能回滚已成功发布的版本/);
  });
});

test("apply snapshots live files and rollback restores them", async () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "rel-src-"));
  const live = fs.mkdtempSync(path.join(os.tmpdir(), "rel-live-"));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "rel-state-"));
  const snap = fs.mkdtempSync(path.join(os.tmpdir(), "rel-snap-"));
  fs.mkdirSync(path.join(source, "public"), { recursive: true });
  fs.mkdirSync(path.join(live, "public"), { recursive: true });
  fs.writeFileSync(path.join(source, "public", "releases.html"), "NEW\n");
  fs.writeFileSync(path.join(live, "public", "releases.html"), "OLD\n");
  const result = await pushXingmaiToEcs(["public/releases.html"], {
    sourceRoot: source,
    liveRoot: live,
    snapshotDir: snap,
    env: { MENGKAI_SKIP_PULL: "1" }
  });
  assert.match(result.stdout, /升级前快照/);
  assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "NEW\n");
  assert.equal(fs.readFileSync(path.join(snap, "public", "releases.html"), "utf8"), "OLD\n");
  const restored = restoreSnapshot(snap, live, ["public/releases.html"]);
  assert.match(restored.stdout, /restored public\/releases.html/);
  assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "OLD\n");

  let restarts = 0;
  await withServer(
    {
      stateDir: state,
      liveRoot: live,
      restart() {
        restarts += 1;
      },
      async push(files, options) {
        return pushXingmaiToEcs(files, {
          snapshotDir: options.snapshotDir,
          sourceRoot: source,
          liveRoot: live,
          env: { MENGKAI_SKIP_PULL: "1" }
        });
      }
    },
    async (base) => {
      fs.writeFileSync(path.join(source, "public", "releases.html"), "SHIP\n");
      fs.writeFileSync(path.join(live, "public", "releases.html"), "LIVE\n");
      const created = await json(base, "/api/releases", {
        method: "POST",
        body: apply("9.1.0-rb", "版本发布中心", "版本发布中心", "回滚验收", {
          files: ["public/releases.html"],
          restart: true
        })
      });
      const pub = await json(base, `/api/releases/${created.body.item.id}/confirm`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(pub.res.status, 200);
      assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "SHIP\n");
      const rb = await json(base, `/api/releases/${created.body.item.id}/rollback`, {
        method: "POST",
        body: "{}"
      });
      assert.equal(rb.res.status, 200);
      assert.equal(rb.body.rolledBack, true);
      assert.equal(rb.body.item.status, "success");
      assert.equal(restarts, 0);
      assert.match(rb.body.item.log, /不重启/);
      assert.equal(fs.readFileSync(path.join(live, "public", "releases.html"), "utf8"), "LIVE\n");
      const still = await json(base, "/api/releases/queue");
      assert.equal(
        still.body.items.some((item) => item.status === "publishing"),
        false
      );
    }
  );
});

