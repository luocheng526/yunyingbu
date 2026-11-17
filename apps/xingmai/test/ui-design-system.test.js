import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { renderAppShell, withSharedShell } from "../src/modules/profile/middleware.js";
import { ticketGuardReason } from "../src/modules/releases/document.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const jsPath = path.join(publicDir, "shared/xm-ui.js");
const cssPath = path.join(publicDir, "shared/xm-ui.css");
const showcasePath = path.join(publicDir, "ui-design-system.html");

const requiredComponents = [
  "PageContentHeader",
  "StatCard",
  "ContentCard",
  "SectionTitle",
  "FilterToolbar",
  "DataTable",
  "StatusBadge",
  "ChartCard",
  "ProgressCard",
  "EmptyState"
];

function loadUi() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(jsPath, "utf8"), context);
  return context.window.XmUI;
}

test("shared module exposes every required UI component", () => {
  const ui = loadUi();
  assert.ok(ui);
  requiredComponents.forEach((name) => {
    assert.equal(typeof ui[name], "function", `${name} must be exported`);
    assert.match(ui[name]({ title: "测试", label: "测试" }), /xm-ui-/);
  });
});

test("shared CSS remains isolated from the application shell", () => {
  const css = fs.readFileSync(cssPath, "utf8");
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const forbiddenSelectors = [
    /(^|[},]\s*):root\b/m,
    /(^|[},]\s*)html\b/m,
    /(^|[},]\s*)body\b/m,
    /(^|[},]\s*)\*\s*[{,]/m,
    /(^|[},]\s*)(button|input|select|table)\b/m,
    /\.(header|sidebar|navigation|navbar|topbar)\b/i
  ];

  forbiddenSelectors.forEach((pattern) => {
    assert.doesNotMatch(cssWithoutComments, pattern);
  });

  const selectorBlocks = cssWithoutComments.match(/[^@{}][^{}]*\{/g) || [];
  selectorBlocks.forEach((block) => {
    const selector = block.slice(0, -1).trim();
    if (
      selector.startsWith("@") ||
      selector.startsWith("from") ||
      selector.startsWith("to") ||
      /^\d+%/.test(selector)
    ) {
      return;
    }
    selector.split(",").forEach((part) => {
      assert.match(part.trim(), /^\.xm-ui-scope\b/, `unscoped selector: ${part.trim()}`);
    });
  });
});

test("showcase imports shared assets and renders the full component set", () => {
  const html = fs.readFileSync(showcasePath, "utf8");

  assert.match(html, /\/shared\/xm-ui\.css/);
  assert.match(html, /\/shared\/xm-ui\.js/);
  assert.match(html, /class="xm-ui-scope xm-ui-showcase"/);
  requiredComponents.forEach((name) => {
    assert.match(html, new RegExp(`ui\\.${name}\\(`), `${name} must appear in showcase`);
  });
  assert.doesNotMatch(html, /academy\.html|shared\/layout\.css|\/api\//);
});

test("component output escapes user-provided text", () => {
  const ui = loadUi();
  const output = ui.StatCard({
    label: '<img src=x onerror="alert(1)">',
    value: "<script>alert(1)</script>"
  });

  assert.doesNotMatch(output, /<script>|<img/);
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /&lt;img/);
});

test("shell loads the content UI without restyling header, sidebar, or existing pages", () => {
  const shell = renderAppShell("/data", { username: "罗成", displayName: "罗成" });
  const uiAt = shell.indexOf("/shared/xm-ui.js");
  const moduleAt = shell.indexOf("/shared/modules/data.js");
  assert.ok(uiAt > 0 && moduleAt > uiAt);
  assert.match(shell, /\/shared\/xm-ui\.css\?v=/);
  assert.match(shell, /class="xm-topbar"/);
  assert.match(shell, /class="xm-shell"/);
  assert.match(shell, /class="xm-content xm-pane is-active"/);
  assert.doesNotMatch(shell, /xm-ui-scope/);
  assert.equal((shell.match(/\/shared\/xm-ui\.js/g) || []).length, 1);

  const login = withSharedShell('<html><head></head><body class="login-page"></body></html>');
  assert.doesNotMatch(login, /xm-ui\.(?:css|js)/);
  assert.doesNotMatch(login, /\/shared\/nav\.js/);

  const showcase = withSharedShell(fs.readFileSync(showcasePath, "utf8"));
  assert.match(showcase, /\/shared\/xm-ui\.css\?v=/);
  assert.doesNotMatch(showcase, /\/shared\/nav\.js/);
  assert.doesNotMatch(showcase, /\/shared\/layout\.css/);
});

test("business modules cannot overwrite the shared content UI", () => {
  const reason = ticketGuardReason({
    module: "数据中心",
    files: ["public/shared/xm-ui.css", "docs/XM_UI_DESIGN_SYSTEM.md"]
  });
  assert.match(reason, /禁止提交全站壳文件/);
  assert.equal(
    ticketGuardReason({
      module: "主框架",
      files: ["public/shared/xm-ui.css", "public/shared/xm-ui.js", ".cursor/rules/xm-ui-design.mdc"]
    }),
    ""
  );
});
