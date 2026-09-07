import { test } from "node:test";
import assert from "node:assert/strict";
import { formatChinaTime, rewriteUtcStamp } from "../src/modules/home/china-time.js";

test("ISO UTC stamps render as Beijing time", () => {
  assert.equal(formatChinaTime("2026-09-07T10:35:56.251Z"), "2026-09-07 18:35:56");
  assert.equal(formatChinaTime("2026-01-01T16:00:00.000Z"), "2026-01-02 00:00:00");
});

test("rewriteUtcStamp converts visible UTC labels", () => {
  assert.equal(rewriteUtcStamp("2026-09-07 10:35:56 UTC"), "2026-09-07 18:35:56");
  assert.equal(rewriteUtcStamp("提交 2026-09-07T10:35:56Z"), "提交 2026-09-07 18:35:56");
  assert.equal(rewriteUtcStamp("2026-09-07 18:35:56"), "2026-09-07 18:35:56");
});