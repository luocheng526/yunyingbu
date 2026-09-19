import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { patchAppSource } from "../src/modules/shen/patch-app.js";
import { SQL, hydrateFromMysql, resetStore, setPool } from "../src/modules/shen/store.js";
import { RULE_SQL, resetRechargeConfig } from "../src/modules/shen/recharge-config.js";
import { SHEN_LEGACY_REDIRECTS, SHEN_SUBMENUS } from "../src/modules/shen/submenu.js";

function asMysqlDate(day) {
  if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date(`${day}T00:00:00+08:00`);
  }
  return day;
}

function createFakePool() {
  const tasks = [];
  let nextId = 1;
  let brief = "";
  const paid = [];
  let nextPaidId = 1;
  const recharges = [];
  let nextRechargeId = 1;
  const subs = [];
  let nextSubId = 1;
  const enabled = [];
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
        sql === SQL.addPaidSuccessColumn ||
        sql === SQL.createRechargeTable ||
        sql === SQL.widenPaidRechargeChargedAt ||
        sql === SQL.addPaidRechargeSubIdColumn ||
        sql === SQL.addPaidRechargeSubNameColumn ||
        sql === SQL.createSubaccountTable ||
        sql === SQL.addPaidSubCapturedAtColumn ||
        sql === SQL.dropPaidSubUnique ||
        sql === SQL.addPaidSubUniqueWithCaptured ||
        sql === SQL.createEnabledStoreTable ||
        sql === SQL.addPaidRechargeConfigVersion ||
        sql === SQL.addPaidRechargeRuleCode ||
        sql === SQL.addPaidRechargePlannedRoi ||
        sql === SQL.addPaidRechargeExecSpend ||
        sql === SQL.addPaidRechargeExecRoi ||
        sql === SQL.addPaidRechargeExecOrders ||
        sql === SQL.addPaidRechargeResult ||
        sql === SQL.addPaidRechargeExecutionId ||
        sql === SQL.addPaidRechargeExecutionUnique ||
        sql === RULE_SQL.createRuleTable ||
        sql === RULE_SQL.createMetaTable ||
        sql === RULE_SQL.createHistoryTable ||
        sql === RULE_SQL.createOwnerTable ||
        sql === RULE_SQL.createMachineTable ||
        sql === RULE_SQL.addMachineRole ||
        sql === RULE_SQL.addMachineScope ||
        sql === RULE_SQL.createShopRunTable ||
        sql === RULE_SQL.addShopRunStoppingSince
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
      if (sql === SQL.listPaid || sql === SQL.listPaidLatest) {
        const [allStores, store, fromDay, toDay, limit] = params;
        let rows = paid.filter(
          (row) => (allStores === 1 || row.store === store) && row.day >= fromDay && row.day <= toDay
        );
        if (sql === SQL.listPaidLatest) {
          const latest = new Map();
          for (const row of rows) {
            const prev = latest.get(row.store);
            if (!prev || row.day > prev.day || (row.day === prev.day && row.id > prev.id)) {
              latest.set(row.store, row);
            }
          }
          rows = [...latest.values()].sort((a, b) => String(a.store).localeCompare(String(b.store), "zh"));
        } else {
          rows = rows.sort((a, b) => (a.day === b.day ? (a.seq || 0) - (b.seq || 0) : a.day < b.day ? 1 : -1));
        }
        return [rows.slice(0, Number(limit) || 200).map((row) => ({ ...row, day: asMysqlDate(row.day) }))];
      }
      if (sql === SQL.clearEnabledStores) {
        enabled.length = 0;
        return [{ affectedRows: 1 }];
      }
      if (sql === SQL.insertEnabledStore) {
        const [store, source] = params;
        const idx = enabled.findIndex((item) => item.store === store);
        const row = { store, source };
        if (idx >= 0) {
          enabled[idx] = row;
        } else {
          enabled.push(row);
        }
        return [{ affectedRows: 1 }];
      }
      if (sql === SQL.listEnabledStores) {
        return [enabled.map((row) => ({ ...row })).sort((a, b) => String(a.store).localeCompare(String(b.store), "zh"))];
      }
      if (sql === SQL.upsertRecharge) {
        const [
          store,
          accountId,
          subAccountId,
          subAccountName,
          day,
          chargedAt,
          amount,
          balance,
          channel,
          remark,
          source,
          configVersion,
          ruleCode,
          plannedRoi,
          execSpend,
          execRoi,
          execPaidOrders,
          resultFlag,
          executionId
        ] = params;
        const key = `${store}\t${day}\t${chargedAt}\t${Number(amount) || 0}`;
        const row = {
          id: nextRechargeId,
          store,
          account_id: accountId,
          sub_account_id: subAccountId,
          sub_account_name: subAccountName,
          day,
          charged_at: chargedAt,
          amount,
          balance,
          channel,
          remark,
          source,
          ingested_at: "2026-09-17 12:00:00",
          config_version: configVersion || 0,
          rule_code: ruleCode || "",
          planned_roi: plannedRoi || 0,
          exec_spend: execSpend || 0,
          exec_roi: execRoi || 0,
          exec_paid_orders: execPaidOrders || 0,
          result_flag: resultFlag || "",
          execution_id: executionId || ""
        };
        const byExec = executionId
          ? recharges.findIndex((item) => item.execution_id && item.execution_id === executionId)
          : -1;
        const idx =
          byExec >= 0
            ? byExec
            : recharges.findIndex(
                (item) => `${item.store}\t${item.day}\t${item.charged_at}\t${Number(item.amount) || 0}` === key
              );
        if (idx >= 0) {
          row.id = recharges[idx].id;
          recharges[idx] = row;
          return [{ insertId: row.id, affectedRows: 2 }];
        }
        nextRechargeId += 1;
        recharges.push(row);
        return [{ insertId: row.id, affectedRows: 1 }];
      }
      if (sql === SQL.upsertSubaccount) {
        const [
          store,
          accountId,
          subAccountId,
          subAccountName,
          day,
          capturedAt,
          balance,
          remark,
          spend,
          roi,
          paidOrders,
          totalOrderAmount,
          clicks,
          impressions,
          ctr,
          cpc,
          cpm,
          source
        ] = params;
        const key = `${day}\t${accountId}\t${subAccountId}\t${capturedAt || ""}`;
        const row = {
          id: nextSubId,
          store,
          account_id: accountId,
          sub_account_id: subAccountId,
          sub_account_name: subAccountName,
          day,
          captured_at: capturedAt || "",
          balance,
          remark,
          spend,
          roi,
          paid_orders: paidOrders,
          total_order_amount: totalOrderAmount,
          clicks,
          impressions,
          ctr,
          cpc,
          cpm,
          source,
          ingested_at: "2026-09-17 12:00:00"
        };
        const idx = subs.findIndex(
          (item) => `${item.day}\t${item.account_id}\t${item.sub_account_id}\t${item.captured_at || ""}` === key
        );
        if (idx >= 0) {
          row.id = subs[idx].id;
          subs[idx] = row;
          return [{ insertId: row.id, affectedRows: 2 }];
        }
        nextSubId += 1;
        subs.push(row);
        return [{ insertId: row.id, affectedRows: 1 }];
      }
      if (sql === SQL.listSubaccountIdentities) {
        const latest = new Map();
        for (const row of subs) {
          const key = `${row.store}\t${row.account_id}\t${row.sub_account_id}`;
          const prev = latest.get(key);
          if (!prev || Number(row.id) > Number(prev.id)) {
            latest.set(key, row);
          }
        }
        return [
          [...latest.values()].map((row) => ({
            store: row.store,
            account_id: row.account_id,
            sub_account_id: row.sub_account_id,
            sub_account_name: row.sub_account_name
          }))
        ];
      }
      if (sql === SQL.listSubaccount) {
        const [allStores, store, fromDay, toDay, limit] = params;
        const rows = subs
          .filter((row) => (allStores === 1 || row.store === store) && row.day >= fromDay && row.day <= toDay)
          .sort((a, b) => (a.day === b.day ? String(a.sub_account_name).localeCompare(String(b.sub_account_name)) : a.day < b.day ? 1 : -1))
          .slice(0, Number(limit) || 2000);
        return [rows.map((row) => ({ ...row, day: asMysqlDate(row.day) }))];
      }
      if (sql === SQL.listRecharge) {
        const [allStores, store, fromDay, toDay, limit] = params;
        const rows = recharges
          .filter((row) => (allStores === 1 || row.store === store) && row.day >= fromDay && row.day <= toDay)
          .sort((a, b) => (a.day === b.day ? b.id - a.id : a.day < b.day ? 1 : -1))
          .slice(0, Number(limit) || 200);
        return [rows.map((row) => ({ ...row, day: asMysqlDate(row.day) }))];
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
      if (
        sql === RULE_SQL.listRules ||
        sql === RULE_SQL.upsertRule ||
        sql === RULE_SQL.getMeta ||
        sql === RULE_SQL.upsertMeta ||
        sql === RULE_SQL.insertHistory ||
        sql === RULE_SQL.listHistory ||
        sql === RULE_SQL.listOwners ||
        sql === RULE_SQL.clearOwners ||
        sql === RULE_SQL.insertOwner ||
        sql === RULE_SQL.getMachine ||
        sql === RULE_SQL.listMachines ||
        sql === RULE_SQL.upsertMachine ||
        sql === RULE_SQL.listShopRuns ||
        sql === RULE_SQL.upsertShopRun
      ) {
        return null;
      }
      throw new Error(`unexpected sql: ${sql}`);
    }
  };
}

async function withServer(fn) {
  setPool(createFakePool());
  resetStore();
  resetRechargeConfig();
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
      if (item.slug === "recharge-rules") {
        assert.match(text, /\/shared\/nav\.js/);
        assert.match(text, /xm-app-shell/);
        assert.equal(text.includes("id=\"rules-root\""), false);
      } else {
        assert.equal(text.includes("/shared/nav.js"), false, item.href);
      }
      if (item.slug !== "tasks" && item.slug !== "paid" && item.slug !== "recharge-rules") {
        assert.match(text, /内容待开发/);
      }
    }
    const rulesPage = await request(base, "/shen/recharge-rules");
    assert.match(rulesPage.text, /充值规则/);
    assert.match(rulesPage.text, /\/shared\/nav\.js/);
    assert.match(rulesPage.text, /data-xm-mod="\/shen\/recharge-rules\/index.html"/);
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
    assert.match(embed.text, /XmModules\["\/shen\/recharge-rules"\]/);
    assert.match(embed.text, /\/api\/shen\/paid\/recharge-config/);
    assert.match(embed.text, /工作机运行店铺/);
    assert.match(embed.text, /保存运行状态/);
    assert.match(embed.text, /已开启/);
    assert.match(embed.text, /停止中/);
    assert.match(embed.text, /已停止/);
    assert.match(embed.text, /patch:\s*"run"/);
    assert.match(embed.text, /\/api\/shen\/paid/);
    assert.match(embed.text, /京准通主账户ID/);
    assert.match(embed.text, /真实费比/);
    assert.match(embed.text, /是否成功/);
    assert.match(embed.text, /kpi-grid/);
    assert.match(embed.text, /xm-paid-store/);
    assert.match(embed.text, /充值记录/);
    assert.match(embed.text, /子账号/);
    assert.match(embed.text, /\/api\/shen\/paid\/subaccounts/);
    assert.match(embed.text, /view=latest/);
    assert.match(embed.text, /启用店铺/);
    assert.match(embed.text, /含历史店铺/);
    assert.match(embed.text, /subAccountId/);
    assert.match(embed.text, /子账号名称/);
    assert.match(embed.text, /未记录/);
    assert.match(embed.text, /时间段/);
    assert.equal(embed.text.includes("<th>充值日期</th>"), false);
    assert.match(embed.text, /<th>子账号ID<\/th>/);
    assert.equal(embed.text.includes("<th>渠道</th>"), false);
    assert.equal(embed.text.includes('row.subAccountId || "—"'), false);
    assert.equal(embed.text.includes("row.accountId || row.subAccountId"), false);
    assert.match(embed.text, /jingmaiGmv: latest\.jingmaiGmv/);
    assert.equal(embed.text.includes("jingmaiGmv: (paid.metrics || {}).jingmaiGmv"), false);
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
    assert.match(missing.json.error, /rows|充值记录|启用店铺/);

    const asArray = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ 店铺名称: "数组店", date: "2026-09-14", 京准通花费: 1 }])
    });
    assert.equal(asArray.res.status, 201);
    assert.equal(asArray.json.received.rows, 1);
    assert.equal(asArray.json.received.subaccounts, 0);
    assert.equal(asArray.json.received.recharges, 0);

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
    assert.equal(created.json.received.rows, 2);
    assert.equal(created.json.upserted.rows, 2);
    assert.equal(created.json.received.subaccounts, 0);
    assert.equal(created.json.received.recharges, 0);

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

test("paid latest snapshot and store drill-down keep history plus recharges", async () => {
  await withServer(async (base) => {
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-16",
        rows: [{ 店铺名称: "旗舰店", 京准通花费: 80, 京麦成交金额: 400, 是否成功: "是" }]
      })
    });
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-17",
        rows: [
          {
            店铺名称: "旗舰店",
            京准通花费: 120,
            京麦成交金额: 600,
            是否成功: "是",
            充值记录: [{ 充值金额: 500, 充值时间: "10:00", 账户余额: 800, 渠道: "京准通" }]
          },
          { 店铺名称: "专营店", 京准通花费: 20, 是否成功: "否" }
        ]
      })
    });

    const latest = await request(base, "/api/shen/paid?view=latest");
    assert.equal(latest.res.status, 200);
    assert.equal(latest.json.view, "latest");
    assert.equal(latest.json.rows.length, 2);
    assert.equal(latest.json.asOf, "2026-09-17");
    const flagship = latest.json.rows.find((row) => row.store === "旗舰店");
    assert.equal(flagship.spend, 120);
    assert.equal(flagship.date, "2026-09-17");
    assert.equal(latest.json.metrics.stores, 2);
    assert.equal(latest.json.metrics.successCount, 1);

    const history = await request(base, "/api/shen/paid?store=%E6%97%97%E8%88%B0%E5%BA%97");
    assert.equal(history.json.rows.length, 2);
    assert.equal(history.json.rows[0].date, "2026-09-17");
    assert.equal(history.json.rows[1].date, "2026-09-16");
    assert.equal(history.json.rows[1].spend, 80);

    const recharges = await request(base, "/api/shen/paid/recharges?store=%E6%97%97%E8%88%B0%E5%BA%97");
    assert.equal(recharges.res.status, 200);
    assert.equal(recharges.json.rows.length, 1);
    assert.equal(recharges.json.rows[0].amount, 500);
    assert.equal(recharges.json.totals.amount, 500);
  });
});

test("paid subaccounts are stored apart from store totals and expand by day", async () => {
  await withServer(async (base) => {
    const created = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-16",
        rows: [{ 店铺名称: "旗舰店", 京准通主账户ID: "995225226", 京准通花费: 80, 是否成功: "是" }],
        子账号: [
          {
            店铺名称: "旗舰店",
            京准通主账户ID: "995225226",
            子账号ID: "A1",
            子账号名称: "投放1",
            花费: 50,
            投产比: 1.2,
            单量: 2,
            订单金额: 80,
            余额: 300
          }
        ]
      })
    });
    assert.equal(created.res.status, 201);
    assert.equal(created.json.received.subaccounts, 1);
    assert.equal(created.json.upserted.subaccounts, 1);

    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-17",
        rows: [{ 店铺名称: "旗舰店", 京准通主账户ID: "995225226", 京准通花费: 200, 是否成功: "是" }],
        子账号: [
          {
            京准通主账户ID: "995225226",
            子账号ID: "A1",
            子账号名称: "投放1",
            花费: 120,
            投产比: 1.8,
            单量: 4,
            订单金额: 220,
            余额: 180
          },
          {
            京准通主账户ID: "995225226",
            子账号ID: "A2",
            子账号名称: "投放2",
            花费: 80,
            单量: 1,
            订单金额: 40,
            余额: 90
          }
        ]
      })
    });

    const listed = await request(base, "/api/shen/paid?store=%E6%97%97%E8%88%B0%E5%BA%97&from=2026-09-17&to=2026-09-17");
    assert.equal(listed.json.rows.length, 1);
    assert.equal(listed.json.rows[0].spend, 200);

    const subs = await request(base, "/api/shen/paid/subaccounts?store=%E6%97%97%E8%88%B0%E5%BA%97");
    assert.equal(subs.res.status, 200);
    assert.equal(subs.json.accounts.length, 2);
    const first = subs.json.accounts.find((item) => item.subAccountId === "A1");
    assert.equal(first.latest.spend, 120);
    assert.equal(first.latest.date, "2026-09-17");
    assert.equal(first.days.length, 2);
    assert.equal(first.days[1].spend, 50);
    assert.equal(subs.json.totals.count, 2);
  });
});

test("paid subaccount rounds on the same day stay as separate snapshots", async () => {
  await withServer(async (base) => {
    const body = (capturedAt, spend) => ({
      date: "2026-09-17",
      抓取时间: capturedAt,
      rows: [{ 店铺名称: "旗舰店", 京准通主账户ID: "995225226", 京准通花费: spend, 是否成功: "采集成功" }],
      子账号: [
        {
          店铺名称: "旗舰店",
          京准通主账户ID: "995225226",
          子账号ID: "A1",
          子账号名称: "京选快1",
          花费: spend,
          抓取时间: capturedAt
        }
      ]
    });
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body("2026-09-17T10:00:00+08:00", 50))
    });
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body("2026-09-17T14:00:00+08:00", 80))
    });
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body("2026-09-17T14:00:00+08:00", 90))
    });
    const subs = await request(base, "/api/shen/paid/subaccounts?store=" + encodeURIComponent("旗舰店"));
    assert.equal(subs.json.accounts.length, 1);
    assert.equal(subs.json.accounts[0].days.length, 2);
    assert.equal(subs.json.accounts[0].latest.spend, 90);
    assert.equal(subs.json.accounts[0].latest.capturedAt, "2026-09-17T14:00:00+08:00");
    assert.equal(subs.json.accounts[0].days[1].spend, 50);
    assert.equal(subs.json.accounts[0].days[1].capturedAt, "2026-09-17T10:00:00+08:00");
  });
});

test("paid ingest keeps sibling counts, Shanghai dates, and recharge upserts", async () => {
  await withServer(async (base) => {
    const payload = {
      date: "2026-09-17",
      rows: [
        {
          店铺名称: "旗舰店",
          京准通主账户ID: 995225226,
          京准通花费: 120,
          京麦成交金额: 600,
          是否成功: "采集成功"
        },
        {
          店铺名称: "专营店",
          京准通主账户ID: "88002",
          京准通花费: 0,
          是否成功: "采集失败"
        }
      ],
      子账号: [
        {
          店铺名称: "旗舰店",
          京准通主账户ID: 995225226,
          子账号ID: 88001,
          子账号名称: "投放1",
          花费: 80
        }
      ],
      充值记录: [
        {
          店铺名称: "旗舰店",
          京准通主账户ID: "995225226",
          充值时间: "2026-09-17T09:30:00+08:00",
          充值金额: 500,
          账户余额: 1800
        }
      ]
    };

    const created = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    assert.equal(created.res.status, 201);
    assert.deepEqual(created.json.received, { rows: 2, subaccounts: 1, recharges: 1, enabledStores: 0 });
    assert.deepEqual(created.json.upserted, { rows: 2, subaccounts: 1, recharges: 1, enabledStores: 0 });

    const again = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        充值记录: [
          {
            店铺名称: "旗舰店",
            京准通主账户ID: "995225226",
            充值时间: "2026-09-17T01:30:00.000Z",
            充值金额: 500,
            账户余额: 1800
          }
        ]
      })
    });
    assert.equal(again.res.status, 201);
    assert.deepEqual(again.json.received, { rows: 2, subaccounts: 1, recharges: 1, enabledStores: 0 });

    const listed = await request(base, "/api/shen/paid?view=latest");
    assert.equal(listed.json.asOf, "2026-09-17");
    const flagship = listed.json.rows.find((row) => row.store === "旗舰店");
    const outlet = listed.json.rows.find((row) => row.store === "专营店");
    assert.equal(flagship.date, "2026-09-17");
    assert.equal(flagship.success, "是");
    assert.equal(flagship.accountId, "995225226");
    assert.equal(typeof flagship.accountId, "string");
    assert.equal(outlet.date, "2026-09-17");
    assert.equal(outlet.success, "否");

    const recharges = await request(base, "/api/shen/paid/recharges?store=%E6%97%97%E8%88%B0%E5%BA%97");
    assert.equal(recharges.json.rows.length, 1);
    assert.equal(recharges.json.rows[0].date, "2026-09-17");
    assert.equal(recharges.json.rows[0].chargedAt, "2026-09-17T09:30:00+08:00");
    assert.equal(recharges.json.rows[0].amount, 500);
    assert.equal(recharges.json.rows[0].balance, 1800);

    const subs = await request(base, "/api/shen/paid/subaccounts?store=%E6%97%97%E8%88%B0%E5%BA%97");
    assert.equal(subs.json.accounts.length, 1);
    assert.equal(subs.json.accounts[0].subAccountId, "88001");
    assert.equal(typeof subs.json.accounts[0].subAccountId, "string");
    assert.equal(subs.json.accounts[0].latest.date, "2026-09-17");
    assert.equal(subs.json.accounts[0].latest.spend, 80);
    assert.equal(subs.json.accounts[0].latest.clicks, 0);
  });
});

test("paid ingest keeps enabled-store roster and recharge subaccount target", async () => {
  await withServer(async (base) => {
    const enabled = [
      "DIKTT个护健康旗舰店",
      "HYEGIIR养生器械旗舰店",
      "MGXEK旗舰店",
      "RASW生活电器旗舰店",
      "SAWAAG生活日用旗舰店",
      "飒望居家旗舰店",
      "飒望旗舰店",
      "店八",
      "店九",
      "店十",
      "店十一"
    ];
    const history = [
      ...enabled.map((store) => ({ 店铺名称: store, 京准通花费: 10, 是否成功: "采集成功" })),
      { 店铺名称: "RASW护眼照明旗舰", 京准通花费: 2140.56, 京麦成交金额: 2572.89, 是否成功: "采集成功" },
      { 店铺名称: "RASW潮流生活京选菀瑶专卖店", 京准通花费: 20, 是否成功: "采集成功" }
    ];
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-09-17", rows: history })
    });
    const before = await request(base, "/api/shen/paid?view=latest");
    assert.equal(before.json.rows.length, 12);
    assert.equal(before.json.scope, "all");
    assert.equal(
      before.json.rows.some((row) => row.store === "RASW潮流生活京选菀瑶专卖店"),
      false
    );

    const roster = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-17",
        启用店铺: enabled,
        rows: enabled.map((store) => ({ 店铺名称: store, 京准通花费: 11, 是否成功: "采集成功" }))
      })
    });
    assert.equal(roster.res.status, 201);
    assert.equal(roster.json.received.enabledStores, 11);
    assert.deepEqual(roster.json.enabledStores, enabled);

    const latest = await request(base, "/api/shen/paid?view=latest");
    assert.equal(latest.json.scope, "enabled");
    assert.equal(latest.json.rows.length, 11);
    assert.equal(latest.json.metrics.stores, 11);
    assert.equal(
      latest.json.rows.some((row) => row.store === "RASW护眼照明旗舰" || row.store === "RASW潮流生活京选菀瑶专卖店"),
      false
    );

    const today = await request(base, "/api/shen/paid?from=2026-09-17&to=2026-09-17");
    assert.equal(today.json.rows.length, 11);

    const all = await request(base, "/api/shen/paid?view=latest&scope=all");
    assert.equal(all.json.scope, "all");
    assert.equal(all.json.rows.length, 12);
    assert.equal(all.json.rows.some((row) => row.store === "RASW护眼照明旗舰"), true);
    assert.equal(
      all.json.rows.some((row) => row.store === "RASW潮流生活京选菀瑶专卖店"),
      false
    );

    const historyStore = await request(
      base,
      "/api/shen/paid?store=" + encodeURIComponent("RASW护眼照明旗舰") + "&from=2026-09-17&to=2026-09-17"
    );
    assert.equal(historyStore.json.rows.length, 1);
    assert.equal(historyStore.json.rows[0].spend, 2140.56);

    const renamedStore = await request(
      base,
      "/api/shen/paid?store=" + encodeURIComponent("RASW潮流生活京选菀瑶专卖店") + "&from=2026-09-17&to=2026-09-17"
    );
    assert.equal(renamedStore.json.rows.length, 1);
    assert.equal(renamedStore.json.rows[0].spend, 20);

    const charged = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        充值记录: [
          {
            店铺名称: "DIKTT个护健康旗舰店",
            京准通主账户ID: "995225226",
            子账号ID: "88001",
            子账号名称: "投放1",
            充值时间: "2026-09-17T09:30:00+08:00",
            充值金额: 500,
            账户余额: 1800
          }
        ]
      })
    });
    assert.equal(charged.res.status, 201);
    assert.equal(charged.json.received.recharges, 1);

    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        充值记录: [
          {
            店铺名称: "DIKTT个护健康旗舰店",
            京准通主账户ID: "995225226",
            子账号ID: "88001",
            子账号名称: "投放1-回填",
            充值时间: "2026-09-17T09:30:00+08:00",
            充值金额: 500,
            账户余额: 1800
          }
        ]
      })
    });
    const recharges = await request(
      base,
      "/api/shen/paid/recharges?store=" + encodeURIComponent("DIKTT个护健康旗舰店")
    );
    assert.equal(recharges.json.rows.length, 1);
    assert.equal(recharges.json.totals.amount, 500);
    assert.equal(recharges.json.rows[0].accountId, "995225226");
    assert.equal(recharges.json.rows[0].subAccountId, "88001");
    assert.equal(recharges.json.rows[0].subAccountName, "投放1-回填");
    assert.notEqual(recharges.json.rows[0].subAccountId, recharges.json.rows[0].accountId);

    const alias = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        充值记录: [
          {
            店铺名称: "DIKTT个护健康旗舰店",
            京准通主账户ID: "995225226",
            子账户ID: "99002",
            子账户名称: "投放2",
            充值时间: "2026-09-17T10:00:00+08:00",
            充值金额: 80,
            账户余额: 100
          }
        ]
      })
    });
    assert.equal(alias.res.status, 201);
    const listed = await request(
      base,
      "/api/shen/paid/recharges?store=" + encodeURIComponent("DIKTT个护健康旗舰店")
    );
    const second = listed.json.rows.find((row) => row.amount === 80);
    assert.equal(second.accountId, "995225226");
    assert.equal(second.subAccountId, "99002");
    assert.equal(second.subAccountName, "投放2");

    const oldOnlyMain = listed.json.rows.find((row) => row.amount === 500);
    assert.equal(oldOnlyMain.subAccountId, "88001");

    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        充值记录: [
          {
            店铺名称: "DIKTT个护健康旗舰店",
            京准通主账户ID: "995225226",
            充值时间: "2026-09-17T11:00:00+08:00",
            充值金额: 1,
            账户余额: 2
          }
        ]
      })
    });
    const afterMainOnly = await request(
      base,
      "/api/shen/paid/recharges?store=" + encodeURIComponent("DIKTT个护健康旗舰店")
    );
    const unknown = afterMainOnly.json.rows.find((row) => row.amount === 1);
    assert.equal(unknown.accountId, "995225226");
    assert.equal(unknown.subAccountId, "");
    assert.equal(unknown.subAccountName, "");
    assert.equal(afterMainOnly.json.totals.count, 3);
    assert.equal(afterMainOnly.json.totals.amount, 581);
  });
});

test("paid latest overview hides renamed RASW store and stale asOf rows", async () => {
  await withServer(async (base) => {
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-15",
        rows: [
          {
            店铺名称: "RASW潮流生活京选菀瑶专卖店",
            京准通主账户ID: "99922484897",
            京准通花费: 3354.39,
            是否成功: "采集成功"
          },
          {
            店铺名称: "RASW护眼照明旗舰",
            京准通花费: 100,
            是否成功: "采集成功"
          }
        ]
      })
    });
    await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-09-17",
        rows: [
          {
            店铺名称: "RASW潮流生活旗舰店",
            京准通主账户ID: "99922484897",
            京准通花费: 0,
            是否成功: "采集成功"
          },
          {
            店铺名称: "RASW生活电器旗舰店",
            京准通花费: 14050.29,
            是否成功: "采集成功"
          }
        ]
      })
    });

    const latest = await request(base, "/api/shen/paid?view=latest");
    assert.equal(latest.res.status, 200);
    assert.equal(latest.json.asOf, "2026-09-17");
    assert.equal(latest.json.rows.length, 2);
    assert.equal(latest.json.metrics.stores, 2);
    assert.deepEqual(
      latest.json.rows.map((row) => row.store).sort(),
      ["RASW潮流生活旗舰店", "RASW生活电器旗舰店"]
    );
    assert.equal(
      latest.json.rows.some((row) => row.store === "RASW潮流生活京选菀瑶专卖店" || row.date === "2026-09-15"),
      false
    );

    const withHistory = await request(base, "/api/shen/paid?view=latest&scope=all");
    assert.equal(
      withHistory.json.rows.some((row) => row.store === "RASW潮流生活京选菀瑶专卖店"),
      false
    );

    const named = await request(
      base,
      "/api/shen/paid?store=" + encodeURIComponent("RASW潮流生活京选菀瑶专卖店")
    );
    assert.equal(named.json.rows.length, 1);
    assert.equal(named.json.rows[0].date, "2026-09-15");
    assert.equal(named.json.rows[0].spend, 3354.39);
    assert.equal(named.json.rows[0].accountId, "99922484897");
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

function shenHeaders(user = "沈子晗", role = "超级管理员", scope = "全平台数据") {
  return {
    "Content-Type": "application/json",
    "x-shen-user": encodeURIComponent(user),
    "x-shen-role": encodeURIComponent(role),
    "x-shen-scope": encodeURIComponent(scope)
  };
}

async function seedRechargeShops(base) {
  const created = await request(base, "/api/shen/paid/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "2026-09-18",
      rows: [
        { 店铺名称: "飒望旗舰店", 京准通主账户ID: "99931330021", 京准通花费: 10, 是否成功: "采集成功" },
        { 店铺名称: "专营店", 京准通主账户ID: "88002", 京准通花费: 5, 是否成功: "采集成功" }
      ],
      子账号: [
        {
          店铺名称: "飒望旗舰店",
          京准通主账户ID: "99931330021",
          子账号ID: "99945558065",
          子账号名称: "飒望旗舰-测试放大2",
          花费: 8
        },
        {
          店铺名称: "飒望旗舰店",
          京准通主账户ID: "99931330021",
          子账号ID: "99945558066",
          子账号名称: "飒望旗舰-测试放大3",
          花费: 2
        },
        {
          店铺名称: "专营店",
          京准通主账户ID: "88002",
          子账号ID: "88002001",
          子账号名称: "专营投放1",
          花费: 5
        }
      ]
    })
  });
  assert.equal(created.res.status, 201);
}

test("recharge rules editor, worker pull, ack, permissions and executionId", async () => {
  await withServer(async (base) => {
    await seedRechargeShops(base);

    const editor = await request(base, "/api/shen/paid/recharge-config/editor", {
      headers: shenHeaders()
    });
    assert.equal(editor.res.status, 200);
    assert.equal(editor.json.ok, true);
    assert.equal(editor.json.version, 0);
    assert.equal(editor.json.rows.length, 3);
    const first = editor.json.rows.find((row) => row.subAccountId === "99945558065");
    assert.equal(first.store, "飒望旗舰店");
    assert.equal(first.accountId, "99931330021");
    assert.equal(typeof first.accountId, "string");
    assert.equal(first.autoRecharge, true);
    assert.equal(first.plannedRoi, 2);
    assert.equal(first.tier1MinSpend, 1);
    assert.equal(first.tier1MaxSpend, 1000);
    assert.equal(first.tier1Balance, 100);
    assert.equal(first.tier1Amount, 100);
    assert.equal(first.tier2MinSpend, 1000);
    assert.equal(first.tier2Balance, 50);
    assert.equal(first.tier2Amount, 150);
    assert.equal(first.roiRiseAmount, 100);
    assert.equal(first.noOrderTimes, 3);
    assert.equal(first.pauseMinutes, 30);
    assert.equal(first.syncStatus, "待同步");
    assert.equal(editor.json.defaults.plannedRoi, 2);

    const saved = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        changeSummary: "保存充值规则",
        rows: [
          {
            店铺名称: "飒望旗舰店",
            京准通主账户ID: "99931330021",
            子账号ID: "99945558065",
            子账号名称: "飒望旗舰-测试放大2",
            自动充值: true,
            计划ROI: 2.3
          },
          {
            店铺名称: "飒望旗舰店",
            京准通主账户ID: "99931330021",
            子账号ID: "99945558066",
            子账号名称: "飒望旗舰-测试放大3",
            自动充值: true,
            计划ROI: 1.8
          }
        ]
      })
    });
    assert.equal(saved.res.status, 200, saved.text);
    assert.equal(saved.json.ok, true);
    assert.equal(saved.json.version, 1);
    assert.equal(saved.json.saved, 2);
    assert.equal(saved.json.updatedBy, "沈子晗");

    const roiOnly = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        patch: "roi",
        changeSummary: "批量设置计划ROI",
        rows: [
          {
            店铺名称: "飒望旗舰店",
            京准通主账户ID: "99931330021",
            子账号ID: "99945558065",
            计划ROI: 2.5,
            第一档充值金额: 999
          }
        ]
      })
    });
    assert.equal(roiOnly.res.status, 200);
    assert.equal(roiOnly.json.version, 2);

    const afterRoi = await request(base, "/api/shen/paid/recharge-config/editor?store=" + encodeURIComponent("飒望旗舰店"), {
      headers: shenHeaders()
    });
    const kept = afterRoi.json.rows.find((row) => row.subAccountId === "99945558065");
    assert.equal(kept.plannedRoi, 2.5);
    assert.equal(kept.tier1Amount, 100);
    assert.equal(afterRoi.json.rows.find((row) => row.subAccountId === "99945558066").plannedRoi, 1.8);

    const history = await request(base, "/api/shen/paid/recharge-config/history?store=" + encodeURIComponent("飒望旗舰店"), {
      headers: shenHeaders()
    });
    assert.equal(history.res.status, 200);
    assert.equal(history.json.rows.some((row) => row.field === "计划ROI" && row.newValue === "2.5" && row.version === 2), true);
    assert.equal(history.json.rows.every((row) => row.store === "飒望旗舰店"), true);

    const scientific = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        rows: [
          {
            店铺名称: "飒望旗舰店",
            京准通主账户ID: "9.99e10",
            子账号ID: "99945558065",
            计划ROI: 2
          }
        ]
      })
    });
    assert.equal(scientific.res.status, 400);
    assert.match(scientific.json.error, /字符串|科学计数/);

    const negative = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        rows: [
          {
            店铺名称: "飒望旗舰店",
            京准通主账户ID: "99931330021",
            子账号ID: "99945558065",
            计划ROI: -1
          }
        ]
      })
    });
    assert.equal(negative.res.status, 400);
    assert.match(negative.json.error, /负数/);

    const zeroRoi = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        rows: [
          {
            店铺名称: "飒望旗舰店",
            京准通主账户ID: "99931330021",
            子账号ID: "99945558065",
            自动充值: true,
            计划ROI: 0
          }
        ]
      })
    });
    assert.equal(zeroRoi.res.status, 400);
    assert.match(zeroRoi.json.error, /计划ROI必须大于0/);

    const badRange = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        rows: [
          {
            店铺名称: "飒望旗舰店",
            京准通主账户ID: "99931330021",
            子账号ID: "99945558065",
            第一档花费下限: 1000,
            第一档花费上限: 1000
          }
        ]
      })
    });
    assert.equal(badRange.res.status, 400);
    assert.match(badRange.json.error, /上限必须大于/);

    await request(base, "/api/shen/paid/recharge-config/owners", {
      method: "POST",
      headers: shenHeaders(),
      body: JSON.stringify({ username: "小王", stores: ["飒望旗舰店"] })
    });
    const forbidden = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders("小王", "运营", "本店"),
      body: JSON.stringify({
        rows: [
          {
            店铺名称: "专营店",
            京准通主账户ID: "88002",
            子账号ID: "88002001",
            计划ROI: 1
          }
        ]
      })
    });
    assert.equal(forbidden.res.status, 403);
    assert.match(forbidden.json.error, /无权/);

    const scoped = await request(base, "/api/shen/paid/recharge-config/editor", {
      headers: shenHeaders("小王", "运营", "本店")
    });
    assert.equal(scoped.json.scope, "assigned");
    assert.deepEqual(scoped.json.shops, ["飒望旗舰店"]);
    assert.equal(scoped.json.rows.every((row) => row.store === "飒望旗舰店"), true);

    const worker = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=0",
      { headers: shenHeaders() }
    );
    assert.equal(worker.res.status, 200);
    assert.equal(worker.json.changed, true);
    assert.equal(worker.json.version, 2);
    assert.equal(typeof worker.json.shops[0].京准通主账户ID, "string");
    const sawa = worker.json.shops.find((shop) => shop.店铺名称 === "飒望旗舰店");
    const sub = sawa.子账号.find((item) => item.子账号ID === "99945558065");
    assert.equal(sub.计划ROI, 2.5);
    assert.equal(sub.第一档充值金额, 100);
    assert.equal(sub.自动充值, true);
    assert.equal(sawa.启用, true);
    assert.equal(worker.json.machineId, "paid-worker-01");
    assert.deepEqual(worker.json.runShops.sort(), ["专营店", "飒望旗舰店"]);

    const runSaved = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        patch: "run",
        changeSummary: "保存运行状态",
        runShops: ["飒望旗舰店"]
      })
    });
    assert.equal(runSaved.res.status, 200);
    assert.equal(runSaved.json.version, 3);
    assert.deepEqual(runSaved.json.runShops, ["飒望旗舰店"]);

    const runEditor = await request(base, "/api/shen/paid/recharge-config/editor", {
      headers: shenHeaders()
    });
    assert.equal(runEditor.json.runListSaved, true);
    assert.deepEqual(runEditor.json.runShops, ["飒望旗舰店"]);
    assert.equal(runEditor.json.shopRuns.find((row) => row.store === "专营店").enabled, false);
    assert.equal(runEditor.json.shopRuns.find((row) => row.store === "飒望旗舰店").status, "已开启");
    assert.equal(runEditor.json.shopRuns.find((row) => row.store === "专营店").status, "停止中");
    assert.equal(runEditor.json.syncStatus, "待同步");

    const stopAck = await request(base, "/api/shen/paid/recharge-config/ack", {
      method: "POST",
      headers: shenHeaders(),
      body: JSON.stringify({
        machineId: "paid-worker-01",
        version: 3,
        status: "success",
        receivedAt: "2026-09-18T23:54:00+08:00",
        message: "已校验并启用3版规则"
      })
    });
    assert.equal(stopAck.json.status, "已同步");
    const afterStopAck = await request(base, "/api/shen/paid/recharge-config/editor", {
      headers: shenHeaders()
    });
    assert.equal(afterStopAck.json.syncStatus, "已同步");
    assert.equal(afterStopAck.json.shopRuns.find((row) => row.store === "专营店").status, "已停止");
    assert.equal(afterStopAck.json.shopRuns.find((row) => row.store === "飒望旗舰店").status, "已开启");

    const runWorker = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=0",
      { headers: shenHeaders() }
    );
    assert.deepEqual(runWorker.json.runShops, ["飒望旗舰店"]);
    assert.deepEqual(
      runWorker.json.shops.map((shop) => shop.店铺名称),
      ["飒望旗舰店"]
    );

    const emptyRun = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({ patch: "run", runShops: [] })
    });
    assert.equal(emptyRun.json.version, 4);
    assert.deepEqual(emptyRun.json.runShops, []);
    const emptyEditor = await request(base, "/api/shen/paid/recharge-config/editor", {
      headers: shenHeaders()
    });
    assert.equal(emptyEditor.json.shopRuns.find((row) => row.store === "飒望旗舰店").status, "停止中");
    assert.equal(emptyEditor.json.syncStatus, "待同步");
    const emptyWorker = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=0",
      { headers: shenHeaders() }
    );
    assert.deepEqual(emptyWorker.json.shops, []);
    assert.deepEqual(emptyWorker.json.runShops, []);

    const splitRun = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders(),
      body: JSON.stringify({
        patch: "run",
        shopRuns: [
          { 店铺名称: "飒望旗舰店", 启用: true, 执行机: "" },
          { 店铺名称: "专营店", 启用: true, 执行机: "paid-worker-02" }
        ]
      })
    });
    assert.equal(splitRun.json.version, 5);
    const firstMachine = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=0",
      { headers: shenHeaders() }
    );
    assert.deepEqual(firstMachine.json.runShops, ["飒望旗舰店"]);
    const secondMachine = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-02&sinceVersion=0",
      { headers: shenHeaders() }
    );
    assert.deepEqual(secondMachine.json.runShops.sort(), ["专营店", "飒望旗舰店"]);
    assert.equal(
      secondMachine.json.shops.find((shop) => shop.店铺名称 === "专营店").执行机,
      "paid-worker-02"
    );

    const wangRun = await request(base, "/api/shen/paid/recharge-config", {
      method: "PUT",
      headers: shenHeaders("小王", "运营", "本店"),
      body: JSON.stringify({ patch: "run", runShops: ["专营店"] })
    });
    assert.equal(wangRun.res.status, 403);

    const scopedWorker = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-wang&sinceVersion=0",
      { headers: shenHeaders("小王", "运营", "本店") }
    );
    assert.equal(scopedWorker.json.changed, true);
    assert.deepEqual(
      scopedWorker.json.shops.map((shop) => shop.店铺名称),
      ["飒望旗舰店"]
    );

    const unchanged = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=5",
      { headers: shenHeaders() }
    );
    assert.equal(unchanged.res.status, 200);
    assert.deepEqual(unchanged.json, {
      changed: false,
      version: 5,
      updatedAt: unchanged.json.updatedAt,
      machineId: "paid-worker-01"
    });

    const notModified = await request(
      base,
      "/api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=5&http304=1",
      { headers: shenHeaders() }
    );
    assert.equal(notModified.res.status, 304);

    const ack = await request(base, "/api/shen/paid/recharge-config/ack", {
      method: "POST",
      headers: shenHeaders(),
      body: JSON.stringify({
        machineId: "paid-worker-01",
        version: 5,
        status: "success",
        receivedAt: "2026-09-18T23:55:10+08:00",
        message: "已校验并启用5版规则"
      })
    });
    assert.equal(ack.res.status, 200);
    assert.equal(ack.json.status, "已同步");

    const synced = await request(base, "/api/shen/paid/recharge-config/editor", {
      headers: shenHeaders()
    });
    assert.equal(synced.json.syncStatus, "已同步");

    const failedAck = await request(base, "/api/shen/paid/recharge-config/ack", {
      method: "POST",
      headers: shenHeaders(),
      body: JSON.stringify({
        machineId: "paid-worker-01",
        version: 5,
        status: "failed",
        message: "子账号99945558065的计划ROI无效"
      })
    });
    assert.equal(failedAck.json.status, "同步失败");
    const failedEditor = await request(base, "/api/shen/paid/recharge-config/editor", {
      headers: shenHeaders()
    });
    assert.equal(failedEditor.json.syncStatus, "同步失败");

    const execBody = {
      充值记录: [
        {
          店铺名称: "飒望旗舰店",
          京准通主账户ID: "99931330021",
          子账号ID: "99945558065",
          子账号名称: "飒望旗舰-测试放大2",
          充值时间: "2026-09-18T10:12:00+08:00",
          充值金额: 100,
          executionId: "paid-worker-01-2-tier1-1",
          configVersion: 2,
          ruleCode: "tier1",
          plannedRoi: 2.5,
          execSpend: 860,
          execRoi: 2.41,
          execPaidOrders: 12,
          result: "success"
        }
      ]
    };
    const firstExec = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(execBody)
    });
    assert.equal(firstExec.res.status, 201);
    assert.equal(firstExec.json.received.recharges, 1);
    const retryExec = await request(base, "/api/shen/paid/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        充值记录: [
          {
            ...execBody.充值记录[0],
            充值时间: "2026-09-18T10:13:00+08:00",
            充值金额: 150
          }
        ]
      })
    });
    assert.equal(retryExec.res.status, 201);
    const listed = await request(base, "/api/shen/paid/recharges?store=" + encodeURIComponent("飒望旗舰店"));
    assert.equal(listed.json.rows.length, 1);
    assert.equal(listed.json.rows[0].executionId, "paid-worker-01-2-tier1-1");
    assert.equal(listed.json.rows[0].configVersion, 2);
    assert.equal(listed.json.rows[0].ruleCode, "tier1");
    assert.equal(listed.json.rows[0].plannedRoi, 2.5);
    assert.equal(listed.json.rows[0].execSpend, 860);
    assert.equal(listed.json.rows[0].result, "success");
    assert.equal(listed.json.rows[0].subAccountId, "99945558065");
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
