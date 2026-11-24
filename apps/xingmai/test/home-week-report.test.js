import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  applyManualCells,
  buildWeekColumns,
  buildWeekPack,
  lastDays,
  mdLabel,
  postDingTalk,
  resetWeekStore,
  saveWeekCells,
  saveWeekShot,
  getWeekShot,
  seedRowsFromLive,
  seedRowsFromOrg,
  setWeekStorePath,
  weekTeamKey
} from "../src/modules/home/week-report.js";
import { homeRouter } from "../src/modules/home/router.js";
import { setJingmaiRequestOrigin } from "../src/modules/home/jingmai-runner.js";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

test("week tab sits beside 实时 and keeps the five-times spreadsheet headers", () => {
  assert.match(homeJs, /label: "近七天业绩汇总"/);
  assert.match(homeJs, /function weekTableHtml/);
  assert.match(homeJs, /function drawWeekPng/);
  assert.match(homeJs, /function weekMonthHead/);
  assert.match(homeJs, /一键发送图片/);
  assert.match(homeJs, /id="xm-hm-week"/);
  assert.match(homeJs, /data-week-send/);
  assert.match(homeJs, /拿店日期/);
  assert.match(homeJs, /店铺所在类目/);
  assert.match(homeJs, /推广费用占比/);
  assert.match(homeJs, /面板总业绩/);
  assert.match(homeJs, /is-banner/);
  assert.match(homeJs, /过万店铺/);
  assert.match(homeJs, /韩梦凯五倍店铺/);
  assert.match(homeJs, /month === 6 \|\| month >= 8/);
  assert.match(homeJs, /xm-hm-week-head/);
  assert.match(homeJs, /function weekBarKpis/);
  assert.match(homeJs, /运营店铺数量/);
});

test("last seven day labels and crawler seed plus manual overlay", () => {
  const days = lastDays(7, "2026-11-16");
  assert.equal(days[0].ymd, "2026-11-10");
  assert.equal(days[6].label, mdLabel("2026-11-16"));
  const layout = buildWeekColumns("2026-11-16");
  const keys = layout.columns.map((col) => col.key);
  assert.equal(keys.includes("shop"), true);
  assert.equal(keys.includes("gmv_2026-11-10"), true);
  assert.equal(keys.includes("gmv_2026-11-16"), true);
  assert.equal(keys.includes("fee_2026-11-16"), true);
  assert.equal(keys.includes("feeRate_2026-11-14"), true);
  assert.equal(keys.includes("monthFee"), true);
  assert.equal(keys.includes("profit_01"), true);
  assert.equal(keys.includes("mtd_2026-11-15"), true);
  assert.equal(keys.includes("register"), true);
  assert.equal(keys.includes("marginMtd_2026-11-15"), true);
  assert.equal(keys.includes("marginMtd_2026-11-14"), false);
  const seeded = seedRowsFromLive(
    [
      { shopName: "DIKTT潮流生活旗舰店", source: "han", liveAmount: 11194, paidAmount: 2000 },
      { shopName: "沈店", source: "shen", liveAmount: 800 }
    ],
    "han",
    "2026-11-16"
  );
  assert.equal(seeded.length, 1);
  assert.equal(seeded[0].shop, "DIKTT潮流生活旗舰店");
  assert.equal(seeded[0].cells["gmv_2026-11-16"], 11194);
  const mixed = applyManualCells(seeded, { "han|DIKTT潮流生活旗舰店|stage": "稳定店铺33%-35%" }, "han");
  assert.equal(mixed[0].cells.stage, "稳定店铺33%-35%");
});

test("headers match the 甄选五倍业绩统计 spreadsheet on 2026-11-22", () => {
  const labels = buildWeekColumns("2026-11-22").columns.map((col) => col.label);
  assert.deepEqual(labels, [
    "拿店日期",
    "当月职级",
    "所属人",
    "店铺阶段",
    "店铺名称",
    "店铺所在类目",
    "11.16号",
    "11.17号",
    "11.18号",
    "11.19号",
    "11.20号",
    "11.21号",
    "11.22号",
    "11.20号推广费用",
    "11.21号推广费用",
    "11.22号推广费用",
    "11.20号推广费用占比",
    "11.21号推广费用占比",
    "11.22号推广费用占比",
    "当月费比",
    "1.1-1.31号利润",
    "2.1-2.28号利润",
    "3.1-3.31号利润",
    "4.1-4.30号利润",
    "5.1-5.31号利润",
    "6.1-30号利润",
    "7.1-7.31号利润",
    "8.1-31号利润",
    "9.1-30号利润",
    "10.1-31号利润",
    "11.1-17号利润",
    "11.1-18号利润",
    "11.1-19号利润",
    "11.1-20号利润",
    "11.1-21号利润",
    "5.1-5.31号大毛利率",
    "6.1-30号大毛利率",
    "7.1-7.31号大毛利率",
    "8.1-31号大毛利率",
    "9.1-30号大毛利率",
    "10.1-31号大毛利率",
    "11.1-21号大毛利率",
    "访客数",
    "订单数",
    "店铺上新数",
    "在售",
    "京仓SPU个数",
    "近15天退货率",
    "近30天退货率",
    "店铺所在类目",
    "本月推广总费用",
    "面板总业绩",
    "登记日期"
  ]);
});

test("week pack seeds operating org shops into han and shen", () => {
  setWeekStorePath(join(osTmp(), "home-week-test.json"));
  resetWeekStore();
  setWeekStorePath(join(osTmp(), "home-week-test.json"));
  assert.equal(weekTeamKey({ team: "精铺组 韩梦凯" }), "han");
  assert.equal(weekTeamKey({ team: "沈子晗组" }), "shen");
  const seeded = seedRowsFromOrg(
    [
      { store: "韩店A", team: "精铺组 韩梦凯", manager: "小韩", enabled: true },
      { store: "关店C", team: "精铺组 韩梦凯", manager: "小韩", enabled: false },
      { store: "停店D", team: "沈子晗组", manager: "小沈", statusKey: "closed" }
    ],
    "han"
  );
  assert.equal(seeded.length, 1);
  assert.equal(seeded[0].shop, "韩店A");
  assert.equal(seeded[0].cells.owner, "小韩");
  assert.equal(seeded[0].cells.gmv_2026, undefined);
  const pack = buildWeekPack(
    [
      { store: "韩店A", team: "精铺组 韩梦凯", manager: "小韩", enabled: true },
      { store: "沈店B", team: "沈子晗组", manager: "小沈", enabled: true },
      { store: "关店C", team: "精铺组 韩梦凯", manager: "小韩", enabled: false }
    ],
    "2026-11-16"
  );
  assert.equal(pack.ok, true);
  assert.equal(pack.title, "甄选五倍业绩统计");
  assert.equal(pack.source, "org+manual");
  const han = pack.teams.find((item) => item.key === "han");
  const shen = pack.teams.find((item) => item.key === "shen");
  assert.equal(han.rows.map((row) => row.shop).join(), "韩店A");
  assert.equal(shen.rows.map((row) => row.shop).join(), "沈店B");
  assert.equal(han.rows[0].cells.owner, "小韩");
  assert.equal(han.rows[0].cells["gmv_2026-11-16"], undefined);
  assert.equal(han.foot.map((item) => item.label).join(), "韩梦凯精铺组近七天业绩,无清洁统计,清洁统计");
  assert.equal(han.kpis.some((item) => item.key === "over10k"), true);
  resetWeekStore();
});

function osTmp() {
  return process.env.TMPDIR || "/tmp";
}

test("week-report route and png shot", async () => {
  const file = join(osTmp(), `home-week-route-${Date.now()}.json`);
  setWeekStorePath(file);
  resetWeekStore();
  setWeekStorePath(file);
  saveWeekCells({ cells: { "han|手工店|stage": "上升店铺35%" } });
  const app = express();
  app.use(express.json());
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/home/week-report`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.ok(json.columns.some((col) => col.key === "shop"));
    assert.ok(json.teams.some((team) => team.rows.some((row) => row.shop === "手工店")));
    const id = saveWeekShot(Buffer.from([137, 80, 78, 71]));
    const png = await fetch(`http://127.0.0.1:${port}/api/home/week-shot/${id}.png`);
    assert.equal(png.status, 200);
    assert.equal((await png.arrayBuffer()).byteLength, 4);
    const miss = await fetch(`http://127.0.0.1:${port}/api/home/week-shot/nope.png`);
    assert.equal(miss.status, 404);
    const send = await fetch(`http://127.0.0.1:${port}/api/home/week-send`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: Buffer.from("png-bytes")
    });
    const sent = await send.json();
    assert.equal(sent.ok, true);
    assert.equal(sent.sent, false);
    assert.match(String(sent.error || ""), /钉钉/);
  } finally {
    resetWeekStore();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("week-report route fills shops from organization center", async () => {
  const file = join(osTmp(), `home-week-org-${Date.now()}.json`);
  setWeekStorePath(file);
  resetWeekStore();
  setWeekStorePath(file);
  const app = express();
  app.get("/api/people/org/stores", (req, res) => {
    assert.match(String(req.headers.cookie || ""), /sid=org-week/);
    res.json({
      ok: true,
      stores: [
        { storeName: "韩店", team: "精铺组 韩梦凯", manager: "韩梦凯", statusKey: "operating" },
        { storeName: "沈店", team: "沈子晗组", manager: "沈子晗", statusKey: "operating" },
        { storeName: "停店", team: "精铺组 韩梦凯", manager: "韩梦凯", statusKey: "closed" }
      ]
    });
  });
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    setJingmaiRequestOrigin(`http://127.0.0.1:${port}`);
    const res = await fetch(`http://127.0.0.1:${port}/api/home/week-report`, {
      headers: { cookie: "sid=org-week" }
    });
    const json = await res.json();
    assert.equal(json.ok, true);
    const han = json.teams.find((team) => team.key === "han");
    const shen = json.teams.find((team) => team.key === "shen");
    assert.equal(han.rows.map((row) => row.shop).join(), "韩店");
    assert.equal(shen.rows.map((row) => row.shop).join(), "沈店");
    assert.equal(han.rows[0].cells.owner, "韩梦凯");
    assert.equal(han.rows[0].source, "org");
  } finally {
    setJingmaiRequestOrigin("");
    resetWeekStore();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("week-report route returns 401 when org center is not logged in", async () => {
  const app = express();
  app.get("/api/people/org/stores", (_req, res) => {
    res.status(401).json({ ok: false, error: "请先登录" });
  });
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    setJingmaiRequestOrigin(`http://127.0.0.1:${port}`);
    const res = await fetch(`http://127.0.0.1:${port}/api/home/week-report`);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.ok, false);
  } finally {
    setJingmaiRequestOrigin("");
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("dingtalk webhook rejects non-ding hosts", async () => {
  const out = await postDingTalk({ webhook: "https://example.com/x", title: "t", text: "x" });
  assert.equal(out.ok, false);
});
