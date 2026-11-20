import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/modules/home/jingmai-desk.js", import.meta.url), "utf8");
const start = source.indexOf("export async function closeDesk()");
const end = source.indexOf("async function readLoginPage", start);
assert.ok(start >= 0 && end > start);
const closeSource = source.slice(start, end).replace("export async function", "async function");

for (const navigationFails of [false, true]) {
  test(`closing a shop login keeps its persistent session (${navigationFails ? "navigation failure" : "normal close"})`, async () => {
    const cookies = [{ name: "thor", value: "synthetic-session", domain: ".jd.com" }];
    const commands = [];
    let stopped = 0;
    const desk = { store: "测试店", password: "synthetic-password", profileKey: "p_test", ws: {}, chrome: { exitCode: null } };
    const context = vm.createContext({
      current: desk, openTicket: 0,
      deskUsable: () => true,
      reconnectDesk: async () => {},
      stopCurrent: () => { stopped += 1; },
      send: async (_ws, method) => {
        commands.push(method);
        if (method === "Network.clearBrowserCookies") cookies.length = 0;
        if (method === "Page.navigate" && navigationFails) throw new Error("browser closed");
      }
    });
    await vm.runInContext(closeSource + "\ncloseDesk()", context);
    assert.equal(cookies.length, 1, "closing the login panel must not sign the shop out");
    assert.equal(commands.includes("Network.clearBrowserCookies"), false);
    assert.equal(desk.password, "");
    assert.equal(desk.store, "");
    assert.equal(stopped, navigationFails ? 1 : 0);
  });
}
