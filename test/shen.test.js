import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/shen/patch-app.js";
import { SQL, hydrateFromMysql, resetStore, setPool } from "../src/modules/shen/store.js";
import { SHEN_LEGACY_REDIRECTS, SHEN_SUBMENUS } from "../src/modules/shen/submenu.js";

function createFakePool() {
  const tasks = [];
  let nextId = 1;
  let brief = "";
  const paid = [];
  let nextPaidId = 1;
  return {
    async query(sql, params = []) {
      if (
        sql === SQL.addStoreColumn ||
        sql === SQL.addCreatedAtColumn ||
        sql === SQL.createPaidTable ||
        sql === SQL.addPaidAccountColumn ||
        sql === SQL.addPaidOrdersColumn ||
        sql === SQL.addPaidJingmaiColumn ||
        sql === SQL.addPaidTotalOrderColumn ||
        sql === SQL.addPaidFeeRatioColumn ||
        sql === SQL.addPaidSuccessColumn
      ) {
        return [{}];
      }
      if (sql === SQL.listTasks) {
        return [tasks.map((task) => ({ ...task }))];
      }
      if (sql === SQL.insertTask) {
        const [title, status, owner, store] = params;
        const row = {
          id: nextId,
          title,
          status,
          owner,
          store,
          created_at: "2026-09-09 12:00:00"
        };
        nextId += 1;
        tasks.push(row);
        return [{ insertId: row.id, affectedRows: 1 }];
      }
      if (sql === SQL.summarizeTasks) {
        const [store, fromAt, toExclusiveAt] = params;
        const counts = new Map();
        for (const task of tasks) {
          if (task.store !== store) {
            continue;
          }
          if (task.created_at < fromAt || task.created_at >= toExclusiveAt) {
            continue;
          }
          counts.set(task.status, (counts.get(task.status) || 0) + 1);
        }
        return [[...counts.entries()].map(([status, cnt]) => ({ status, cnt }))];
      }
      if (sql === SQL.getBrief) {
        return [[{ text: brief }]];
      }
      if (sql === SQL.setBrief) {
        brief = params[0] ?? "";
        return [{ affectedRows: 1 }];
      }
      if (sql === SQL.resetTasks) {
        tasks.length = 0;
        nextId = 1;
        return [{}];
      }
      if (sql === SQL.resetBrief) {
        brief = "";
        return [{ affectedRows: 1 }];
      }
      if (sql === SQL.upsertPaid) {
        const [
          seq,
          store,
          accountId,
          day,
          spend,
          paidOrders,
          roi,
          cvr,
          cpc,
          jingmaiGmv,
          clicks,
          ctr,
          totalOrderAmount,
          realFeeRatio,
          successFlag,
          source
        ] = params;
        const key = `${store}\t${day}`;
        const row = {
          id: nextPaidId,
          seq,
          store,
          account_id: accountId,
          day,
          spend,
          paid_orders: paidOrders,
          roi,
          cvr,
          cpc,
          jingmai_gmv: jingmaiGmv,
          clicks,
          ctr,
          total_order_amount: totalOrderAmount,
          real_fee_ratio: realFeeRatio,
          success_flag: successFlag,
          source,
          ingested_at: "2026-09-15 12:00:00"
        };
        const idx = paid.findIndex((item) => `${item.store}\t${item.day}` === key);
        if (idx >= 0) {
          row.id = paid[idx].id;
          paid[idx] = row;
          return [{ insertId: row.id, affectedRows: 2 }];
        }
        nextPaidId += 1;
        paid.push(row);
        return [{ insertId: row.id, affectedRows: 1 }];
      }
      if (sql === SQL.listPaid) {
        const [allStores, store, fromDay, toDay, limit] = params;
        const rows = paid
          .filter((row) => (allStores === 1 || row.store === store) && row.day >= fromDay && row.day <= toDay)
          .sort((a, b) => (a.day === b.day ? (a.seq || 0) - (b.seq || 0) : a.day < b.day ? 1 : -1))
          .slice(0, Number(limit) || 200);
        return [rows.map((row) => ({ ...row }))];
      }
      if (sql === SQL.summarizePaid) {
        const [allStores, store, fromDay, toDay] = params;
        const rows = paid.filter(
          (row) => (allStores === 1 || row.store === store) && row.day >= fromDay && row.day <= toDay
        );
        const totals = {
          spend: 0,
          paid_orders: 0,
          jingmai_gmv: 0,
          clicks: 0,
          total_order_amount: 0,
          cnt: rows.length
        };
        for (const row of rows) {
          totals.spend += Number(row.spend) || 0;
          totals.paid_orders += Number(row.paid_orders) || 0;
          totals.jingmai_gmv += Number(row.jingmai_gmv) || 0;
          totals.clicks += Number(row.clicks) || 0;
          totals.total_order_amount += Number(row.total_order_amount) || 0;
        }
        return [[totals]];
      }
      throw new Error(`unexpected sql: ${sql}`);
    }
  };
}

async function withServer(fn) {
  setPool(createFakePool());
  await resetStore();
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function request(base, pathname, options = {}) {
  const res = await fetch(`${base}${pathname}`, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

test("GET /shen redirects to 产品中心", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/shen`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/shen/product");
  });
});

test("submenu pages use 产品中心 and 付费中心", async () => {
  await withServer(async (base) => {
    for (const item of SHEN_SUBMENUS) {
      const { res, text } = await request(base, item.href);
      assert.equal(res.status, 200, item.href);
      assert.match(text, new RegExp(item.label));
      assert.equal(text.includes("/shared/nav.js"), false, item.href);
      if (item.slug !== "tasks" && item.slug !== "paid") {
        assert.match(text, /内容待开发/);
      }
    }
    const tasks = await request(base, "/shen/tasks");
    assert.match(tasks.text, /任务列表/);
    assert.match(tasks.text, /今日简报/);
    assert.equal(tasks.text.includes("选品中心"), false);
    assert.equal(tasks.text.includes("商品成长"), false);
    assert.equal(tasks.text.includes("实时付费"), false);
    assert.equal(tasks.text.includes('id="site-nav"'), false);
    assert.equal(tasks.text.includes("site-sidebar"), false);
    assert.equal(productHasSecondNav(await request(base, "/shen/product")), false);
  });
});

function productHasSecondNav(page) {
  return page.text.includes('id="site-nav"') || page.text.includes("site-sidebar") || page.text.includes("运营部</a>");
}

test("shen module mounts product and paid content only", async () => {
  await withServer(async (base) => {
    const embed = await request(base, "/shared/modules/shen.js");
    assert.equal(embed.res.status, 200);
    assert.match(embed.text, /XmModules\["\/shen\/product"\]/);
    assert.match(embed.text, /XmModules\["\/shen\/product\/xuanpin"\]/);
    assert.match(embed.text, /XmModules\["\/shen\/product\/youhua"\]/);
    assert.match(embed.text, /XmModules\["\/shen\/product\/chengzhang"\]/);
    assert.match(embed.text, /XmModules\["\/shen\/paid"\]/);
    assert.match(embed.text, /\/api\/shen\/paid/);
    assert.match(embed.text, /京准通主账户ID/);
    assert.match(embed.text, /真实费比/);
    assert.match(embed.text, /是否成功/);
    assert.equal(embed.text.includes("表格行号"), false);
    assert.equal(embed.text.includes("模板行号"), false);
    assert.match(embed.text, /waitPage\("选品"\)/);
    assert.match(embed.text, /waitPage\("优化"\)/);
    assert.match(embed.text, /waitPage\("产品成长"\)/);
    assert.equal(embed.text.includes('waitPage("付费中心")'), false);
    assert.equal(embed.text.includes("relabelOfficialShenMenu"), false);
    assert.equal(embed.text.includes("MutationObserver"), false);
    assert.equal(embed.text.includes("shen-product-tab"), false);
    assert.equal(embed.text.includes("productCenterPage"), false);
    assert.equal(embed.text.includes("选品中心"), false);
    assert.equal(embed.text.includes("实时付费"), false);
    const product = await request(base, "/shen/product");
    assert.match(product.text, /产品中心/);
    assert.equal(product.text.includes("/shared/nav.js"), false);
    const xuanpin = await request(base, "/shen/product/xuanpin");
    assert.match(xuanpin.text, /选品/);
    assert.equal(xuanpin.text.includes("/shared/nav.js"), false);
    const selection = await request(base, "/shen/selection", { redirect: "manual" });
    assert.equal(selection.res.status, 302);
    assert.equal(selection.res.headers.get("location"), "/shen/product/xuanpin");
  });
});

test("legacy pinyin submenu paths redirect to official sider paths", async () => {
  await withServer(async (base) => {
    for (const item of SHEN_LEGACY_REDIRECTS) {
      const res = await fetch(`${base}${item.from}`, { redirect: "manual" });
      assert.equal(res.status, 302, item.from);
      assert.equal(res.headers.get("location"), item.to);
    }
  });
});

test("task CRUD persists across requests via store pool", async () => {
  await withServer(async (base) => {
    const empty = await request(base, "/api/shen/tasks");
    assert.equal(empty.res.status, 200);
    assert.deepEqual(empty.json.tasks, []);

    const missing = await request(base, "/api/shen/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   ", store: "旗舰店" })
    });
    assert.equal(missing.res.status, 400);

    const noStore = await request(base, "/api/shen/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "跟进今日达人排期" })
    });
    assert.equal(noStore.res.status, 400);
    assert.match(noStore.json.error, /店/);

    const created = await request(base, "/api/shen/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "跟进今日达人排期", store: "旗舰店" })
    });
    assert.equal(created.res.status, 201);
    assert.equal(created.json.title, "跟进今日达人排期");
    assert.equal(created.json.status, "待办");
    assert.equal(created.json.owner, "沈子晗");
    assert.equal(created.json.store, "旗舰店");

    const listed = await request(base, "/api/shen/tasks");
    assert.equal(listed.json.tasks.length, 1);
    assert.equal(listed.json.tasks[0].title, "跟进今日达人排期");
    assert.equal(listed.json.tasks[0].store, "旗舰店");
  });
});

test("read-only summary is store + date range aggregates only", async () => {
  await withServer(async (base) => {
    const missingStore = await request(base, "/api/shen/summary?from=2026-09-01&to=2026-09-09");
    assert.equal(missingStore.res.status, 400);
    assert.equal(missingStore.json.error, "必须指定店");

    const missingRange = await request(base, "/api/shen/summary?store=%E6%97%97%E8%88%B0%E5%BA%97");
    assert.equal(missingRange.res.status, 400);

    await request(base, "/api/shen/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "旗舰店排期", store: "旗舰店" })
    });
    await request(base, "/api/shen/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "专营店排期", store: "专营店" })
    });

    const summary = await request(
      base,
      "/api/shen/summary?store=%E6%97%97%E8%88%B0%E5%BA%97&from=2026-09-09&to=2026-09-09"
    );
    assert.equal(summary.res.status, 200);
    assert.deepEqual(summary.json, {
      ok: true,
      store: "旗舰店",
      from: "2026-09-09",
      to: "2026-09-09",
      tasks: { total: 1, byStatus: { 待办: 1, 进行中: 0, 已完成: 0 } }
    });
    assert.equal(JSON.stringify(summary.json).includes("旗舰店排期"), false);
    assert.equal(JSON.stringify(summary.json).includes("shen_tasks"), false);

    const otherDay = await request(
      base,
      "/api/shen/summary?store=%E6%97%97%E8%88%B0%E5%BA%97&from=2026-09-01&to=2026-09-08"
    );
    assert.equal(otherDay.json.tasks.total, 0);
  });
});

test("paid ingest upserts and lists by store + day", async () => {
  await withServer(async (base) => {
    const missing = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store: "旗舰店" })
    });
    assert.equal(missing.res.status, 400);
    assert.match(missing.json.error, /rows/);

    const asArray = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ 店铺名称: "数组店", date: "2026-09-14", 京准通花费: 1 }])
    });
    assert.equal(asArray.res.status, 201);
    assert.equal(asArray.json.received, 1);

    const noStore = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [{ date: "2026-09-15", spend: 10 }] })
    });
    assert.equal(noStore.res.status, 400);
    assert.match(noStore.json.error, /店铺名/);

    const created = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-15",
        source: "local",
        rows: [
          {
            店铺名称: "旗舰店",
            京准通主账户ID: "10001",
            京准通花费: 120.5,
            京准通付费订单数: 3,
            京准通付费投产比: 4.2,
            京准通付费转化率: 1.2,
            京准通平均点击成本: 3.01,
            京麦成交金额: 1200,
            京准通点击数: 40,
            京准通点击率: 2.5,
            京准通总订单金额: 880,
            真实费比: 8.1,
            是否成功: "成功"
          },
          {
            date: "2026-09-15",
            店铺名称: "专营店",
            京准通花费: 20,
            京准通点击数: 8,
            京麦成交金额: 80,
            京准通总订单金额: 50,
            是否成功: "失败"
          }
        ]
      })
    });
    assert.equal(created.res.status, 201);
    assert.equal(created.json.ok, true);
    assert.equal(created.json.received, 2);
    assert.equal(created.json.upserted, 2);

    const again = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-15",
        rows: [
          {
            店铺名称: "旗舰店",
            京准通花费: 200,
            京准通点击数: 50,
            京麦成交金额: 1300,
            京准通总订单金额: 900,
            京准通付费投产比: 4.5,
            是否成功: "是"
          }
        ]
      })
    });
    assert.equal(again.res.status, 201);

    const listed = await request(
      base,
      "/api/shen/paid?store=%E6%97%97%E8%88%B0%E5%BA%97&from=2026-09-15&to=2026-09-15"
    );
    assert.equal(listed.res.status, 200);
    assert.equal(listed.json.rows.length, 1);
    assert.equal(listed.json.rows[0].spend, 200);
    assert.equal(listed.json.rows[0].clicks, 50);
    assert.equal(listed.json.rows[0].jingmaiGmv, 1300);
    assert.equal(listed.json.rows[0].totalOrderAmount, 900);
    assert.equal(listed.json.rows[0].roi, 4.5);
    assert.equal(listed.json.rows[0].success, "是");
    assert.equal(listed.json.totals.spend, 200);
    assert.equal(JSON.stringify(listed.json).includes("shen_paid_daily"), false);

    const other = await request(base, "/api/shen/paid?store=%E4%B8%93%E8%90%A5%E5%BA%97&from=2026-09-15&to=2026-09-15");
    assert.equal(other.json.rows.length, 1);
    assert.equal(other.json.rows[0].spend, 20);
    assert.equal(other.json.rows[0].success, "否");

    const summary = await request(
      base,
      "/api/shen/paid/summary?store=%E6%97%97%E8%88%B0%E5%BA%97&from=2026-09-15&to=2026-09-15"
    );
    assert.equal(summary.res.status, 200);
    assert.equal(summary.json.paid.count, 1);
    assert.equal(summary.json.paid.spend, 200);
    assert.equal(summary.json.paid.totalOrderAmount, 900);
    assert.equal(summary.json.paid.jingmaiGmv, 1300);
  });
});

test("brief GET/PUT round-trip", async () => {
  await withServer(async (base) => {
    const initial = await request(base, "/api/shen/brief");
    assert.equal(initial.res.status, 200);
    assert.deepEqual(initial.json, { text: "" });

    const saved = await request(base, "/api/shen/brief", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "今日完成排期核对。" })
    });
    assert.equal(saved.res.status, 200);
    assert.equal(saved.json.text, "今日完成排期核对。");

    const loaded = await request(base, "/api/shen/brief");
    assert.equal(loaded.json.text, "今日完成排期核对。");
  });
});

test("store keeps hydrateFromMysql for live notes-store", async () => {
  assert.equal(typeof hydrateFromMysql, "function");
  setPool(createFakePool());
  resetStore();
  await hydrateFromMysql();
});

test("patchAppSource only inserts shen router mount", () => {
  const original = `import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}
`;
  const patched = patchAppSource(original);
  assert.match(patched, /import \{ shenRouter \} from "\.\/modules\/shen\/router\.js";/);
  assert.match(patched, /app\.use\("\/api\/shen", shenRouter\);\n  return app;/);
  assert.equal(patchAppSource(patched), patched);
});
