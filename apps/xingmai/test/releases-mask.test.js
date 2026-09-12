import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/shared/modules/releases.js"),
  "utf8"
);

test("failed publish always leaves a way to close the upgrade mask", () => {
  assert.match(src, /xm-module-releases 0\.1\.95-fail-close/);
  assert.match(src, /#upgrade-mask\.show #upgrade-dismiss/);
  assert.match(src, /#upgrade-mask\.can-close #upgrade-dismiss/);
  assert.match(src, /function confirmNeverStarted\(/);
  assert.match(src, /window\.__xmUpgradeCancel = true/);
  assert.match(src, /event\.key !== "Escape"/);
  assert.match(src, /升级未完成，可关闭后点下一单/);
  assert.match(src, /通过没有真正开始/);
  assert.doesNotMatch(src, /setUpgradeTitle\("正在升级，请勿关闭"\)/);
});
