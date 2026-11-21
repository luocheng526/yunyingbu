import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loginPageAction } from "../src/modules/home/jingmai-desk.js";

function fixture() {
  const rect = { left: 100, top: 200, width: 120, height: 40 };
  const child = {};
  const button = { innerText: "登录", getBoundingClientRect: () => rect,
    contains: n => n === child, getAttribute: () => null };
  const doc = { readyState: "complete", body: { innerText: "密码登录 短信登录" },
    defaultView: {}, querySelectorAll: selector => selector.includes("button") ? [button] : [],
    elementFromPoint: () => child };
  button.ownerDocument = doc;
  return { doc, button, child };
}

const aim = doc => loginPageAction(doc, { submit: true, requireReady: true });

test("a visible login button under a loading mask is not considered ready", () => {
  const { doc } = fixture();
  doc.elementFromPoint = () => ({ className: "loading-mask" });
  assert.equal(aim(doc).kind, "wait");
});

test("login becomes clickable only after loading and disabled states clear", () => {
  const { doc, button, child } = fixture();
  doc.readyState = "interactive";
  assert.equal(aim(doc).kind, "wait");
  doc.readyState = "complete";
  button.disabled = true;
  assert.equal(aim(doc).kind, "wait");
  button.disabled = false;
  doc.elementFromPoint = () => child;
  assert.deepEqual(aim(doc), { kind: "button", x: 160, y: 220, text: "登录" });
});

test("verification appearing while the loading mask clears blocks automatic submission", () => {
  const { doc } = fixture();
  for (const text of ["请完成安全验证", "登录异常，请联系客服解除", "账号或密码不正确"]) {
    doc.body.innerText = text;
    assert.equal(aim(doc).kind, "blocked");
  }
  doc.body.innerText = "密码登录";
  const input = { placeholder: "短信验证码", getBoundingClientRect: () => ({ width: 100, height: 20 }) };
  const original = doc.querySelectorAll;
  doc.querySelectorAll = selector => selector === "input" ? [input] : original(selector);
  assert.equal(aim(doc).kind, "blocked");
});

test("a frame covered in its parent document is not clickable", () => {
  const { doc } = fixture();
  const parent = { elementFromPoint: () => ({}) };
  const frame = { ownerDocument: parent, getBoundingClientRect: () => ({ left: 30, top: 40 }) };
  doc.defaultView.frameElement = frame;
  assert.equal(aim(doc).kind, "wait");
  parent.elementFromPoint = (x, y) => { assert.equal(x, 190); assert.equal(y, 260); return frame; };
  parent.defaultView = {};
  assert.equal(aim(doc).kind, "button");
});

const source = fs.readFileSync(new URL("../src/modules/home/jingmai-desk.js", import.meta.url), "utf8");
const fn = source.slice(source.indexOf("async function fillAndSubmit("), source.indexOf("async function clickSendCode("));

async function runSubmit(hits, options = {}) {
  let reads = 0, waits = 0;
  const clicks = [];
  const context = { signal: options.signal, loginPageAction,
    fillLoginOnDesk: async () => true, frameIds: async () => [""],
    sleepSignal: async () => { waits++; options.onWait?.(); },
    send: async (_ws, method, params) => {
      if (method === "Runtime.evaluate") {
        const hit = hits[Math.min(reads++, hits.length - 1)];
        return { result: { value: hit } };
      }
      assert.equal(method, "Input.dispatchMouseEvent");
      clicks.push({ ...params, afterReads: reads });
      return {};
    },
    evaluate: () => assert.fail("must not fall back to a DOM click through a loading mask") };
  const submitted = await vm.runInNewContext(fn + '\nfillAndSubmit({}, "fixture", "fixture-secret", signal)', context);
  return { submitted, clicks, reads, waits };
}

test("automatic login waits for an unobstructed stable button, then submits exactly once", async () => {
  const point = { kind: "button", x: 160, y: 220 };
  const result = await runSubmit([{ kind: "wait" }, point, { ...point, x: 180 }, { ...point, x: 180 }]);
  assert.equal(result.submitted, true);
  assert.equal(result.clicks.length, 2);
  assert.equal(result.clicks[0].afterReads, 4);
  assert.equal(result.clicks[0].x, 180);
  assert.equal(result.clicks[0].buttons, 1);
  assert.equal(result.clicks[1].buttons, 0);
});

test("a loading mask that never clears produces no submit or hidden DOM click", async () => {
  const result = await runSubmit([{ kind: "wait" }]);
  assert.equal(result.submitted, false);
  assert.equal(result.clicks.length, 0);
  assert.equal(result.reads, 32);
});

test("a late verification challenge stops before clicking the login button", async () => {
  const result = await runSubmit([{ kind: "wait" }, { kind: "blocked" }]);
  assert.equal(result.submitted, false);
  assert.equal(result.clicks.length, 0);
});

test("cancelling recovery during the readiness wait prevents a later submission", async () => {
  const controller = new AbortController();
  const result = await runSubmit([{ kind: "button", x: 160, y: 220 }], {
    signal: controller.signal, onWait: () => controller.abort()
  });
  assert.equal(result.submitted, false);
  assert.equal(result.clicks.length, 0);
});

function openDeskFixture(stall) {
  const timers = new Map();
  let signal, stopped = 0;
  const desk = { ws: {} };
  const context = { current: null, openTicket: 0, loginVisible: false, shotCache: {}, lastLaunchNote: "",
    AbortController, AbortSignal, console: { error() {} }, LOGIN_URL: "https://passport.shop.jd.com/",
    acquireDesk: async (_store, _ticket, linked) => { signal = linked; return stall ? new Promise(() => {}) : desk; },
    deskUsable: () => true, discard: () => {}, stopCurrent: () => {},
    stopBooting: () => { stopped++; }, browserStartFailure: () => "startup timeout",
    browserAbortError: () => Object.assign(new Error("aborted"), { code: "browser" }),
    watchPlatformLimits: () => ({ stop() {} }), send: async () => {},
    setTimeout: (fn, ms) => { const id = {}; timers.set(id, { fn, ms }); if (stall) queueMicrotask(fn); return id; },
    clearTimeout: id => timers.delete(id),
    finishOpen: async () => {
      // Simulate passing the startup deadline while the existing page is slow.
      for (const timer of timers.values()) if (timer.ms === 12000) timer.fn();
      assert.equal(signal.aborted, false);
      return { status: "verify" };
    } };
  const open = source.slice(source.indexOf("export async function openDesk("), source.indexOf("export function launchNote("))
    .replace("export async", "async");
  return { run: () => vm.runInNewContext(open + '\nopenDesk({store:"fixture",loginName:"fixture",password:"fixture-secret"})', context),
    stopped: () => stopped, remaining: () => timers.size };
}

test("startup timeout is cleared before waiting for the already-open login page", async () => {
  const fixture = openDeskFixture(false);
  assert.equal((await fixture.run()).status, "verify");
  assert.equal(fixture.stopped(), 0);
  assert.equal(fixture.remaining(), 0);
});

test("a browser that never starts still has a bounded startup deadline", async () => {
  const fixture = openDeskFixture(true);
  assert.equal((await fixture.run()).status, "login");
  assert.equal(fixture.stopped(), 1);
  assert.equal(fixture.remaining(), 0);
});
