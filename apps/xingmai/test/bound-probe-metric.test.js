/* global structuredClone */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyProbeMetric } from "../src/modules/bound/probe-metric.js";
import { saveProbeRecord, singleProbeStatus } from "../src/modules/bound/probe.js";
import { listSheetHeads, resetBoundStore } from "../src/modules/bound/persist.js";

// Minimal excerpt of the real, user-authorized single-shop request; no login material.
const captured = JSON.parse(readFileSync(new URL("../src/modules/bound/notes/single-shop-live-sample.json", import.meta.url), "utf8"));
const sample = () => structuredClone(captured);

test("真实样本映射 gmv 并与页面核对，不误用代发单明细中的小数", () => {
  const record = sample();
  const metric = verifyProbeMetric(record);
  assert.equal(metric.value, "3759");
  assert.equal(metric.displayValue, "3,759");
  assert.equal(metric.matchesPage, true);
  assert.notEqual(metric.value, record.sample.row.lstGmv[0].cost);
  assert.equal(metric.precision, "as_returned_by_operating_table");
});

test("字段口径、日期或请求范围不符时拒绝核验，不凑成页面金额", () => {
  for (const mutate of [
    record => { record.sample.columns[0].columnName = "净销售额(支付)"; },
    record => { record.sample.columns[0].note = "另一个口径"; },
    record => { record.sample.columns.push(record.sample.columns[0]); },
    record => { record.sample.row.date = "2026/11/18"; },
    record => { record.request.body.shopId = "other-shop"; },
    record => { record.request.body.queryType = 1; },
    record => { record.sample.row.gmv = "--"; },
    record => { record.sample.row.gmv = ""; }
  ]) {
    const record = sample();
    mutate(record);
    assert.equal(verifyProbeMetric(record), null);
  }
  const precise = sample();
  precise.sample.row.gmv = "3759.4";
  assert.equal(verifyProbeMetric(precise).value, "3759.4");
  assert.equal(verifyProbeMetric(precise).displayValue, "3,759.4");
  assert.equal(verifyProbeMetric(precise).matchesPage, false);
  const zero = sample();
  zero.sample.row.gmv = "0";
  zero.target.pageDisplay = "0";
  assert.equal(verifyProbeMetric(zero).matchesPage, true);
});

test("核对结果写入试采记录后回读一致，重复核验不生成正式汇总", async () => {
  resetBoundStore();
  const first = await saveProbeRecord(sample());
  const second = await saveProbeRecord(sample());
  assert.deepEqual(first, second);
  assert.equal(first.status, "metric_verified");
  assert.equal(first.metricVerified, true);
  assert.deepEqual((await singleProbeStatus()).last, first);
  assert.deepEqual(await listSheetHeads(), []);
  const changed = sample();
  changed.sample.row.gmv = "4000";
  const mismatch = await saveProbeRecord(changed);
  assert.equal(mismatch.metricVerified, false);
  assert.equal(mismatch.status, "metric_mismatch");
  resetBoundStore();
});
