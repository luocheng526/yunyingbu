import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = readFileSync(join(root, "public/shared/modules/data.js"), "utf8");
const overview = readFileSync(join(root, "public/data-overview.js"), "utf8");

test("data.js always resets isolated boards and heals leftover goods on 数据总揽", () => {
  assert.match(data, /xm-module-data 0\.1\.630-data-pane-isolate/);
  assert.doesNotMatch(data, /restore-v1/);
  assert.match(data, /function resetDataPage\(/);
  assert.match(data, /id="board-' \+\s*kind \+\s*'"/);
  assert.match(data, /function healDataPanes\(/);
  assert.match(data, /function paneWrong\(/);
  assert.match(data, /商品数据总览/);
  assert.match(data, /data-overview\.js\?v=0\.1\.630-data-pane-isolate/);
  assert.match(data, /data-ops\.js\?v=data-ov36/);
  assert.match(data, /resetDataPage\(root, "overview"/);
  assert.match(data, /resetDataPage\(root, "shops"/);
  assert.match(data, /resetDataPage\(root, "goods"/);
  assert.doesNotMatch(data, /if \(root && !root\.querySelector\("#board"\)\)/);
  assert.match(data, /watchDataPanes\(\)/);
});

function makeNode(tag, attrs, html) {
  const node = {
    tagName: String(tag || "DIV").toUpperCase(),
    attrs: Object.assign({}, attrs),
    children: [],
    parent: null,
    classList: {
      contains: function (name) {
        return String((node.attrs.class || "") + " " + (node.attrs.className || ""))
          .split(/\s+/)
          .indexOf(name) >= 0;
      }
    },
    getAttribute: function (key) {
      return Object.prototype.hasOwnProperty.call(node.attrs, key) ? String(node.attrs[key]) : null;
    },
    setAttribute: function (key, value) {
      node.attrs[key] = String(value);
    },
    get textContent() {
      if (node._text != null) {
        return node._text;
      }
      return node.children.map(function (child) {
        return child.textContent || "";
      }).join("");
    },
    set textContent(value) {
      node._text = String(value);
      node.children = [];
    },
    get innerHTML() {
      return node._html || "";
    },
    set innerHTML(value) {
      node._html = String(value);
      node._text = String(value).replace(/<[^>]+>/g, "");
    },
    closest: function (sel) {
      let cur = node;
      while (cur) {
        if (matchSel(cur, sel)) {
          return cur;
        }
        cur = cur.parent;
      }
      return null;
    },
    querySelector: function (sel) {
      return walk(node, sel)[0] || null;
    },
    querySelectorAll: function (sel) {
      return walk(node, sel);
    }
  };
  if (html) {
    node.innerHTML = html;
  }
  return node;
}

function matchSel(el, sel) {
  if (!el || !sel) {
    return false;
  }
  return String(sel)
    .split(",")
    .map(function (part) {
      return part.trim();
    })
    .some(function (part) {
      if (part === ".xm-pane") {
        return String(el.attrs.class || "").indexOf("xm-pane") >= 0;
      }
      if (part.charAt(0) === "#") {
        return el.attrs.id === part.slice(1);
      }
      if (part.indexOf("[data-board=") === 0) {
        return el.attrs["data-board"] === part.replace(/^\[data-board="?([^"\]]+)"?\]$/, "$1");
      }
      if (part === "[data-xm-data-page]") {
        return Object.prototype.hasOwnProperty.call(el.attrs, "data-xm-data-page");
      }
      if (part === "[data-xm-href]") {
        return Object.prototype.hasOwnProperty.call(el.attrs, "data-xm-href");
      }
      if (part.indexOf('[data-xm-href="') === 0) {
        return el.attrs["data-xm-href"] === part.replace(/^\[data-xm-href="([^"]+)"\]$/, "$1");
      }
      return false;
    });
}

function walk(root, sel) {
  const out = [];
  (function visit(el) {
    el.children.forEach(function (child) {
      if (matchSel(child, sel)) {
        out.push(child);
      }
      visit(child);
    });
  })(root);
  if (root._html) {
    const html = root._html;
    if (/id="board-overview"/.test(html) && /#board-overview|data-board="overview"/.test(sel)) {
      const board = makeNode("div", { id: "board-overview", "data-board": "overview" });
      board.parent = root;
      out.push(board);
    }
    if (/data-xm-data-page="overview"/.test(html) && sel.indexOf("data-xm-data-page") >= 0) {
      const page = makeNode("main", { "data-xm-data-page": "overview" });
      page.parent = root;
      out.push(page);
    }
    if (/id="board-goods"|data-board="goods"/.test(html) && /board-goods|data-board="goods"/.test(sel)) {
      const board = makeNode("div", { id: "board-goods", "data-board": "goods" });
      board.parent = root;
      out.push(board);
    }
  }
  return out;
}

test("resetDataPage wipes leftover 商品数据总览 from the overview pane", () => {
  const start = data.indexOf("function resetDataPage");
  const end = data.indexOf("function pageKind");
  assert.ok(start > 0 && end > start);
  const escapeHtml = function (value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  };
  const resetDataPage = eval("(" + data.slice(start, end).trim().replace(/;$/, "") + ")");
  const pane = makeNode("div", { class: "xm-pane", "data-xm-href": "/data/overview" }, "");
  pane.innerHTML = '<main data-xm-data-page="goods"><div id="board-goods" class="ch-title">商品数据总览</div></main>';
  pane._text = "商品数据总览";
  resetDataPage(pane, "overview", "正在加载数据总览…");
  assert.match(pane.innerHTML, /data-xm-data-page="overview"/);
  assert.match(pane.innerHTML, /id="board-overview"/);
  assert.doesNotMatch(pane.innerHTML, /board-goods/);
  assert.doesNotMatch(pane.innerHTML, /商品数据总览/);
});

test("paneWrong sees leftover goods inside 数据总揽", () => {
  const start = data.indexOf("function paneWrong");
  const end = data.indexOf("function mountLiveDashboard");
  const pageKindStart = data.indexOf("function pageKind");
  assert.ok(start > 0 && end > start && pageKindStart > 0);
  const pageKind = eval("(" + data.slice(pageKindStart, start).trim().replace(/;$/, "") + ")");
  const paneWrong = eval("(" + data.slice(start, end).trim().replace(/;$/, "") + ")");
  const pane = makeNode("div", { class: "xm-pane", "data-xm-href": "/data/overview" });
  const page = makeNode("main", { "data-xm-data-page": "goods" });
  const board = makeNode("div", { id: "board-goods", "data-board": "goods" });
  board._text = "商品数据总览";
  page.children.push(board);
  board.parent = page;
  pane.children.push(page);
  page.parent = pane;
  assert.equal(paneWrong(pane, "overview"), true);
  const clean = makeNode("div", { class: "xm-pane", "data-xm-href": "/data/overview" });
  const ov = makeNode("main", { "data-xm-data-page": "overview" });
  clean.children.push(ov);
  ov.parent = clean;
  assert.equal(paneWrong(clean, "overview"), false);
});

test("overview keeps year-pick and only paints board-overview", () => {
  assert.match(overview, /xm-data-overview 0\.1\.630-data-pane-isolate/);
  assert.match(overview, /function calendarYearHtml\(/);
  assert.match(overview, /state\.range === "年"/);
  assert.match(overview, /function pageBoard\(/);
  assert.match(overview, /function resolveOverviewRoot\(/);
  assert.match(overview, /id="board-overview"/);
  assert.match(overview, /href === "\/data\/goods"/);
  assert.match(overview, /let board = pageBoard\(root\);/);
  assert.doesNotMatch(overview, /document\.getElementById\("board"\)/);
  assert.match(overview, /data-ov36|calYear/);
  assert.match(overview, /ch-title">数据总览/);
  assert.doesNotMatch(overview, /商品数据总览/);
});
