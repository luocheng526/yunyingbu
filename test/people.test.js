import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/people/patch-app.js";
import { resetOrgBoard } from "../src/modules/people/org-board.js";
import { resetOrgExtra } from "../src/modules/people/org-extra.js";
import { hydrateFromMysql, resetPeopleStore } from "../src/modules/people/store.js";

const PRESET = [
  { name: "沈子晗", role: "经理", center: "沈子晗运营中心", status: "在职" },
  { name: "韩梦凯", role: "经理", center: "韩梦凯运营中心", status: "在职" },
  { name: "管理员", role: "经理", center: "人员管理", status: "在职" }
];

test.beforeEach(() => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
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

test("GET /people is content-only and uses shared xm shell", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/people`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(text, /<title>组织中心<\/title>/);
    assert.match(text, /href="\/shared\/layout\.css"/);
    assert.match(text, /src="\/shared\/nav\.js"/);
    assert.match(text, /id="site-nav"/);
    assert.match(text, /href="\/people\.css"/);
    assert.match(text, /shared\/modules\/people\.js/);
    const noticesJs = await fetch(`${base}/shared/modules/notices.js`);
    const noticesText = await noticesJs.text();
    assert.equal(noticesJs.status, 200);
    assert.match(noticesText, /员工晋升报/);
    assert.match(noticesText, /龙虎榜/);
    assert.match(noticesText, /价值观践行/);
    assert.match(noticesText, /日常公告/);
    const css = await fetch(`${base}/people.css`);
    const cssText = await css.text();
    assert.match(cssText, /max-height:\s*calc\(100vh - 250px\)/);
    assert.match(cssText, /overflow:\s*auto/);
    assert.doesNotMatch(text, /class="site-sidebar"/);
    assert.doesNotMatch(text, /<header class="site-header">/);
    assert.match(text, /组织中心/);

    const js = await fetch(`${base}/shared/modules/people.js`);
    const jsText = await js.text();
    assert.equal(js.status, 200);
    assert.match(jsText, /店铺主数据/);
    assert.match(jsText, /总负责人/);
    assert.match(jsText, /登录主账号/);
    assert.match(jsText, /全部团队/);
    assert.match(jsText, /双击单元格/);
    assert.doesNotMatch(jsText, /龙虎榜/);
    assert.doesNotMatch(jsText, /主数据治理/);
    assert.doesNotMatch(jsText, /全部公司/);
    assert.doesNotMatch(jsText, />缺口</);
  });
});

test("GET /api/people returns Shen-line roster and grants", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.demo, true);
    assert.equal(data.charter.agentAccess, "read-only");
    assert.ok(data.people.length >= 16);
    const wang = data.people.find((row) => row.name === "王博");
    assert.equal(wang.visibleShops.length, 2);
    const shops = await fetch(`${base}/api/people/shops`);
    const shopJson = await shops.json();
    assert.ok(shopJson.shops.some((row) => row.name === "RASW家居旗舰店"));
    const grants = await fetch(`${base}/api/people/grants`);
    const grantJson = await grants.json();
    assert.ok(grantJson.grants.length >= 18);
    for (const expected of PRESET) {
      const found = data.people.find((row) => row.name === expected.name);
      assert.deepEqual(
        {
          name: found.name,
          role: found.role,
          center: found.center,
          status: found.status,
          demo: found.demo
        },
        { ...expected, demo: true }
      );
    }
  });
});

test("GET /api/people/charter is read-only source rule", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people/charter`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.agentAccess, "read-only");
    assert.equal(data.sourceOfTruth.employment, "花名册");
    assert.match(data.sourceOfTruth.shopRights, /管辖/);
  });
});

test("org store board lists demo shops and supports add", async () => {
  await withServer(async (base) => {
    const listed = await fetch(`${base}/api/people/org/stores`);
    const listedJson = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(listedJson.ok, true);
    assert.ok(listedJson.stores.length >= 15);
    assert.ok(listedJson.stores.some((row) => row.storeName === "RASW家居旗舰店"));

    const created = await fetch(`${base}/api/people/org/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chief: "沈子晗组",
        lead: "张文静",
        owner: "验收同事",
        storeName: "验收旗舰店",
        merchantId: "19900001",
        remark: "5倍在做",
        login: "demo_ok",
        password: "Demo123!"
      })
    });
    const createdJson = await created.json();
    assert.equal(created.status, 201, JSON.stringify(createdJson));
    assert.equal(createdJson.store.storeName, "验收旗舰店");

    const patched = await fetch(`${base}/api/people/org/stores/${createdJson.store.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remark: "退店", closedOn: "9.9" })
    });
    const patchedJson = await patched.json();
    assert.equal(patched.status, 200);
    assert.equal(patchedJson.store.statusKey, "closed");

    const removed = await fetch(`${base}/api/people/org/stores/${createdJson.store.id}`, {
      method: "DELETE"
    });
    assert.equal(removed.status, 200);
  });
});

test("org board scopes edit by 责权", async () => {
  await withServer(async (base) => {
    const shen = await fetch(`${base}/api/people/org/stores?actor=${encodeURIComponent("沈子晗")}`);
    const shenJson = await shen.json();
    assert.equal(shenJson.scope, "shen");
    assert.ok(shenJson.stores.every((row) => row.chief.includes("沈子晗")));
    assert.ok(shenJson.stores.every((row) => row.canEdit));
    assert.ok(!shenJson.stores.some((row) => row.chief.includes("韩梦凯")));

    const hanStore = (await (await fetch(`${base}/api/people/org/stores`)).json()).stores.find((row) =>
      row.chief.includes("韩梦凯")
    );
    const denied = await fetch(`${base}/api/people/org/stores/${hanStore.id}?actor=${encodeURIComponent("沈子晗")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remark: "退店" })
    });
    assert.equal(denied.status, 403);

    const shenStore = shenJson.stores[0];
    const allowed = await fetch(`${base}/api/people/org/stores/${shenStore.id}?actor=${encodeURIComponent("沈子晗")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: "11001999" })
    });
    const allowedJson = await allowed.json();
    assert.equal(allowed.status, 200, JSON.stringify(allowedJson));
    assert.equal(allowedJson.store.merchantId, "11001999");

    const luo = await fetch(`${base}/api/people/org/stores/${hanStore.id}?actor=${encodeURIComponent("罗成")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: "luo_ok" })
    });
    assert.equal(luo.status, 200);
  });
});

test("org extras list leaderboard values and notices", async () => {
  await withServer(async (base) => {
    const board = await fetch(`${base}/api/people/org/board`);
    const boardJson = await board.json();
    assert.equal(board.status, 200);
    assert.ok(boardJson.people.some((row) => row.name === "王博" && row.stores >= 2));
    assert.ok(boardJson.teams.some((row) => row.name.includes("沈子晗")));

    const values = await fetch(`${base}/api/people/org/values`);
    assert.ok((await values.json()).items.length >= 3);

    const created = await fetch(`${base}/api/people/org/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "验收公告", body: "组织中心页签验收" })
    });
    assert.equal(created.status, 201);
    const listed = await fetch(`${base}/api/people/org/notices`);
    const listedJson = await listed.json();
    assert.ok(listedJson.items.some((row) => row.title === "验收公告"));
  });
});

test("POST /api/people appends a staff row", async () => {
  await withServer(async (base) => {
    const body = {
      name: "测试同事",
      role: "运营",
      center: "数据中心",
      status: "在职"
    };
    const created = await fetch(`${base}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const createdJson = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdJson.ok, true);
    assert.equal(createdJson.person.demo, false);
    assert.equal(createdJson.person.name, body.name);

    const listed = await fetch(`${base}/api/people`);
    const listedJson = await listed.json();
    assert.equal(listedJson.people.length, 17);
    assert.ok(listedJson.people.some((row) => row.name === "测试同事" && row.center === "数据中心"));
  });
});

test("POST /api/people rejects missing fields", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/people`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "无中心" })
    });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.ok, false);
  });
});

test("people store exports hydrateFromMysql for notes-store boot", async () => {
  assert.equal(typeof hydrateFromMysql, "function");
  const result = await hydrateFromMysql();
  assert.equal(result.ok, true);
  assert.equal(result.mode, "memory");
});

test("patchAppSource only inserts people router mount", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ peopleRouter \} from "\.\/modules\/people\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/people", peopleRouter\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});
