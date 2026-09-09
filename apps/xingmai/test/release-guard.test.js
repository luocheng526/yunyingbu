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
  assert.match(reason, /禁止提交 src\/app\.js/);
});

test("full app.js contents are allowed for 主框架 restore", () => {
  const reason = dangerousAppJsReason({
    module: "主框架",
    files: ["src/app.js"],
    contents: { "src/app.js": fullApp }
  });
  assert.equal(reason, "");
});

test("thin app.js is rejected from 主框架", () => {
  const reason = dangerousAppJsReason({
    module: "主框架",
    files: ["src/app.js"],
    contents: { "src/app.js": "app.use('/api/data', dataRouter)" }
  });
  assert.match(reason, /瘦版本/);
});

test("server.js is kernel-only", () => {
  const reason = ticketGuardReason({
    module: "数据中心",
    files: ["src/server.js"]
  });
  assert.match(reason, /禁止提交内核文件/);
});

test("auth.js is locked to 主框架 or 个人中心", () => {
  const reason = ticketGuardReason({
    module: "首页",
    files: ["src/modules/profile/auth.js"]
  });
  assert.match(reason, /禁止提交 src\/modules\/profile\/auth\.js/);
});

test("pages.js and middleware.js must ship together", () => {
  const reason = ticketGuardReason({
    module: "主框架",
    files: ["src/modules/home/pages.js"]
  });
  assert.match(reason, /成套提交/);
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

test("homepage cannot submit shell files", () => {
  const reason = ticketGuardReason({
    module: "首页",
    files: ["public/shared/nav.js", "public/index.html"]
  });
  assert.match(reason, /禁止提交全站壳文件/);
});

test("only 主框架 may submit shell files", () => {
  const reason = ticketGuardReason({
    module: "主框架",
    files: ["public/shared/nav.js", "public/shared/layout.css", "src/modules/home/nav-items.js"]
  });
  assert.equal(reason, "");
});
