import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWeekSchedule } from "../src/modules/home/week-schedule.js";
import { collectWeekBi, weekBiCells } from "../src/modules/home/week-bi.js";
import { buildWeekColumns, cellKey, buildWeekPack, readWeekStore, saveWeekCells, setWeekStorePath } from "../src/modules/home/week-report.js";
import { inspectDayResponse } from "../src/modules/bound/shop-day.js";

const day = "2026-11-23";
const listed = [
  { shopName: "韩店", shopId: "123", platform: "JD" },
  { shopName: "沈店", shopId: "456", platform: "JD" }
];
const roster = [
  { store: "韩店", team: "韩梦凯", shopId: "123" },
  { store: "沈店", team: "沈子晗", shopId: "456" }
];
const key = (i, column) => cellKey(i ? "shen" : "han", roster[i].store, column);

test("only the requested BI shop-day report is accepted, with zero allowed and partial data held", async () => {
  let partial = true;
  const requested = [];
  const deps = {
    loadRoster: async () => roster,
    services: {
      discover: async () => ({ ok: true, owner: "account", shops: listed }),
      inspect: inspectDayResponse,
      async request(scope, owner) {
        assert.equal(owner, "account");
        assert.equal(scope.date, day);
        requested.push(scope.shopId);
        const second = scope.shopId === "456";
        return { httpStatus: 200, payload: { code: 0, data: { columnInfo: [], columnData: [
          { ...scope, gmv: second ? 0 : 100, tghf: second && partial ? null : second ? 0 : 21, profit: 30 }
        ] } } };
      }
    }
  };
  const first = await collectWeekBi(day, deps);
  assert.match(first.error, /沈店/);
  assert.deepEqual(Object.keys(first.records), ["JD:123"]);
  partial = false;
  const retry = await collectWeekBi(day, { ...deps, collectSaved: first.records });
  assert.equal(retry.error, "");
  assert.deepEqual(requested, ["123", "456", "456"]);
  const original = { [key(0, "mtd_2026-11-22")]: 10, [key(0, "gmv_2026-11-22")]: 55 };
  const cells = weekBiCells(day, retry.shops, retry.records, original);
  assert.equal(cells[key(0, "mtd_" + day)], 40);
  assert.equal(cells[key(0, "feeRate_" + day)], 0.21);
  assert.equal(cells[key(1, "gmv_" + day)], 0);
  assert.equal(cells[key(1, "feeRate_" + day)], 0);
  assert.equal(cells[key(0, "gmv_2026-11-22")], undefined);
  assert.equal(cells[key(0, "monthSpend_" + day)], undefined);
});

test("Shanghai time setting writes once per slot, retries only unsent targets, and persists across restarts", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "week-schedule-test-"));
  setWeekStorePath(path.join(directory, "table.json"));
  t.after(() => { setWeekStorePath(""); fs.rmSync(directory, { recursive: true, force: true }); });
  saveWeekCells({ cells: { [key(0, "gmv_2026-11-22")]: 55 } });
  let now = new Date("2026-11-24T08:00:00+08:00");
  let collections = 0, partial = true, failRecipient = true;
  const sends = [];
  const shops = [{ ...listed[0], team: "han", store: "韩店" }];
  const records = { "JD:123": { gmv: 500, fee: 25 } };
  const options = {
    directory, now: () => now,
    collect: async date => {
      assert.equal(date, day);
      collections++;
      return { shops, records, error: partial ? "店铺数据还未齐" : "" };
    },
    ding: {
      async automaticTargets() { return ["user-1", "user-2"].map(key => ({ destination: { key } })); },
      async send({ target, text }) {
        assert.match(text, /2026-11-23/);
        assert.equal(readWeekStore().cells[key(0, "gmv_" + day)], 500);
        sends.push(target.destination.key);
        if (target.destination.key === "user-2" && failRecipient) return { ok: false, definiteFailure: true };
        return { ok: true, status: "accepted" };
      }
    }
  };
  let schedule = createWeekSchedule(options);
  assert.equal(schedule.config().time, "09:00");
  assert.throws(() => schedule.saveConfig({ time: "25:30" }), /北京时间/);
  schedule.saveConfig({ time: "15:30" });
  now = new Date("2026-11-24T15:29:59+08:00");
  await schedule.tick();
  assert.equal(collections, 0);
  now = new Date("2026-11-24T15:30:00+08:00");
  await Promise.all([schedule.tick(), schedule.tick()]);
  assert.equal(collections, 1);
  assert.deepEqual(sends, []);
  assert.equal(readWeekStore().cells[key(0, "gmv_" + day)], undefined);
  partial = false;
  now = new Date("2026-11-24T15:45:00+08:00");
  await schedule.tick();
  assert.equal(schedule.config().lastRun.phase, "send");
  assert.deepEqual(sends, ["user-1", "user-2"]);

  schedule = createWeekSchedule(options);
  assert.equal(schedule.config().time, "15:30");
  failRecipient = false;
  now = new Date("2026-11-24T16:00:00+08:00");
  await schedule.tick();
  assert.equal(collections, 2);
  assert.deepEqual(sends, ["user-1", "user-2", "user-2"]);
  assert.equal(schedule.config().lastRun.phase, "complete");
  assert.equal(schedule.config().nextDate, "2026-11-25");
  schedule.saveConfig({ time: "16:01" });
  now = new Date("2026-11-24T16:01:00+08:00");
  await schedule.tick();
  assert.equal(collections, 3);
  assert.equal(sends.length, 3);

  const report = buildWeekPack(roster, "2026-11-24");
  assert.equal(report.days[0].ymd, "2026-11-17");
  assert.equal(report.days.at(-1).ymd, day);
  assert.equal(report.teams[0].rows[0].cells["gmv_2026-11-22"], 55);
  assert.equal(report.teams[0].kpis.find(kpi => kpi.key === "total").value, 500);
  assert.equal(buildWeekColumns("2026-12-01").days.at(-1).ymd, "2026-11-30");
});
