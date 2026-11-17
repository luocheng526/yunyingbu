import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { accountIdentity, bindDecision, buildLiveView, collectAuthDecision } from "../src/modules/home/jingmai.js";
import { beginRelogin, beginReloginAll, reloginState, resetJingmaiDeps, setJingmaiDeps } from "../src/modules/home/jingmai-runner.js";
import { patchConnectPicker } from "../src/modules/home/connect-patch.js";
import { listCollectTargets, listSessions, resetJingmaiStore, saveSession } from "../src/modules/home/jingmai-store.js";
import { packJingmaiShops } from "../src/modules/home/local-paid.js";
import { browserCandidates, browserStartFailure, collectFrameIds, deskUsable, hostChromePath, loginOpenReady, loginPageAction, loginPageSettled, loginPageVisible, loginScreenState, readDebugTargets, sessionReady, unpackDebBuffer } from "../src/modules/home/jingmai-desk.js";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import zlib from "node:zlib";
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
  assert.equal(view.shops[0].online, false);
  assert.equal(view.shops[0].offline, true);
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
  assert.equal(view.shops[0].online, false);
  assert.equal(view.shops[0].offline, true);
});

test("a fresh sample stays online even when the deal field is empty", () => {
  const view = buildLiveView({
    now: { day: "2026-11-17", stamp: "2026-11-17 11:52:00" },
    shops: [{
      store: "德系甄选好物企官店",
      enabled: true,
      cookies: [{ name: "thor", value: "ok" }],
      authState: "ok",
      linkedAt: "2026-11-17 09:00:00"
    }],
    samples: [{
      store: "德系甄选好物企官店",
      day: "2026-11-17",
      capturedAt: "2026-11-17 11:45:54",
      dealAmount: null,
      paidAmount: 0,
      ok: true
    }]
  });
  assert.equal(view.shops[0].online, true);
  assert.equal(view.shops[0].offline, false);
});

test("a sample older than fifteen minutes is offline the way the paid center is", () => {
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
  assert.equal(view.shops[0].online, false);
  assert.equal(view.shops[0].offline, true);
  assert.equal(view.shops[0].offlineReason, "采集已停止");
  assert.equal(view.shops[0].capturedAt, "2026/11/17 11:17:57");
  const packed = packJingmaiShops(view, [{ store: "未登录店", enabled: true, login: "a", password: "b" }]);
  assert.equal(packed.records.find((row) => row.shopName === "已登录店").offline, true);
  assert.equal(packed.records.find((row) => row.shopName === "未登录店").loginExpired, false);
  assert.equal(packed.records.find((row) => row.shopName === "未登录店").offline, true);
  const bare = packJingmaiShops(view, [{ store: "没账号店", enabled: true }]);
  assert.equal(bare.records.find((row) => row.shopName === "没账号店").offline, false);
  assert.equal(packed.summary.liveAmount, null);
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
  assert.match(next, /0\.1\.1090-paidon/);
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

test("a login is bound only when the platform shop id matches", () => {
  const body = {
    data: {
      currentBelongType: "200",
      belongVos: [{ belongType: "200", belongBizId: "16107402", shopName: "DIKTT潮流生活旗舰店" }]
    }
  };
  assert.deepEqual(accountIdentity(body), { shopId: "16107402", shopName: "DIKTT潮流生活旗舰店" });
  const online = { authState: "ok", shopId: "16107402", cookies: [{ name: "thor", value: "kept" }] };
  const wrong = bindDecision({ store: "UUMILO个人洗护旗舰店", shopId: "196509787" }, accountIdentity(body), null);
  assert.equal(wrong.action, "reject");
  const kept = bindDecision({ store: "DIKTT潮流生活旗舰店", shopId: "16107402" }, accountIdentity(body), online);
  assert.equal(kept.action, "save");
  const clash = bindDecision({ store: "UUMILO个人洗护旗舰店", shopId: "196509787" }, accountIdentity(body), online);
  assert.equal(clash.action, "keep");
  assert.match(clash.message, /DIKTT潮流生活旗舰店/);
  const paused = bindDecision(
    { store: "UUMILO个人洗护旗舰店", shopId: "196509787" },
    accountIdentity(body),
    { authState: "offline", shopId: "16107402", cookies: [{ name: "thor", value: "kept" }] }
  );
  assert.equal(paused.action, "keep");
});

test("a mismatched login keeps the cookies already saved for that shop", async () => {
  await resetJingmaiStore();
  await saveSession("DIKTT潮流生活旗舰店", {
    cookies: [{ name: "thor", value: "live" }],
    authState: "ok",
    shopId: "16107402"
  });
  setJingmaiDeps({
    desk: {
      poll: async () => ({ status: "ok", cookies: [{ name: "thor", value: "other-shop" }] }),
      close: async () => {}
    },
    client: {
      fetchAccountIdentity: async () => ({ shopId: "196509787", shopName: "UUMILO个人洗护旗舰店" })
    }
  });
  try {
    const state = await reloginState("DIKTT潮流生活旗舰店");
    assert.equal(state.status, "login");
    assert.match(state.message, /原来的会话还在/);
    const row = (await listSessions()).find((item) => item.store === "DIKTT潮流生活旗舰店");
    assert.equal(row.cookies[0].value, "live");
    assert.equal(row.authState, "ok");
    assert.equal(row.shopId, "16107402");
  } finally {
    resetJingmaiDeps();
  }
});

test("a mismatched login with no saved session is not written as this shop", async () => {
  await resetJingmaiStore();
  setJingmaiDeps({
    desk: {
      poll: async () => ({ status: "ok", cookies: [{ name: "thor", value: "other-shop" }] }),
      close: async () => {}
    },
    client: {
      fetchAccountIdentity: async () => ({ shopId: "16107402", shopName: "DIKTT潮流生活旗舰店" })
    }
  });
  try {
    const state = await reloginState("UUMILO个人洗护旗舰店");
    assert.equal(state.status, "screen");
    const row = (await listSessions()).find((item) => item.store === "UUMILO个人洗护旗舰店");
    assert.equal(row.authState, "login_expired");
    assert.equal(row.cookies.length, 0);
    assert.match(row.authMessage, /DIKTT潮流生活旗舰店/);
  } finally {
    resetJingmaiDeps();
  }
});

test("collector keeps each saved session and does not drop a shop that has no platform id yet", async () => {
  await resetJingmaiStore();
  await saveSession("DIKTT潮流生活旗舰店", {
    cookies: [{ name: "thor", value: "live" }],
    authState: "ok",
    shopId: "16107402"
  });
  await saveSession("京贝优驱蚊专营店", {
    cookies: [{ name: "pt_key", value: "live" }],
    authState: "ok"
  });
  const targets = await listCollectTargets();
  assert.deepEqual(targets.map((row) => row.store).sort(), ["DIKTT潮流生活旗舰店", "京贝优驱蚊专营店"]);
  assert.equal(targets.find((row) => row.store === "DIKTT潮流生活旗舰店").shopId, "16107402");
});

test("连接京麦 lists shops that still need a login and does not open the browser", async () => {
  await resetJingmaiStore();
  await saveSession("DIKTT潮流生活旗舰店", {
    cookies: [{ name: "thor", value: "live" }],
    authState: "ok",
    shopId: "16107402"
  });
  let opened = false;
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "DIKTT潮流生活旗舰店", enabled: true, login: "diktt", password: "secret", shopId: "16107402" },
      { store: "UUMILO个人洗护旗舰店", enabled: true, login: "uumilo", password: "secret", shopId: "196509787" }
    ],
    desk: {
      open: async () => {
        opened = true;
        return { status: "verify", message: "登录页已打开" };
      },
      close: async () => {},
      poll: async () => ({ status: "screen", message: "登录页已打开" })
    }
  });
  try {
    const listed = await beginReloginAll("cookie");
    assert.equal(listed.status, "pick");
    assert.deepEqual(listed.shops, [{ store: "UUMILO个人洗护旗舰店", shopId: "196509787" }]);
    assert.equal(opened, false);
    const kept = await beginRelogin("DIKTT潮流生活旗舰店", "cookie");
    assert.equal(kept.status, "done");
    assert.match(kept.message, /已连接/);
    assert.equal(opened, false);
    const row = (await listSessions()).find((item) => item.store === "DIKTT潮流生活旗舰店");
    assert.equal(row.cookies[0].value, "live");
    const started = Date.now();
    const opening = await beginRelogin("UUMILO个人洗护旗舰店", "cookie");
    assert.equal(opening.status, "opening");
    assert.equal(opening.store, "UUMILO个人洗护旗舰店");
    assert.ok(Date.now() - started < 1000);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const screen = await reloginState("UUMILO个人洗护旗舰店");
    assert.equal(screen.status, "screen");
    assert.equal(screen.step, "京麦登录页");
    assert.equal(screen.store, "UUMILO个人洗护旗舰店");
  } finally {
    resetJingmaiDeps();
  }
});

test("opening a shop reports the browser step before the login page is ready", async () => {
  await resetJingmaiStore();
  let closed = false;
  let pageUp = false;
  let release = function () {};
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "飒望生活日用旗舰店", enabled: true, login: "sa", password: "secret", shopId: "1" }
    ],
    desk: {
      open: function (options) {
        if (options && options.onStep) {
          options.onStep("正在启动浏览器");
        }
        return new Promise(function (resolve) {
          release = function () {
            pageUp = true;
            if (options && options.onStep) {
              options.onStep("正在打开登录页");
            }
            resolve({ status: "verify", message: "请在下面的服务器画面里完成验证。点画面就是在服务器上操作。" });
          };
        });
      },
      close: async function () {
        closed = true;
      },
      poll: async function () {
        return pageUp
          ? { status: "verify", message: "请在下面的服务器画面里完成验证。点画面就是在服务器上操作。" }
          : { status: "opening", message: "正在启动浏览器" };
      }
    }
  });
  try {
    const started = Date.now();
    const opening = await beginRelogin("飒望生活日用旗舰店", "cookie");
    assert.equal(opening.status, "opening");
    assert.equal(opening.store, "飒望生活日用旗舰店");
    assert.ok(Date.now() - started < 1000);
    await new Promise(function (resolve) {
      setTimeout(resolve, 30);
    });
    const mid = await reloginState("飒望生活日用旗舰店");
    assert.equal(mid.status, "opening");
    assert.equal(mid.message, "正在启动浏览器");
    assert.equal(closed, false);
    release();
    await new Promise(function (resolve) {
      setTimeout(resolve, 30);
    });
    const screen = await reloginState("飒望生活日用旗舰店");
    assert.equal(screen.status, "screen");
    assert.equal(screen.store, "飒望生活日用旗舰店");
    assert.equal(screen.step, "京麦登录页");
    assert.match(screen.message, /服务器画面/);
  } finally {
    resetJingmaiDeps();
  }
});

test("the homepage tries the host browser first and can fall back to the shell", () => {
  const shell = "/tmp/shen-chrome/chrome-headless-shell-linux64/chrome-headless-shell";
  assert.deepEqual(browserCandidates("/usr/bin/google-chrome", shell), ["/usr/bin/google-chrome", shell]);
  assert.deepEqual(browserCandidates(shell, shell), [shell]);
});

test("the homepage uses the same host browser as the paid center and does not start it twice", async () => {
  assert.equal(hostChromePath("/usr/bin/google-chrome"), "/usr/bin/google-chrome");
  assert.equal(hostChromePath("/tmp/shen-chrome/chrome-headless-shell-linux64/chrome-headless-shell"), "");
  await resetJingmaiStore();
  let calls = 0;
  let release = function () {};
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "飒望生活日用旗舰店", enabled: true, login: "sa", password: "secret", shopId: "13341301" },
      { store: "DIKTT潮流生活旗舰店", enabled: true, login: "diktt", password: "secret", shopId: "16107402" }
    ],
    desk: {
      open: function (options) {
        calls += 1;
        if (options && options.onStep) {
          options.onStep("正在启动浏览器");
        }
        return new Promise(function (resolve) {
          release = function () {
            resolve({ status: "verify", message: "登录页已打开" });
          };
        });
      },
      close: async function () {},
      poll: async function () {
        return { status: "screen", message: "登录页已打开" };
      }
    }
  });
  try {
    const first = await beginRelogin("飒望生活日用旗舰店", "cookie");
    const second = await beginRelogin("飒望生活日用旗舰店", "cookie");
    assert.equal(first.status, "opening");
    assert.equal(second.status, "opening");
    assert.equal(second.store, "飒望生活日用旗舰店");
    assert.equal(calls, 1);
    release();
    await new Promise(function (resolve) {
      setTimeout(resolve, 30);
    });
    const screen = await reloginState("飒望生活日用旗舰店");
    assert.equal(screen.status, "screen");
    assert.equal(screen.store, "飒望生活日用旗舰店");
  } finally {
    resetJingmaiDeps();
  }
});

test("an older login attempt cannot mark the shop failed after a newer one starts", async () => {
  await resetJingmaiStore();
  await saveSession("DIKTT潮流生活旗舰店", {
    cookies: [{ name: "thor", value: "live" }],
    authState: "ok",
    shopId: "16107402"
  });
  const releases = [];
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "飒望生活日用旗舰店", enabled: true, login: "sa", password: "secret", shopId: "13341301" },
      { store: "UUMILO个人洗护旗舰店", enabled: true, login: "uu", password: "secret", shopId: "196509787" }
    ],
    desk: {
      open: function () {
        return new Promise(function (resolve) {
          releases.push(resolve);
        });
      },
      close: async function () {},
      poll: async function () {
        return { status: "opening", message: "正在启动浏览器" };
      }
    }
  });
  try {
    await beginRelogin("飒望生活日用旗舰店", "cookie");
    await beginRelogin("UUMILO个人洗护旗舰店", "cookie");
    assert.equal(releases.length, 2);
    releases[0]({ status: "login", message: "登录已取消" });
    await new Promise(function (resolve) {
      setTimeout(resolve, 30);
    });
    const state = await reloginState("UUMILO个人洗护旗舰店");
    assert.equal(state.status, "opening");
    assert.equal(state.store, "UUMILO个人洗护旗舰店");
    assert.notEqual(state.message, "登录已取消");
    const kept = (await listSessions()).find((item) => item.store === "DIKTT潮流生活旗舰店");
    assert.equal(kept.cookies[0].value, "live");
    assert.equal(kept.authState, "ok");
  } finally {
    resetJingmaiDeps();
  }
});

test("a shop that fails to open keeps other shops logged in and names the step", async () => {
  await resetJingmaiStore();
  await saveSession("DIKTT潮流生活旗舰店", {
    cookies: [{ name: "thor", value: "live" }],
    authState: "ok",
    shopId: "16107402"
  });
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "UUMILO个人洗护旗舰店", enabled: true, login: "uumilo", password: "secret", shopId: "196509787" }
    ],
    desk: {
      open: async () => ({ status: "login", message: "服务器没有打开京麦登录页" }),
      close: async () => {},
      poll: async () => ({ status: "screen" })
    }
  });
  try {
    await beginRelogin("UUMILO个人洗护旗舰店", "cookie");
    await new Promise((resolve) => setTimeout(resolve, 30));
    const failed = await reloginState("UUMILO个人洗护旗舰店");
    assert.equal(failed.status, "failed");
    assert.equal(failed.step, "打开京麦登录页");
    assert.match(failed.message, /没有打开京麦登录页/);
    const row = (await listSessions()).find((item) => item.store === "DIKTT潮流生活旗舰店");
    assert.equal(row.authState, "ok");
    assert.equal(row.cookies[0].value, "live");
  } finally {
    resetJingmaiDeps();
  }
});

test("one collect timeout or an empty deal does not mark the login offline", () => {
  assert.equal(collectAuthDecision({ code: "timeout", message: "采集超时" }).authState, "ok");
  assert.equal(collectAuthDecision({ code: "login", message: "登录已失效" }).authState, "login_expired");
});

test("the connect picker patch turns the old all-shop opener into a shop list", () => {
  assert.match(homeJs, /data-desk-shop/);
  assert.match(homeJs, /全部店铺已连接/);
  assert.match(homeJs, /重试本店/);
  assert.match(homeJs, /换一家店/);
  assert.match(homeJs, /列出待连接店铺/);
  assert.equal(patchConnectPicker(homeJs), homeJs);
  const old = 'state.desk = { open: true, status: "opening", store: "全部店铺", message: "正在打开还没有登录的店铺" };';
  assert.match(homeJs, /正在列出还没有登录的店铺/);
  assert.equal(homeJs.includes(old), false);
});

test("a login form captcha is submitted with the 登录 button", () => {
  const account = node("INPUT", { placeholder: "请输入账号名", rect: box(80, 40, 180, 28) });
  const password = node("INPUT", { placeholder: "请输入密码", rect: box(80, 80, 180, 28) });
  const code = node("INPUT", { placeholder: "请输入验证码", rect: box(80, 120, 120, 28) });
  const button = node("BUTTON", { text: "登录", rect: box(80, 170, 180, 36) });
  const doc = node("DIV", { kids: [account, password, code, button], rect: box(0, 0, 400, 260) });
  const aim = loginPageAction(doc, { text: "918273" });
  assert.equal(code.value, "918273");
  assert.equal(account.value, "");
  assert.equal(password.value, "");
  assert.equal(aim.kind, "button");
  assert.equal(aim.x, 170);
  assert.equal(aim.y, 188);
  assert.equal(loginPageAction(doc, { submit: true }).kind, "button");
});

test("the login page is shown once it is on screen, and typing waits until the form stays up", () => {
  const blank = { readyState: "complete", href: "about:blank", accountVisible: true, passwordVisible: true };
  const loading = { readyState: "loading", href: "https://passport.shop.jd.com/login", accountVisible: true, passwordVisible: true };
  const painted = { readyState: "interactive", href: "https://passport.shop.jd.com/login", text: "账号登录" };
  const form = { readyState: "interactive", href: "https://passport.shop.jd.com/login", accountVisible: true, passwordVisible: true };
  assert.equal(loginPageVisible(null), false);
  assert.equal(loginPageVisible(blank), false);
  assert.equal(loginPageVisible(painted), true);
  assert.equal(loginPageSettled(blank), false);
  assert.equal(loginPageSettled(loading), false);
  assert.equal(loginPageSettled(painted), false);
  assert.equal(loginPageSettled(form), true);
  assert.equal(loginPageSettled({ readyState: "interactive", href: "https://passport.shop.jd.com/login", text: "请完成安全验证" }), true);
  assert.equal(loginOpenReady(1, { status: "verify", formReady: true }, false), "wait");
  assert.equal(loginOpenReady(1, { status: "verify", settled: true }, false), "show");
  assert.equal(loginOpenReady(1, { status: "verify" }, true), "ok");
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
  assert.match(next, /row\.offline === true/);
  assert.match(next, /row\.loginExpired === true/);
  assert.match(next, /kind: ""/);
  assert.match(next, /offline: row && row.offline === true/);
});

function tarHeader(name, size, type, link) {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write("0000644\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(size.toString(8).padStart(11, "0") + "\0", 124);
  header.write("00000000000\0", 136);
  header[156] = type.charCodeAt(0);
  if (link) {
    header.write(link, 157);
  }
  header.write("ustar\0", 257);
  header.write("00", 263);
  let sum = 0;
  for (let i = 0; i < 512; i += 1) {
    sum += i >= 148 && i < 156 ? 32 : header[i];
  }
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return header;
}

function arMember(name, body) {
  const header = Buffer.alloc(60);
  header.write(name.padEnd(16, " "));
  header.write("0".padEnd(12, " "), 16);
  header.write("0".padEnd(6, " "), 28);
  header.write("0".padEnd(6, " "), 34);
  header.write("100644".padEnd(8, " "), 40);
  header.write(String(body.length).padEnd(10, " "), 48);
  header.write("`\n", 58);
  const pad = body.length % 2 ? Buffer.from([10]) : Buffer.alloc(0);
  return Buffer.concat([header, body, pad]);
}

test("a zstd library package unpacks the soname without python or dpkg", () => {
  assert.equal(typeof zlib.zstdCompressSync, "function");
  const file = Buffer.from("elf-atk");
  const tar = Buffer.concat([
    tarHeader("./usr/lib/x86_64-linux-gnu/", 0, "5"),
    tarHeader("./usr/lib/x86_64-linux-gnu/libatk-bridge-2.0.so.0.0.0", file.length, "0"),
    file,
    Buffer.alloc((512 - (file.length % 512)) % 512),
    tarHeader("./usr/lib/x86_64-linux-gnu/libatk-bridge-2.0.so.0", 0, "2", "libatk-bridge-2.0.so.0.0.0"),
    Buffer.alloc(1024)
  ]);
  const deb = Buffer.concat([
    Buffer.from("!<arch>\n"),
    arMember("debian-binary", Buffer.from("2.0\n")),
    arMember("data.tar.zst", zlib.zstdCompressSync(tar))
  ]);
  const dest = mkdtempSync(tmpdir() + "/atk-deb-");
  try {
    unpackDebBuffer(deb, dest);
    const link = readFileSync(dest + "/usr/lib/x86_64-linux-gnu/libatk-bridge-2.0.so.0");
    assert.equal(link.toString(), "elf-atk");
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
});

test("an idle login check does not say the browser is starting", async () => {
  await resetJingmaiStore();
  resetJingmaiDeps();
  const state = await reloginState("SAWAAG家居旗舰店");
  assert.equal(state.status, "idle");
  assert.equal(state.message, "");
});

test("a browser that never finishes starting is reported as a failure", async () => {
  await resetJingmaiStore();
  setJingmaiDeps({
    startLimitMs: 40,
    loadOrg: async () => [
      { store: "飒望生活日用旗舰店", enabled: true, login: "sa", password: "secret", shopId: "1" }
    ],
    desk: {
      open: function () {
        return new Promise(function () {});
      },
      poll: async function () {
        return { status: "opening", message: "正在启动浏览器" };
      },
      close: async function () {}
    }
  });
  try {
    const opening = await beginRelogin("飒望生活日用旗舰店", "cookie");
    assert.equal(opening.status, "opening");
    await new Promise(function (resolve) {
      setTimeout(resolve, 80);
    });
    const failed = await reloginState("飒望生活日用旗舰店");
    assert.equal(failed.status, "failed");
    assert.equal(failed.message, "服务器浏览器启动失败");
  } finally {
    resetJingmaiDeps();
  }
});

test("a browser debug port that never answers does not keep the login starting", async () => {
  const server = createServer(function () {});
  await new Promise(function (resolve) {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const started = Date.now();
  try {
    await assert.rejects(readDebugTargets("http://127.0.0.1:" + address.port + "/json/list"));
    assert.ok(Date.now() - started < 7000);
  } finally {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise(function (resolve) {
      server.close(resolve);
    });
  }
});

test("a browser that cannot start does not mark the shop offline", async () => {
  await resetJingmaiStore();
  await saveSession("飒望生活日用旗舰店", {
    cookies: [{ name: "thor", value: "keep" }],
    authState: "login_expired",
    shopId: "13341301"
  });
  await saveSession("DIKTT潮流生活旗舰店", {
    cookies: [{ name: "thor", value: "live" }],
    authState: "ok",
    shopId: "16107402"
  });
  setJingmaiDeps({
    loadOrg: async () => [
      { store: "飒望生活日用旗舰店", enabled: true, login: "sa", password: "secret", shopId: "13341301" }
    ],
    desk: {
      open: async () => ({ status: "login", message: browserStartFailure() }),
      close: async () => {},
      poll: async () => ({ status: "failed" })
    }
  });
  try {
    await beginRelogin("飒望生活日用旗舰店", "cookie");
    await new Promise((resolve) => setTimeout(resolve, 30));
    const state = await reloginState("飒望生活日用旗舰店");
    assert.equal(state.status, "failed");
    assert.equal(state.message, "服务器浏览器启动失败");
    const row = (await listSessions()).find((item) => item.store === "飒望生活日用旗舰店");
    assert.equal(row.authState, "login_expired");
    assert.equal(row.cookies[0].value, "keep");
    const other = (await listSessions()).find((item) => item.store === "DIKTT潮流生活旗舰店");
    assert.equal(other.authState, "ok");
    assert.equal(other.cookies[0].value, "live");
  } finally {
    resetJingmaiDeps();
  }
});

test("clicking the login picture keeps the dialog open", () => {
  assert.match(homeJs, /function applyDesk\(st\)/);
  assert.match(homeJs, /next\.open = true/);
  assert.match(homeJs, /applyDesk\(st \|\| \{ status: "screen" \}\)/);
  assert.match(homeJs, /preload\.onload/);
});
