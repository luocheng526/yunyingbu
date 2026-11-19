const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicDir = path.resolve(__dirname, "../../public");
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

test("shared module exposes every required UI component", () => {
  const source = fs.readFileSync(jsPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);

  assert.ok(context.window.XmUI);
  requiredComponents.forEach((name) => {
    assert.equal(typeof context.window.XmUI[name], "function", `${name} must be exported`);
    assert.match(context.window.XmUI[name]({ title: "测试", label: "测试" }), /xm-ui-/);
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
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(jsPath, "utf8"), context);

  const output = context.window.XmUI.StatCard({
    label: '<img src=x onerror="alert(1)">',
    value: "<script>alert(1)</script>"
  });

  assert.doesNotMatch(output, /<script>|<img/);
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /&lt;img/);
});
