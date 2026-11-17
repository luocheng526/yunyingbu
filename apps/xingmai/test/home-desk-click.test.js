import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLiveView } from "../src/modules/home/jingmai.js";
import { packJingmaiShops } from "../src/modules/home/local-paid.js";
import { collectFrameIds, deskUsable, loginOpenReady, loginPageAction, loginScreenState, sessionReady } from "../src/modules/home/jingmai-desk.js";
import { patchHomeClientSource } from "../src/modules/home/router.js";

const homeJs = readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");

test("a shop that just logged in shows a fresh time before the first deal arrives", () => {
  const view = buildLiveView({
    now: { day: "2026-11-17", stamp: "2026-11-17 09:56:00" },
    shops: [{
      store: "DIKTT环境电器旗舰店",
      enabled: true,
      cookies: [{ name: "thor", value: "ok" }],
      authState: "ok",
      linkedAt: "2026-11-17 09:55:30"
    }],
    samples: []
  });
  assert.equal(view.shops[0].capturedAt, "2026/11/17 09:55:30");
  assert.equal(view.shops[0].loginExpired, false);
  assert.equal(view.shops[0].online, true);
});

test("an older deal time stays ahead of an earlier login", () => {
  const view = buildLiveView({
    now: { day: "2026-11-17", stamp: "2026-11-17 09:56:00" },
    shops: [{
      store: "已有成交店",
      enabled: true,
      cookies: [{ name: "thor", value: "ok" }],
      authState: "ok",
      linkedAt: "2026-11-17 08:00:00"
    }],
    samples: [{
      store: "已有成交店",
      day: "2026-11-17",
      capturedAt: "2026-11-17 09:40:00",
      dealAmount: 1200,
      ok: true
    }]
  });
  assert.equal(view.shops[0].capturedAt, "2026/11/17 09:40:00");
  assert.equal(view.shops[0].online, true);
});

test("a logged-in shop stays online when the last sample is older than ten minutes", () => {
  const view = buildLiveView({
    now: { day: "2026-11-17", stamp: "2026-11-17 11:36:00" },
    shops: [{
      store: "已登录店",
      enabled: true,
      cookies: [{ name: "thor", value: "ok" }],
      authState: "ok",
      linkedAt: "2026-11-17 10:00:00"
    }],
    samples: [{
      store: "已登录店",
      day: "2026-11-17",
      capturedAt: "2026-11-17 11:17:57",
      dealAmount: 2976,
      ok: true
    }]
  });
  assert.equal(view.shops[0].online, true);
  assert.equal(view.shops[0].loginExpired, false);
  assert.equal(view.shops[0].capturedAt, "2026/11/17 11:17:57");
  const packed = packJingmaiShops(view, []);
  assert.equal(packed.records[0].online, true);
  assert.equal(packed.records[0].capturedAt, "2026/11/17 11:17:57");
});

test("a shop that still needs a login stays offline", () => {
  const now = { day: "2026-11-17", stamp: "2026-11-17 11:36:00" };
  const expired = buildLiveView({
    now,
    shops: [{
      store: "过期店",
      enabled: true,
      cookies: [{ name: "thor", value: "old" }],
      authState: "login_expired"
    }],
    samples: []
  });
  assert.equal(expired.shops[0].online, false);
  assert.equal(expired.shops[0].loginExpired, true);
  const empty = buildLiveView({
    now,
    shops: [{ store: "未登录店", enabled: true, cookies: [], authState: "unlinked" }],
    samples: []
  });
  assert.equal(empty.shops[0].online, false);
});

test("captcha text does not count as a wrong password", () => {
  const state = loginScreenState("请完成安全验证 账号或密码", true);
  assert.equal(state.status, "verify");
});

test("wrong password is still a login failure", () => {
  const state = loginScreenState("账号或密码不正确", true);
  assert.equal(state.status, "login");
  assert.equal(state.message, "账号或密码不正确");
});

test("old homepage client keeps the login dialog open after a click", () => {
  const old = "/* xm-module-home 0.1.1039-loginpop */\n      function showDesk(st) {\n        state.desk = st || {};\n";
  const next = patchHomeClientSource(old);
  assert.match(next, /state\.desk\.open = true/);
  assert.match(next, /0\.1\.1070-liveon/);
  const withClick = patchHomeClientSource(old + "\n            y: Math.round((event.clientY - rect.top) * scaleY)\n          }).then(function (st) {");
  assert.match(withClick, /imageWidth: deskShot.naturalWidth/);
  assert.equal(patchHomeClientSource(homeJs), homeJs);
});

function box(left, top, width, height) {
  return { left: left, top: top, width: width, height: height, right: left + width, bottom: top + height };
}

function node(tag, options) {
  const item = {
    tagName: tag,
    innerText: options.text || "",
    textContent: options.text || "",
    value: options.value || "",
    placeholder: options.placeholder || "",
    name: options.name || "",
    type: options.type || "",
    parentElement: null,
    rect: options.rect || box(0, 0, 10, 10),
    kids: options.kids || [],
    getBoundingClientRect() {
      return this.rect;
    },
    getAttribute(name) {
      return name === "role" ? options.role || "" : "";
    },
    querySelectorAll() {
      const all = [];
      function walk(current) {
        all.push(current);
        current.kids.forEach(walk);
      }
      this.kids.forEach(walk);
      return all;
    },
    focus() {
      this.focused = true;
    },
    dispatchEvent() {}
  };
  item.kids.forEach(function (child) {
    child.parentElement = item;
  });
  return item;
}

test("clicking the captcha confirm button aims at the button", () => {
  const button = node("BUTTON", { text: "确定", rect: box(100, 200, 80, 32) });
  const input = node("INPUT", { placeholder: "请输入验证码", value: "183473", rect: box(80, 150, 120, 28) });
  const doc = node("DIV", { kids: [input, button], rect: box(0, 0, 400, 300) });
  doc.elementFromPoint = function (x, y) {
    const hit = button.rect;
    if (x >= hit.left && x <= hit.left + hit.width && y >= hit.top && y <= hit.top + hit.height) {
      return button;
    }
    return doc;
  };
  const aim = loginPageAction(doc, { x: 140, y: 216 });
  assert.equal(aim.kind, "button");
  assert.equal(aim.x, 140);
  assert.equal(aim.y, 216);
});

test("a click just outside the confirm button still aims at it", () => {
  const button = node("BUTTON", { text: "确定", rect: box(100, 200, 80, 32) });
  const doc = node("DIV", { kids: [button], rect: box(0, 0, 400, 300) });
  doc.elementFromPoint = function () {
    return doc;
  };
  const aim = loginPageAction(doc, { x: 110, y: 196 });
  assert.equal(aim.kind, "button");
  assert.equal(aim.x, 140);
  assert.equal(aim.y, 216);
});

test("a captcha frame with one empty field receives the code", () => {
  const button = node("DIV", { text: "确定", rect: box(40, 80, 60, 28) });
  const input = node("INPUT", { rect: box(20, 30, 80, 24) });
  const doc = node("DIV", { kids: [input, button], rect: box(0, 0, 200, 140) });
  let clicked = false;
  button.click = function () {
    clicked = true;
  };
  const aim = loginPageAction(doc, { text: "562806" });
  assert.equal(input.value, "562806");
  assert.equal(clicked, true);
  assert.equal(aim.kind, "button");
});

test("a login page cookie does not count as a finished login", () => {
  const cookies = [{ name: "thor", value: "abc" }];
  assert.equal(sessionReady("https://passport.shop.jd.com/login/index", cookies), false);
  assert.equal(sessionReady("https://shop.jd.com/", cookies), true);
  assert.equal(sessionReady("https://shop.jd.com/", []), false);
});

test("captcha frames are included when the code is typed", () => {
  const ids = collectFrameIds({
    frameTree: {
      frame: { id: "main" },
      childFrames: [{ frame: { id: "captcha" }, childFrames: [] }]
    }
  });
  assert.deepEqual(ids, ["main", "captcha"]);
});

test("typing the code aims at the confirm button and fills the field", () => {
  const button = node("DIV", { text: "确定", rect: box(100, 220, 80, 32) });
  const input = node("INPUT", { placeholder: "短信验证码", rect: box(80, 160, 140, 28) });
  const account = node("INPUT", { placeholder: "请输入账号名", rect: box(80, 40, 140, 28) });
  const dialog = node("DIV", { kids: [input, button], rect: box(40, 120, 200, 160) });
  const doc = node("DIV", { kids: [account, dialog], rect: box(0, 0, 400, 400) });
  const aim = loginPageAction(doc, { text: "183473" });
  assert.equal(input.value, "183473");
  assert.equal(account.value, "");
  assert.equal(aim.kind, "button");
  assert.equal(aim.x, 140);
  assert.equal(aim.y, 236);
});

test("the login picture is shown as soon as the page is up", () => {
  assert.equal(loginOpenReady(0, { status: "verify", message: "" }, false), "wait");
  assert.equal(loginOpenReady(1, { status: "verify", message: "" }, false), "show");
  assert.equal(loginOpenReady(1, { status: "verify", message: "" }, true), "ok");
  assert.equal(loginOpenReady(0, { status: "login", message: "账号或密码不正确" }, false), "login");
});

test("a live browser can be reused for the next shop", () => {
  assert.equal(deskUsable(null), false);
  assert.equal(deskUsable({
    ws: { readyState: 1 },
    chrome: { exitCode: null, killed: false }
  }), true);
  assert.equal(deskUsable({
    ws: { readyState: 3 },
    chrome: { exitCode: null, killed: false }
  }), false);
});

test("the old client shows the login picture while the page is still opening", () => {
  const old = "      function showDesk(st) {\n        state.desk = st || {};\n        state.desk = { open: true, status: \"opening\", store: name, message: \"正在打开「\" + name + \"」的登录画面\" };\n        if (!dead) {\n          paint(root, state);\n        }\n        api(\"/api/home/live-login/one\", { store: name }).then(function (st) {";
  const next = patchHomeClientSource(old);
  assert.match(next, /watchOpeningShot\(seq, name\)/);
  assert.match(next, /preview: true/);
});

test("typing the code does not rebuild the whole page when the picture is already open", () => {
  const old = "      function showDesk(st) {\n        state.desk = st || {};\n        if (!dead) {\n          paint(root, state);\n        }\n        var status = state.desk && state.desk.status;\n        if (status === \"screen\" || status === \"verify\") {\n          pollDesk();\n        }\n              img.src = \"/api/home/live-login/screen?t=\" + Date.now();\n";
  const next = patchHomeClientSource(old);
  assert.match(next, /!\(status === "screen" && img\)/);
  assert.match(next, /probe.onerror/);
  assert.doesNotMatch(next, /img\.src = "\/api\/home\/live-login\/screen\?t="/);
});

test("old homepage client keeps a saved login online after the sample goes stale", () => {
  const old =
    "      function showDesk(st) {\n        state.desk = st || {};\n" +
    "  function liveLinkOf(row) {\n" +
    "    var t = parseLiveAt(row && (row.capturedAt || row.ingestedAt));\n" +
    "    return Number.isFinite(t) && Date.now() - t <= 6e5\n" +
    "      ? { label: \"在线\", kind: \"on\" }\n" +
    "      : { label: \"掉线\", kind: \"off\" };\n" +
    "  }\n" +
    "      online: row && row.online,\n" +
    "      capturedAt: row && (row.capturedAt || row.ingestedAt),";
  const next = patchHomeClientSource(old);
  assert.match(next, /row\.online === true/);
  assert.match(next, /row\.loginExpired === true/);
  assert.match(next, /loginExpired: row && row.loginExpired === true/);
});

test("clicking the login picture keeps the dialog open", () => {
  assert.match(homeJs, /function applyDesk\(st\)/);
  assert.match(homeJs, /next\.open = true/);
  assert.match(homeJs, /applyDesk\(st \|\| \{ status: "screen" \}\)/);
  assert.match(homeJs, /preload\.onload/);
});
