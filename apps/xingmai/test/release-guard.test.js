import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dangerousAppJsReason } from "../src/modules/releases/document.js";

const fullApp = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/app.js"), "utf8");

test("data tickets cannot include src/app.js", () => {
  const reason = dangerousAppJsReason({
    module: "数据中心",
    files: ["src/app.js", "src/modules/data/router.js"],
    contents: { "src/app.js": "export function createApp(){}" }
  });
  assert.match(reason, /禁止提交 src\/app\.js/);
});

test("thin app.js contents are rejected even from the gate module", () => {
  const reason = dangerousAppJsReason({
    module: "版本发布中心",
    files: ["src/app.js"],
    contents: { "src/app.js": "app.use('/api/data', dataRouter)" }
  });
  assert.match(reason, /瘦版本/);
});

test("full app.js contents are allowed for emergency restore", () => {
  const reason = dangerousAppJsReason({
    module: "版本发布中心",
    files: ["src/app.js"],
    contents: { "src/app.js": fullApp }
  });
  assert.equal(reason, "");
});
