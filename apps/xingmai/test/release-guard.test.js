import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dangerousAppJsReason, ticketGuardReason } from "../src/modules/releases/document.js";

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

test("empty file list cannot full-sync", () => {
  const reason = ticketGuardReason({
    module: "版本发布中心",
    files: []
  });
  assert.match(reason, /禁止空文件列表全量落地/);
});

test("non-home modules cannot submit shell files", () => {
  const reason = ticketGuardReason({
    module: "数据中心",
    files: ["public/shared/nav.js", "src/modules/data/router.js"]
  });
  assert.match(reason, /禁止提交全站壳文件/);
});

test("releases module cannot submit shell files", () => {
  const reason = ticketGuardReason({
    module: "版本发布中心",
    files: ["public/shared/layout.css"]
  });
  assert.match(reason, /禁止提交全站壳文件/);
});

test("home module may submit shell files", () => {
  const reason = ticketGuardReason({
    module: "首页",
    files: ["public/shared/nav.js", "public/shared/layout.css", "src/modules/home/nav-items.js"]
  });
  assert.equal(reason, "");
});
