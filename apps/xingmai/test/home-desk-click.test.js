import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loginScreenState } from "../src/modules/home/jingmai-desk.js";
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
  assert.equal(patchHomeClientSource(homeJs), homeJs);
});

test("clicking the login picture keeps the dialog open", () => {
  assert.match(homeJs, /function applyDesk\(st\)/);
  assert.match(homeJs, /next\.open = true/);
  assert.match(homeJs, /applyDesk\(st \|\| \{ status: "screen" \}\)/);
  assert.match(homeJs, /preload\.onload/);
});
