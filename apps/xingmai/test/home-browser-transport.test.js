import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { openSocket, deskUsable } from "../src/modules/home/jingmai-desk.js";
import { watchNativeAccount } from "../src/modules/home/browser-identity.js";

const source = readFileSync(new URL("../src/modules/home/jingmai-desk.js", import.meta.url), "utf8");
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))).replace(/^export /, "");
const accountBody = JSON.stringify({ code: 200, data: { venderId: "14707016", currentBelongType: "200",
  belongVos: [{ belongType: 200, belongBizId: "14707016" }] } });
const accountEvents = [
  { method: "Page.frameNavigated", params: { frame: { id: "main" } } },
  { method: "Network.responseReceived", params: { requestId: "account", frameId: "main", response: { status: 200,
    url: "https://sff.jd.com/api?api=dsm.shop.pageframe.navigation.accountFacade.findAccountInfo" } } },
  { method: "Network.loadingFinished", params: { requestId: "account" } }
];

function frame(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(body.length < 126 ? 2 : 4);
  header[0] = 0x81;
  if (body.length < 126) header[1] = body.length;
  else { header[1] = 126; header.writeUInt16BE(body.length, 2); }
  return Buffer.concat([header, body]);
}

function event(ws, name) {
  return new Promise(resolve => ws.addEventListener(name, resolve));
}

async function peer(t, accept = true) {
  const sockets = new Set();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.once("data", () => socket.write(accept
      ? "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"
      : "HTTP/1.1 403 Forbidden\r\n\r\n"));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { for (const socket of sockets) socket.destroy(); server.close(); });
  const ws = openSocket(`ws://127.0.0.1:${server.address().port}/devtools/page/test`);
  t.after(() => ws.close());
  return { ws, sockets };
}

test("real browser transport remains usable between login polls until locally closed", async t => {
  const { ws } = await peer(t);
  assert.equal(ws.readyState, 0);
  await event(ws, "open");
  const desk = { ws, chrome: { exitCode: null, killed: false } };
  for (let poll = 0; poll < 3; poll++) {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deskUsable(desk), true, "a healthy connection must not reconnect and lose account listeners");
  }
  const closed = event(ws, "close");
  ws.close();
  assert.equal(ws.readyState, 2);
  assert.equal(deskUsable(desk), false);
  await closed;
  assert.equal(ws.readyState, 3);
});

test("remote browser disconnect makes the real transport unusable", async t => {
  const { ws, sockets } = await peer(t);
  await event(ws, "open");
  const closed = event(ws, "close");
  for (const socket of sockets) socket.end();
  await closed;
  assert.equal(ws.readyState, 3);
  assert.equal(deskUsable({ ws, chrome: { exitCode: null } }), false);
});

test("failed browser handshake never reports an open connection", async t => {
  const { ws } = await peer(t, false);
  const closed = event(ws, "close");
  await event(ws, "error");
  assert.notEqual(ws.readyState, 1);
  await closed;
  assert.equal(ws.readyState, 3);
});

test("native account arriving over the real socket survives actual login polling", async t => {
  const { ws, sockets } = await peer(t);
  await event(ws, "open");
  const accountWatch = watchNativeAccount(ws, async () => ({ body: accountBody }));
  t.after(() => accountWatch.stop());
  for (const socket of sockets) socket.write(Buffer.concat(accountEvents.map(frame)));
  const deadline = Date.now() + 1000;
  while (!accountWatch.read() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(accountWatch.read(), "14707016");
  const desk = { ws, accountWatch, store: "风莱家居专营店", chrome: { exitCode: null, killed: false } };
  let reconnects = 0;
  const context = vm.createContext({ current: desk, deskUsable,
    reconnectDesk: async () => { reconnects++; accountWatch.stop(); return false; },
    readCookies: async () => [], evaluate: async () => "https://shop.jd.com/jdm/home", sessionReady: () => true,
    verifiedDeskSession: async current => ({ status: current.accountWatch.read() === "14707016" ? "ok" : "verify" }),
    launchNote: () => "", PAGE_WAIT_MESSAGE: "wait" });
  vm.runInContext(extract("export async function pollDesk", "let shotCache"), context);
  for (let i = 0; i < 3; i++) assert.equal((await context.pollDesk(desk.store)).status, "ok");
  assert.equal(reconnects, 0);
  assert.equal(desk.ws, ws);
});

for (const mode of ["browser-home", "page-home", "browser-challenge"]) {
  test(`actual reconnection restores fresh identity observation without resubmitting login (${mode})`, async () => {
    const commands = [];
    let stopped = 0;
    const ws = new EventTarget(); ws.readyState = 1; ws.close = () => { ws.readyState = 3; };
    const desk = { port: 12345, chrome: { exitCode: null }, ws: { close() {} },
      accountWatch: { read: () => "stale", stop: () => stopped++ },
      accessWatch: { stop: () => stopped++ } };
    const send = async (_ws, method) => {
      commands.push(method);
      if (method === "Target.attachToTarget") return { sessionId: "session" };
      if (method === "Network.getResponseBody") return { body: accountBody };
      if (method === "Page.reload") for (const message of accountEvents) {
        ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ ...message, sessionId: "session" }) }));
      }
      return {};
    };
    const context = vm.createContext({ desk, send, watchNativeAccount,
      watchPlatformLimits: () => ({ read: () => ({}), stop() {} }),
      connectSocket: async () => ws,
      readDebugTargets: async url => url.endsWith("/list") ? [{ type: "page", id: "target", webSocketDebuggerUrl: "ws://page" }]
        : mode === "page-home" ? {} : { webSocketDebuggerUrl: "ws://browser" },
      evaluate: async () => mode.endsWith("challenge") ? "https://passport.shop.jd.com/login" : "https://shop.jd.com/jdm/home" });
    const result = await vm.runInContext(extract("async function resumeDeskEvents", "function removeDeskDir") + "\nreconnectDesk(desk)", context);
    await Promise.resolve();
    assert.equal(result, true);
    assert.equal(stopped, 2);
    assert.equal(desk.ws, ws);
    assert.equal(desk.accountWatch.read(), mode.endsWith("challenge") ? "" : "14707016");
    assert.ok(commands.includes("Page.enable") && commands.includes("Network.enable"));
    assert.equal(commands.filter(x => x === "Page.reload").length, mode.endsWith("challenge") ? 0 : 1);
    assert.equal(commands.some(x => /Input\.|Page.navigate/.test(x)), false);
    desk.accountWatch.stop();
  });
}
