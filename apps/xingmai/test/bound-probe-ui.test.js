/* global URLSearchParams, setTimeout */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { PROBE_TARGET } from "../src/modules/bound/probe.js";
import { publicCatalog } from "../src/modules/bound/catalog.js";

test("边界模块单笔入口只在点击时请求，连点不会重复提交，并显示待核验状态", async () => {
  const calls = [];
  const adTarget = { ...PROBE_TARGET, date: "2026-10-03", metric: "广告花费", pageDisplay: null };
  let finish;
  let poll;
  const fields = {
    '[name="bound-user-name"]': { value: "test-account" },
    '[name="bound-password"]': { value: "test-password" },
    '[name="bound-auto-relogin"]': { checked: false }
  };
  const root = {
    innerHTML: "", querySelector: selector => fields[selector] || null,
    addEventListener(type, fn) { this[`on${type}`] = fn; },
    removeEventListener() {}
  };
  const reply = body => Promise.resolve({ ok: true, json: async () => body });
  const context = vm.createContext({
    window: {}, Date, Intl, URLSearchParams,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } },
    setInterval: fn => { poll = fn; return 1; }, clearInterval() {},
    fetch(url, options = {}) {
      calls.push({ url, options });
      if (url === "/api/bound/catalog") return reply(publicCatalog());
      if (url === "/api/bound/link") return reply({ phase: "logged_in", collection: { batchEnabled: false } });
      if (url === "/api/bound/progress") return reply({ items: [], collection: { batchEnabled: false, message: "批量采集已暂停" } });
      if (url === "/api/bound/link/password") return new Promise(resolve => { finish = resolve; });
      if (url.startsWith("/api/bound/collect/probe")) {
        if (options.method === "POST") return new Promise(resolve => { finish = resolve; });
        return reply({ target: url.includes("date=2026-10-03") ? adTarget : PROBE_TARGET, targets: [PROBE_TARGET, adTarget], running: false, last: null });
      }
      if (url.startsWith("/api/bound/view?")) return reply({
        page: { id: "channelOverview", label: "渠道总览", ops: [] }, tabs: [], columns: [], rows: [], shops: [],
        coverage: { status: "missing" }, range: { from: PROBE_TARGET.date, to: PROBE_TARGET.date }, total: 0
      });
      if (url === "/api/bound") return reply({ ok: true });
      throw new Error(`Unexpected route: ${url}`);
    }
  });
  vm.runInContext(readFileSync(new URL("../public/shared/modules/bound.js", import.meta.url), "utf8"), context);
  const stop = context.window.XmModules["/bound"].mount(root);
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  const click = attrs => root.onclick({ target: { closest: () => ({ getAttribute: name => attrs[name] }) } });
  await settle();
  click({ "data-act": "page", "data-page": "link" });
  await settle();
  assert.match(root.innerHTML, /单店试采/);
  assert.match(root.innerHTML, /RASW潮流生活京选菀瑶专卖店/);
  assert.equal(calls.filter(call => call.options.method === "POST").length, 0);
  click({ "data-act": "probe" });
  click({ "data-act": "probe" });
  const posts = calls.filter(call => call.options.method === "POST");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, "/api/bound/collect/probe");
  assert.deepEqual(JSON.parse(posts[0].options.body), { shopId: "16501691", platform: "JD", date: "2026-11-19" });
  assert.match(root.innerHTML, /data-act="probe" disabled/);
  finish({ ok: true, json: async () => ({ ok: true, record: { requestCount: 1, message: "已取得指定日期行，待核实金额字段和精度；尚未计入正式数据。", finishedAt: "2026-11-21T01:00:00Z", metric: { displayValue: "3,759", matchesPage: true, definition: "按支付时间统计的订单金额(包含无效单、代发单)", precisionNote: "保留接口表格原值" } } }) });
  await settle();
  assert.match(root.innerHTML, /待核实金额字段和精度/);
  assert.match(root.innerHTML, /接口支付金额：3,759/);
  assert.match(root.innerHTML, /与旧站页面一致/);
  assert.doesNotMatch(root.innerHTML, /data-act="probe" disabled/);
  root.onfocusin({ target: { closest: () => ({}) } });
  const beforeEditing = calls.length;
  poll();
  await settle();
  assert.equal(calls.length, beforeEditing, "typing must suppress refresh requests");
  click({ "data-act": "password-login" });
  click({ "data-act": "password-login" });
  const logins = calls.filter(call => call.url === "/api/bound/link/password");
  assert.equal(logins.length, 1);
  assert.deepEqual(JSON.parse(logins[0].options.body), { userName: "test-account", password: "test-password", autoRelogin: false });
  assert.equal(fields['[name="bound-password"]'].value, "");
  assert.doesNotMatch(root.innerHTML, /test-password/);
  const beforeBusy = calls.length;
  poll();
  click({ "data-act": "probe" });
  assert.equal(calls.length, beforeBusy, "login in flight must block polling and probe clicks");
  finish({ ok: true, json: async () => ({ ok: true, phase: "logged_in", provider: "PASSWORD", message: "账号密码登录成功" }) });
  await settle();
  assert.match(root.innerHTML, /账号密码登录成功/);
  assert.doesNotMatch(root.innerHTML, /data-act="password-login" disabled/);
  const beforeSwitch = calls.filter(call => call.options.method === "POST").length;
  click({ "data-act": "probe-target", "data-date": "2026-10-03" });
  await settle();
  assert.equal(calls.filter(call => call.options.method === "POST").length, beforeSwitch);
  assert.match(root.innerHTML, /2026-10-03 · 广告花费/);
  assert.match(root.innerHTML, /尚未核对旧站页面值/);
  click({ "data-act": "probe" });
  const adRequest = calls.filter(call => call.url === "/api/bound/collect/probe" && call.options.method === "POST").at(-1);
  assert.equal(JSON.parse(adRequest.options.body).date, "2026-10-03");
  finish({ ok: true, json: async () => ({ ok: true, record: { status: "response_received", requestCount: 1, message: "广告口径待核验", finishedAt: "2026-11-21T02:00:00Z", sample: { row: { date: "2026/10/03", tghf: 9606.63, ptCost: "1094" } } } }) });
  await settle();
  assert.match(root.innerHTML, /广告口径待核验/);
  assert.match(root.innerHTML, /推广相关候选值：9,606.63/);
  assert.match(root.innerHTML, /尚未确认为广告账单实际消耗/);
  assert.doesNotMatch(root.innerHTML, /接口支付金额：9,606.63/);
  adTarget.pageDisplay = "9,606.63";
  adTarget.pageConfirmation = { source: "user", confirmedOn: "2026-11-21" };
  click({ "data-act": "probe" });
  finish({ ok: true, json: async () => ({ ok: true, record: { status: "response_received", requestCount: 1, message: "已取得指定日期行", finishedAt: "2026-11-21T02:00:00Z", sample: { row: { date: "2026/10/03", tghf: 9606.63, ptCost: "1094" } } } }) });
  await settle();
  assert.match(root.innerHTML, /接口广告花费：9,606.63/);
  assert.match(root.innerHTML, /与用户确认的旧站页面一致/);
  assert.match(root.innerHTML, /账单实际消耗口径尚未单独验证/);
  stop();
});
