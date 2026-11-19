import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  DEMO_INITIAL_PASSWORD,
  DEMO_USERNAME,
  dbMode,
  query,
  resolveDesk,
  resetStoreForTests,
  setPeopleLoginForTests,
  setPeopleListLoaderForTests,
  setPoolForTests
} from "../src/modules/profile/auth.js";
import { patchAppSource } from "../src/modules/profile/patch-app.js";

test.beforeEach(() => {
  resetStoreForTests();
});

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

function cookieHeader(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((part) => part.split(";")[0]).join("; ");
}

async function request(base, pathname, { method = "GET", body, cookie, redirect = "manual", headers: extraHeaders } = {}) {
  const headers = { ...(extraHeaders || {}) };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (cookie) {
    headers.Cookie = cookie;
  }
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json, cookie: cookieHeader(res) };
}

test("auth.js exports dbMode() and query for academy and other stores", () => {
  assert.equal(typeof dbMode, "function");
  assert.equal(dbMode(), "memory");
  assert.equal(typeof query, "function");
  assert.equal(typeof resolveDesk, "function");
  assert.equal(resolveDesk(null).home, "/home");
  assert.equal(resolveDesk({ username: "罗成" }).home, "/home");
  const authSource = fs.readFileSync(new URL("../src/modules/profile/auth.js", import.meta.url), "utf8");
  assert.doesNotMatch(authSource, /from ["']\.\/duties\.js["']/);
  assert.doesNotMatch(authSource, /from ["']express["']/);
});

test("GET /shared assets are public and cacheable; APIs are not cached", async () => {
  await withServer(async (base) => {
    const css = await request(base, "/shared/layout.css");
    assert.equal(css.res.status, 200);
    assert.match(String(css.res.headers.get("cache-control")), /max-age=3600/);
    const js = await request(base, "/shared/nav.js");
    assert.equal(js.res.status, 200);
    assert.match(String(js.res.headers.get("cache-control")), /max-age=3600/);
    const api = await request(base, "/api/auth/me", { redirect: "follow" });
    assert.equal(api.res.status, 401);
    assert.match(String(api.res.headers.get("cache-control")), /no-store/);
  });
});

test("unauthenticated / and /me redirect to /login", async () => {
  await withServer(async (base) => {
    for (const pathName of ["/", "/me"]) {
      const { res } = await request(base, pathName);
      assert.equal(res.status, 302, pathName);
      assert.equal(res.headers.get("location"), "/login", pathName);
    }
  });
});

test("GET /login is 200 星脉管理系统", async () => {
  await withServer(async (base) => {
    const { res, text } = await request(base, "/login");
    assert.equal(res.status, 200);
    assert.match(text, /星脉管理系统/);
    assert.match(text, /记住密码/);
    assert.doesNotMatch(text, /nav\.js/);
    assert.doesNotMatch(text, /钉钉|SSO|dingtalk/i);
  });
});

test("login 罗成 sets cookie; GET /api/auth/me 200; wrong password 401", async () => {
  await withServer(async (base) => {
    const bad = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: "bad" },
      redirect: "follow"
    });
    assert.equal(bad.res.status, 401);

    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow"
    });
    assert.equal(ok.res.status, 200);
    assert.match(ok.cookie, /mk_sid=/);
    const me = await request(base, "/api/auth/me", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(me.res.status, 200);
    assert.equal(me.json.username, "罗成");
    assert.equal(JSON.stringify(me.json).includes("scrypt"), false);

    const page = await request(base, "/me", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(page.res.status, 200);
    assert.match(page.text, /个人中心/);
    assert.match(page.text, /shared\/layout\.css/);
    assert.match(page.text, /shared\/nav\.js/);
    assert.match(page.text, /<aside class="site-sidebar">/);
    assert.match(page.text, /<main class="page">/);
    assert.match(page.text, /我的责权清单/);
    assert.match(page.text, /个人信息/);
    assert.match(page.text, /点击上传头像/);
    assert.match(page.text, /所属部门/);
    assert.match(page.text, /创建日期/);
    assert.match(page.text, /修改密码/);
    assert.match(page.text, /退出登录/);
    assert.match(page.text, /btn-logout/);
    assert.doesNotMatch(page.text, /<header class="site-header">/);

    const moduleJs = await request(base, "/shared/modules/me.js", { redirect: "follow" });
    assert.equal(moduleJs.res.status, 200);
    assert.match(moduleJs.text, /XmModules\["\/me"\]/);
    assert.match(moduleJs.text, /个人信息/);
    assert.match(moduleJs.text, /点击上传头像/);
    assert.match(moduleJs.text, /所属部门/);
    assert.match(moduleJs.text, /快捷操作/);
    assert.match(moduleJs.text, /登录设备管理/);
    assert.match(moduleJs.text, /账号安全/);
    assert.match(moduleJs.text, /id="me-security-card"/);
    assert.match(moduleJs.text, /virtualAvatar/);
    assert.match(moduleJs.text, /data:image\/svg\+xml/);
    assert.match(moduleJs.text, /我的权限/);
    assert.match(moduleJs.text, /我的责权清单/);
    assert.match(moduleJs.text, /\/api\/profile\/duties/);
    assert.match(moduleJs.text, /\/api\/people\/org\/site-acl\/me/);
    assert.match(moduleJs.text, /暂无设置/);
    assert.doesNotMatch(moduleJs.text, /责权清单暂未从服务端同步/);
    assert.doesNotMatch(moduleJs.text, /label: "账号安全", value: "security"/);
    assert.match(moduleJs.text, /退出登录/);
    assert.match(moduleJs.text, /me-btn-logout/);
    assert.match(moduleJs.text, /\/api\/auth\/logout/);
    assert.match(moduleJs.text, /id="me-hard-reload"/);
    assert.match(moduleJs.text, /强制刷新/);
    assert.match(moduleJs.text, /__xmHardReload/);
    assert.match(moduleJs.text, /\/api\/profile\/logs/);
    assert.match(moduleJs.text, /个人不可删除/);
    assert.doesNotMatch(moduleJs.text, /操作日志即将开放/);
    assert.match(moduleJs.text, /\/api\/profile\/avatar/);
    assert.doesNotMatch(moduleJs.text, /sessionStorage\.setItem\("xm-me-avatar-/);
    assert.match(moduleJs.text, /localStorage\.setItem\(avatarCacheKey/);
    assert.doesNotMatch(moduleJs.text, /iPhone 15/);
    assert.doesNotMatch(moduleJs.text, /2026-11-17 10:24/);
    assert.doesNotMatch(moduleJs.text, /消息通知设置即将开放/);
    assert.match(moduleJs.text, /\/api\/profile\/sessions/);
    assert.match(moduleJs.text, /\/api\/profile\/notices/);
    assert.match(moduleJs.text, /异地登录/);
    assert.match(moduleJs.text, /多客户端登录/);
    assert.match(moduleJs.text, /openBasicOnEnterMe/);
    assert.match(moduleJs.text, /showTab\("basic"\)/);
    assert.match(moduleJs.text, /xm-me-route/);
  });
});

test("duty catalog lists granted items and can register a new duty", async () => {
  await withServer(async (base) => {
    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow"
    });
    const duties = await request(base, "/api/profile/duties", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(duties.res.status, 200);
    assert.ok(duties.json.grantedCount > 0);
    const names = duties.json.groups.map((group) => group.name);
    assert.deepEqual(names, [
      "数据中心",
      "沈子晗运营中心",
      "韩梦凯运营中心",
      "甄选商学院",
      "甄选智能体",
      "版本发布中心",
      "组织中心",
      "个人中心"
    ]);
    assert.equal(duties.json.identity.username, "罗成");
    assert.equal(duties.json.identity.department, "星脉集团/河西星脉甄选");
    assert.equal(duties.json.identity.createdAt, "2026-01-01 00:00:00");
    const before = duties.json.total;
    const added = await request(base, "/api/profile/duties", {
      method: "POST",
      cookie: ok.cookie,
      redirect: "follow",
      body: { id: "agents.future", group: "甄选智能体", label: "进入未来能力" }
    });
    assert.equal(added.res.status, 200);
    assert.equal(added.json.total, before + 1);
    assert.ok(added.json.groups.some((group) => group.items.some((item) => item.id === "agents.future")));
  });
});

test("organization people accounts can log in with roster password", async () => {
  setPeopleLoginForTests([
    { name: "沈子晗", username: "沈子晗", password: "OrgLogin-test1", role: "经理", department: "沈子晗运营中心", status: "在职" },
    { name: "管理员", username: DEMO_USERNAME, password: "OrgLogin-admin1", role: "总监", status: "在职" }
  ]);
  await withServer(async (base) => {
    const bad = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: "沈子晗", password: "bad" },
      redirect: "follow"
    });
    assert.equal(bad.res.status, 401);

    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: "沈子晗", password: "OrgLogin-test1" },
      redirect: "follow"
    });
    assert.equal(ok.res.status, 200);
    assert.match(ok.cookie, /mk_sid=/);
    assert.equal(ok.json.user.username, "沈子晗");
    const me = await request(base, "/api/auth/me", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(me.res.status, 200);
    assert.equal(me.json.username, "沈子晗");
    assert.equal(me.json.department, "沈子晗运营中心");

    const admin = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow"
    });
    assert.equal(admin.res.status, 200);

    const adminOrg = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: "OrgLogin-admin1" },
      redirect: "follow"
    });
    assert.equal(adminOrg.res.status, 200);
    assert.equal(adminOrg.json.user.username, "罗成");
  });
});

test("people login reads pack json when people table has no username column", async () => {
  setPoolForTests({
    async query(sql) {
      const text = String(sql);
      if (/SELECT \* FROM `people`/i.test(text) || /SELECT \* FROM people/i.test(text)) {
        return [
          [
            {
              id: 4,
              name: "张文静",
              role: "运营",
              center: "韩梦凯运营中心",
              status: "在职",
              pack: JSON.stringify({
                username: "张文静",
                password: "OrgLogin-test1",
                department: "韩梦凯运营中心"
              })
            }
          ]
        ];
      }
      return [[]];
    }
  });
  await withServer(async (base) => {
    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: "张文静", password: "OrgLogin-test1" },
      redirect: "follow"
    });
    assert.equal(ok.res.status, 200);
    assert.equal(ok.json.user.username, "张文静");
    const me = await request(base, "/api/auth/me", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(me.res.status, 200);
    assert.equal(me.json.username, "张文静");
  });
});

test("people login uses organization listPeople overlay not mysql columns", async () => {
  setPeopleListLoaderForTests(() => [
    {
      id: 4,
      name: "张文静",
      username: "张文静",
      password: "OrgLogin-test1",
      status: "在职",
      role: "运营",
      department: "韩梦凯运营中心"
    }
  ]);
  await withServer(async (base) => {
    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: "张文静", password: "OrgLogin-test1" },
      redirect: "follow"
    });
    assert.equal(ok.res.status, 200);
    assert.equal(ok.json.user.username, "张文静");
  });
});

test("operation logs record account actions; staff cannot delete; 罗成 sees everyone", async () => {
  setPeopleLoginForTests([
    { name: "沈子晗", username: "沈子晗", password: "OrgLogin-test1", role: "经理", department: "沈子晗运营中心", status: "在职" }
  ]);
  await withServer(async (base) => {
    const staff = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: "沈子晗", password: "OrgLogin-test1" },
      redirect: "follow"
    });
    assert.equal(staff.res.status, 200);
    const staffLogs = await request(base, "/api/profile/logs", { cookie: staff.cookie, redirect: "follow" });
    assert.equal(staffLogs.res.status, 200);
    assert.equal(staffLogs.json.scope, "self");
    assert.equal(staffLogs.json.canDelete, false);
    assert.ok(staffLogs.json.items.some((item) => item.username === "沈子晗" && item.action === "登录"));
    assert.equal(
      staffLogs.json.items.every((item) => item.username === "沈子晗"),
      true
    );

    const denied = await request(base, "/api/profile/logs/abc", {
      method: "DELETE",
      cookie: staff.cookie,
      redirect: "follow"
    });
    assert.equal(denied.res.status, 403);
    assert.match(denied.json.error, /不可删除/);

    const admin = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow"
    });
    assert.equal(admin.res.status, 200);
    const allLogs = await request(base, "/api/profile/logs", { cookie: admin.cookie, redirect: "follow" });
    assert.equal(allLogs.res.status, 200);
    assert.equal(allLogs.json.scope, "all");
    assert.equal(allLogs.json.canDelete, false);
    assert.ok(allLogs.json.items.some((item) => item.username === "沈子晗"));
    assert.ok(allLogs.json.items.some((item) => item.username === DEMO_USERNAME));

    const onlyStaff = await request(base, "/api/profile/logs?username=" + encodeURIComponent("沈子晗"), {
      cookie: admin.cookie,
      redirect: "follow"
    });
    assert.equal(onlyStaff.json.items.every((item) => item.username === "沈子晗"), true);

    const spoof = await request(base, "/api/profile/logs?username=" + encodeURIComponent(DEMO_USERNAME), {
      cookie: staff.cookie,
      redirect: "follow"
    });
    assert.equal(spoof.json.items.every((item) => item.username === "沈子晗"), true);
  });
});

test("real sessions replace fake devices and notify multi-client or remote login", async () => {
  await withServer(async (base) => {
    const first = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0", "x-forwarded-for": "10.0.0.8" }
    });
    assert.equal(first.res.status, 200);
    const sessions = await request(base, "/api/profile/sessions", { cookie: first.cookie, redirect: "follow" });
    assert.equal(sessions.res.status, 200);
    assert.equal(sessions.json.items.length, 1);
    assert.match(sessions.json.items[0].device, /Windows/);
    assert.equal(sessions.json.items[0].current, true);
    assert.doesNotMatch(JSON.stringify(sessions.json), /iPhone 15/);

    const emptyNotice = await request(base, "/api/profile/notices", { cookie: first.cookie, redirect: "follow" });
    assert.equal(emptyNotice.json.items.length, 0);

    const second = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "x-forwarded-for": "203.0.113.9" }
    });
    assert.equal(second.res.status, 200);
    const both = await request(base, "/api/profile/sessions", { cookie: second.cookie, redirect: "follow" });
    assert.equal(both.json.items.length, 2);
    const notices = await request(base, "/api/profile/notices", { cookie: second.cookie, redirect: "follow" });
    assert.ok(notices.json.items.some((item) => item.title === "多客户端登录"));
    assert.ok(notices.json.items.some((item) => item.title === "异地登录"));

    const other = both.json.items.find((item) => !item.current);
    const kickSelf = await request(base, "/api/profile/sessions/" + encodeURIComponent(both.json.items.find((item) => item.current).sid), {
      method: "DELETE",
      cookie: second.cookie,
      redirect: "follow"
    });
    assert.equal(kickSelf.res.status, 400);
    const kick = await request(base, "/api/profile/sessions/" + encodeURIComponent(other.sid), {
      method: "DELETE",
      cookie: second.cookie,
      redirect: "follow"
    });
    assert.equal(kick.res.status, 200);
    const after = await request(base, "/api/profile/sessions", { cookie: second.cookie, redirect: "follow" });
    assert.equal(after.json.items.length, 1);
    assert.equal(after.json.items[0].current, true);
  });
});

test("uploaded avatar is stored on the server and survives a later profile fetch", async () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await withServer(async (base) => {
    const missing = await request(base, "/api/profile/avatar", { redirect: "follow" });
    assert.equal(missing.res.status, 401);

    const ok = await request(base, "/api/auth/login", {
      method: "POST",
      body: { username: DEMO_USERNAME, password: DEMO_INITIAL_PASSWORD },
      redirect: "follow"
    });
    assert.equal(ok.res.status, 200);
    assert.equal(ok.json.user.avatarUrl || "", "");

    const empty = await request(base, "/api/profile/avatar", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(empty.res.status, 404);

    const saved = await request(base, "/api/profile/avatar", {
      method: "POST",
      cookie: ok.cookie,
      redirect: "follow",
      body: { image: png }
    });
    assert.equal(saved.res.status, 200);
    assert.match(saved.json.avatarUrl, /\/api\/profile\/avatar/);

    const file = await request(base, saved.json.avatarUrl, { cookie: ok.cookie, redirect: "follow" });
    assert.equal(file.res.status, 200);
    assert.match(String(file.res.headers.get("content-type")), /image\//);
    assert.ok(file.text.length > 0);

    const later = await request(base, "/api/profile", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(later.res.status, 200);
    assert.equal(later.json.avatarUrl, saved.json.avatarUrl);

    const again = await request(base, "/api/profile/avatar", { cookie: ok.cookie, redirect: "follow" });
    assert.equal(again.res.status, 200);
    assert.equal(again.text, file.text);

    const logs = await request(base, "/api/profile/logs", { cookie: ok.cookie, redirect: "follow" });
    assert.ok(logs.json.items.some((item) => item.action === "上传头像"));
  });
});

test("patchAppSource only inserts attachProfile after json()", () => {
  const original = `import express from "express";
import { attachHome } from "./modules/home/attach.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  attachHome(app);
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ attachProfile \} from "\.\/modules\/profile\/attach\.js";/);
  assert.match(patched, /app\.use\(express\.json\(\)\);\n  attachProfile\(app\);/);
  assert.match(patched, /attachHome\(app\);/);
  assert.equal(patchAppSource(patched), patched);
});
