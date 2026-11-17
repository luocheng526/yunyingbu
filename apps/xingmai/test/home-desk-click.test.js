import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deskUsable, loginOpenReady, loginPageAction, loginScreenState } from "../src/modules/home/jingmai-desk.js";
import { patchHomeClientSource } from "../src/modules/home/router.js";

const homeJs = readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");

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
  assert.match(next, /0\.1\.1043-deskkeep/);
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

test("clicking the login picture keeps the dialog open", () => {
  assert.match(homeJs, /function applyDesk\(st\)/);
  assert.match(homeJs, /next\.open = true/);
  assert.match(homeJs, /applyDesk\(st \|\| \{ status: "screen" \}\)/);
  assert.match(homeJs, /preload\.onload/);
});
