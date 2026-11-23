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
  setWeekStorePath
} from "../src/modules/home/week-report.js";
import { homeRouter } from "../src/modules/home/router.js";

const homeJs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/home.js"),
  "utf8"
);

test("week tab sits beside 实时 and keeps the five-times spreadsheet headers", () => {
  assert.match(homeJs, /label: "近七天业绩汇总"/);
  assert.match(homeJs, /function weekTableHtml/);
  assert.match(homeJs, /function drawWeekPng/);
  assert.match(homeJs, /一键发送图片/);
  assert.match(homeJs, /id="xm-hm-week"/);
  assert.match(homeJs, /data-week-send/);
  assert.match(homeJs, /拿店日期/);
  assert.match(homeJs, /店铺所在类目/);
  assert.match(homeJs, /推广费用占比/);
  assert.match(homeJs, /面板总业绩/);
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

test("week pack splits han and shen shops", () => {
  setWeekStorePath(join(osTmp(), "home-week-test.json"));
  resetWeekStore();
  setWeekStorePath(join(osTmp(), "home-week-test.json"));
  const pack = buildWeekPack(
    [
      { shopName: "韩店A", source: "han", liveAmount: 10 },
      { shopName: "沈店B", source: "shen", liveAmount: 20 }
    ],
    "2026-11-16"
  );
  assert.equal(pack.ok, true);
  assert.equal(pack.title, "甄选五倍业绩统计");
  const han = pack.teams.find((item) => item.key === "han");
  const shen = pack.teams.find((item) => item.key === "shen");
  assert.equal(han.rows.map((row) => row.shop).join(), "韩店A");
  assert.equal(shen.rows.map((row) => row.shop).join(), "沈店B");
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
    assert.equal(send.status, 401);
    assert.equal(sent.ok, false);
    assert.match(sent.error, /登录/);
  } finally {
    resetWeekStore();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("dingtalk webhook rejects non-ding hosts", async () => {
  const out = await postDingTalk({ webhook: "https://example.com/x", title: "t", text: "x" });
  assert.equal(out.ok, false);
});
