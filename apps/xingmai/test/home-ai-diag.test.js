import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadApi() {
  const src = readFileSync(join(root, "public/shared/nav.js"), "utf8");
  const block = src.match(/\/\* xm-home-ai-diag-begin \*\/([\s\S]*?)\/\* xm-home-ai-diag-end \*\//);
  assert.ok(block, "nav.js must keep the home AI diagnosis block");
  const sandbox = { window: {} };
  vm.runInNewContext(block[1], sandbox, { filename: "home-ai-diag.js" });
  assert.ok(sandbox.window.__xmHomeAiDiag);
  return sandbox.window.__xmHomeAiDiag;
}

function memoryStorage() {
  const bag = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
    },
    setItem(key, value) {
      bag[key] = String(value);
    }
  };
}

function fakeCard(spec) {
  const trend = {
    classList: {
      contains(name) {
        return (spec.dir === "down" && name === "is-down") || (spec.dir === "up" && name === "is-up");
      }
    },
    textContent: spec.pct == null ? "" : "环比 " + (spec.dir === "down" ? "↘" : "↗") + " " + Math.abs(spec.pct) + "%"
  };
  return {
    getAttribute(name) {
      if (name === "data-card") {
        return spec.key || "";
      }
      if (name === "data-team") {
        return spec.team || "";
      }
      return "";
    },
    closest(sel) {
      if (sel === ".xm-hm-team" && spec.team) {
        return {
          getAttribute(name) {
            return name === "data-team" ? spec.team : "";
          },
          querySelector(inner) {
            return inner === ".xm-hm-team-head h2" ? { textContent: (spec.teamName || spec.team) + "团队" } : null;
          }
        };
      }
      return null;
    },
    querySelector(sel) {
      if (sel === ".xm-hm-card-head span") {
        return { textContent: spec.label };
      }
      if (sel === ".xm-hm-value") {
        return { textContent: spec.value };
      }
      if (sel === ".xm-hm-trend") {
        return trend;
      }
      return null;
    }
  };
}

function fakeRoot(spec) {
  const view = spec.view || "company";
  const className = view === "live" ? "is-live" : view === "board" ? "is-board" : view === "team" || view === "chief" ? "is-team" : "";
  return {
    id: "xm-hm",
    classList: {
      contains(name) {
        return (" " + className + " ").indexOf(" " + name + " ") >= 0;
      }
    },
    querySelector(sel) {
      if (sel === ".xm-hm-views [data-view].is-on") {
        return { getAttribute: () => view };
      }
      if (sel === ".xm-hm-ranges [data-range].is-on") {
        return { getAttribute: () => spec.range || "yesterday" };
      }
      if (sel === "#xm-hm-date-text") {
        return { textContent: spec.fromTo || "2026-09-11 至 2026-09-11" };
      }
      return null;
    },
    querySelectorAll(sel) {
      if (String(sel).indexOf("xm-hm-card") !== -1) {
        return spec.cards || [];
      }
      return [];
    }
  };
}

function fakePanel() {
  const sub = { textContent: "" };
  const body = { textContent: "" };
  return {
    hidden: false,
    querySelector(sel) {
      if (sel === "#xm-hm-ai-sub") {
        return sub;
      }
      if (sel === "#xm-hm-ai-body") {
        return body;
      }
      return null;
    },
    sub,
    body
  };
}

const sampleCards = () => [
  fakeCard({ key: "payAmount", label: "支付金额 (支付)", value: "855,933", pct: 2, dir: "up" }),
  fakeCard({ key: "adCost", label: "推广花费 (支付预估)", value: "362,476", pct: 3, dir: "up" }),
  fakeCard({ key: "profit", label: "利润 (支付预估)", value: "409,005", pct: 47, dir: "up" }),
  fakeCard({ key: "refundRate", label: "退款率 (按金额)", value: "24%", pct: 11, dir: "up" }),
  fakeCard({ key: "grossMargin", label: "大毛利率", value: "68%", pct: -4, dir: "down" })
];

test("yesterday compares with the day before, month with last month", () => {
  const api = loadApi();
  assert.equal(api.compareLabel("yesterday"), "前天");
  assert.equal(api.compareLabel("month"), "上月");
  assert.equal(api.compareLabel("lastMonth"), "上上月");
  assert.equal(api.compareLabel("year"), "去年");
  assert.equal(api.compareLabel("custom"), "上一段同样天数");
  const yesterday = api.diagnose(api.parseCards(sampleCards()), "yesterday");
  const month = api.diagnose(api.parseCards(sampleCards()), "month");
  assert.match(yesterday, /对照前天/);
  assert.match(month, /对照上月/);
  assert.match(yesterday, /支付金额 855,933，升 2%/);
  assert.match(yesterday, /利润 409,005，升 47%/);
  assert.match(yesterday, /退款率在抬头/);
  assert.match(yesterday, /变化最大：利润升 47%/);
});

test("pay up and profit down asks to check ads and refunds", () => {
  const api = loadApi();
  const cards = api.parseCards([
    fakeCard({ key: "payAmount", label: "支付金额 (支付)", value: "100", pct: 12, dir: "up" }),
    fakeCard({ key: "profit", label: "利润 (支付预估)", value: "10", pct: 8, dir: "down" })
  ]);
  assert.match(api.diagnose(cards, "month"), /对照上月/);
  assert.match(api.diagnose(cards, "month"), /规模在涨、利润在掉/);
});

test("team view names each team and the biggest movers", () => {
  const api = loadApi();
  const cards = api.parseCards([
    fakeCard({ key: "payAmount", label: "支付金额 (支付)", value: "10", pct: 5, dir: "up", team: "shen", teamName: "沈子晗" }),
    fakeCard({ key: "profit", label: "利润 (支付预估)", value: "4", pct: 2, dir: "down", team: "shen", teamName: "沈子晗" }),
    fakeCard({ key: "payAmount", label: "支付金额 (支付)", value: "8", pct: 1, dir: "down", team: "han", teamName: "韩梦凯" }),
    fakeCard({ key: "profit", label: "利润 (支付预估)", value: "3", pct: 9, dir: "up", team: "han", teamName: "韩梦凯" })
  ]);
  const text = api.diagnose(cards, "yesterday");
  assert.match(text, /沈子晗：支付 升 5%，利润 降 2%/);
  assert.match(text, /韩梦凯：支付 降 1%，利润 升 9%/);
  assert.match(text, /韩梦凯·利润升 9%/);
});

test("live and board views stay hidden", () => {
  const api = loadApi();
  const panel = fakePanel();
  const live = api.paint(panel, fakeRoot({ view: "live", cards: sampleCards() }), {});
  assert.equal(live.hidden, true);
  assert.equal(panel.hidden, true);
  const board = api.paint(fakePanel(), fakeRoot({ view: "board", cards: sampleCards() }), {});
  assert.equal(board.hidden, true);
});

test("same range snapshot shows the cached report; refresh diagnoses again", () => {
  const api = loadApi();
  const storage = memoryStorage();
  const rootEl = fakeRoot({ view: "company", range: "yesterday", fromTo: "2026-09-11 至 2026-09-11", cards: sampleCards() });
  const first = api.paint(fakePanel(), rootEl, {}, storage);
  assert.equal(first.cached, false);
  assert.match(first.text, /对照前天/);
  const second = api.paint(fakePanel(), rootEl, {}, storage);
  assert.equal(second.cached, true);
  assert.equal(second.status, "已诊断");
  assert.equal(second.text, first.text);
  const refreshed = api.paint(fakePanel(), rootEl, { force: true }, storage);
  assert.equal(refreshed.cached, false);
  assert.equal(refreshed.status, "刚刚刷新");
  assert.equal(refreshed.text, first.text);
});

test("waiting copy shows before card numbers arrive", () => {
  const api = loadApi();
  const panel = fakePanel();
  const result = api.paint(
    panel,
    fakeRoot({
      view: "company",
      range: "month",
      cards: [fakeCard({ key: "payAmount", label: "支付金额 (支付)", value: "—", pct: null })]
    }),
    {}
  );
  assert.equal(result.waiting, true);
  assert.match(panel.sub.textContent, /对照上月/);
  assert.match(panel.body.textContent, /卡片数字出来后自动诊断/);
});
