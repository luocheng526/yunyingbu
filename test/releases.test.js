import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
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

function apply(version, applicant, module, summary, extra = {}) {
  return JSON.stringify({
    version,
    applicant,
    module,
    summary,
    files: extra.files || ["src/app.js"],
    acceptance: extra.acceptance || "自动化验收",
    restart: extra.restart ?? false
  });
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
    assert.match(text, /只听主脑下令才发版/);
    assert.match(text, /push-xingmai-to-ecs/);
    assert.match(text, /window\.location\.replace\("\/login"\)/);
    assert.doesNotMatch(text, /id="login-form"/);
    assert.doesNotMatch(text, /星脉管理系统/);
  });
});

test("releases.html has no login form and sends users to /login", () => {
  const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/releases.html"), "utf8");
  assert.doesNotMatch(html, /id="login-form"/);
  assert.doesNotMatch(html, /<input[^>]*type="password"/);
  assert.match(html, /\/login/);
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
      ["POST", "/api/releases"]
    ];
    for (const [method, pathname] of calls) {
      const { res, body } = await json(base, pathname, {
        method,
        body: method === "POST" ? apply("1.0.0", "Eve", "首页", "no session") : undefined
      });
      assert.equal(res.status, 401, pathname);
      assert.equal(body.error, "未登录");
    }
  });
});

test("submit three applications; queue is FIFO by time", async () => {
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
      assert.deepEqual(versions, ["1.0.1", "1.0.2", "1.0.3"]);
      assert.ok(
        queue.body.items.every((item, i, arr) => i === 0 || arr[i - 1].submittedAt <= item.submittedAt)
      );
      assert.equal(b.body.item.id !== c.body.item.id, true);
    }
  );
});

test("publish while queued is 409 and does not restart", async () => {
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
        body: apply("2.0.0", "Eve", "人员管理", "未审核")
      });
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: publishBody()
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /未审核通过/);
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
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: publishBody()
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /驳回/);
      assert.equal(restarts, 0);
    }
  );
});

test("approve then publish runs restart once and only that ticket succeeds", async () => {
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
      await json(base, `/api/releases/${first.body.item.id}/approve`, { method: "POST" });
      await json(base, `/api/releases/${second.body.item.id}/approve`, { method: "POST" });
      const pub = await json(base, `/api/releases/${first.body.item.id}/publish`, {
        method: "POST",
        body: publishBody()
      });
      assert.equal(pub.res.status, 200);
      assert.equal(pub.body.item.status, "success");
      assert.equal(restarts, 1);
      const all = await json(base, "/api/releases");
      const a = all.body.items.find((item) => item.id === first.body.item.id);
      const b = all.body.items.find((item) => item.id === second.body.item.id);
      assert.equal(a.status, "success");
      assert.equal(b.status, "approved");
      const lock = await json(base, "/api/releases/lock");
      assert.equal(lock.body.locked, false);
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
      async restart() {
        started += 1;
        await hold;
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
      await json(base, `/api/releases/${first.body.item.id}/approve`, { method: "POST" });
      await json(base, `/api/releases/${second.body.item.id}/approve`, { method: "POST" });

      const firstPublish = json(base, `/api/releases/${first.body.item.id}/publish`, {
        method: "POST",
        body: publishBody()
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
      assert.equal(lock.body.current.version, "4.0.0");

      const stolen = await json(base, `/api/releases/${second.body.item.id}/publish`, {
        method: "POST",
        body: publishBody()
      });
      assert.equal(stolen.res.status, 409);
      assert.equal(stolen.body.error, "有发布正在进行，禁止抢发");

      const again = await json(base, `/api/releases/${first.body.item.id}/publish`, {
        method: "POST",
        body: publishBody()
      });
      assert.equal(again.res.status, 409);
      assert.match(again.body.error, /禁止抢发/);

      releaseHold();
      const done = await firstPublish;
      assert.equal(done.body.item.status, "success");
      assert.equal(started, 1);
      const later = await json(base, "/api/releases");
      assert.equal(later.body.items.find((item) => item.id === second.body.item.id).status, "approved");
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

test("incomplete document is 400 with missing list; does not queue", async () => {
  await withServer(async (base) => {
    const { res, body } = await json(base, "/api/releases", {
      method: "POST",
      body: JSON.stringify({ version: "9.0.0", applicant: "X", module: "首页", summary: "无文件" })
    });
    assert.equal(res.status, 400);
    assert.ok(body.missing.includes("文件列表"));
    assert.ok(body.missing.includes("验收"));
    assert.ok(body.missing.includes("是否重启"));
    const queue = await json(base, "/api/releases/queue");
    assert.equal(queue.body.items.some((item) => item.version === "9.0.0"), false);
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
      await json(base, `/api/releases/${created.body.item.id}/approve`, { method: "POST" });
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: JSON.stringify({})
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /没有主脑口令/);
      assert.equal(pushes, 0);
      assert.equal(restarts, 0);
      const all = await json(base, "/api/releases");
      assert.equal(all.body.items.find((item) => item.id === created.body.item.id).status, "approved");
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
      await json(base, `/api/releases/${created.body.item.id}/approve`, { method: "POST" });
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ order: "发布韩梦凯模块" })
      });
      assert.equal(pub.res.status, 200);
      assert.equal(pub.body.item.status, "success");
      assert.equal(pub.body.version, "6.1.0");
      assert.deepEqual(pushed, [["public/han.html"]]);
      assert.equal(restarts, 0);
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
      await json(base, `/api/releases/${created.body.item.id}/approve`, { method: "POST" });
      const pub = await json(base, `/api/releases/${created.body.item.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ order: "发布个人中心模块" })
      });
      assert.equal(pub.res.status, 409);
      assert.match(pub.body.error, /不一致/);
      assert.equal(pushes, 0);
    }
  );
});

