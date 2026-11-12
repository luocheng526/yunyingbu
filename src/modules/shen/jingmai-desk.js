import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect as connectTcp } from "node:net";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const LOGIN_URL =
  "https://passport.shop.jd.com/login/index.action/jdm?ReturnUrl=" + encodeURIComponent("https://shop.jd.com/");
const CHROME_VERSION = "157.0.8103.78";
const CHROME_URL =
  "https://cdn.npmmirror.com/binaries/chrome-for-testing/" +
  CHROME_VERSION +
  "/linux64/chrome-headless-shell-linux64.zip";
const SESSION_NAMES = new Set(["thor", "pt_key"]);

let current = null;
let chromeInstall = null;

function chromeHomes() {
  return [process.env.SHEN_CHROME_DIR, "/tmp/shen-chrome", "/opt/mengkai/.shen-chrome"].filter(Boolean);
}

function installedBinary() {
  for (const home of chromeHomes()) {
    const bin = home + "/chrome-headless-shell-linux64/chrome-headless-shell";
    if (existsSync(bin)) {
      return bin;
    }
  }
  return "";
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
    installedBinary()
  ];
  return candidates.find(function (path) {
    return path && existsSync(path);
  }) || "";
}

function extractZip(zip, dir) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    function finish(error) {
      if (settled) {
        return;
      }
      settled = true;
      if (error) reject(error);
      else resolve();
    }
    function runUnzip() {
      const unzip = spawn("unzip", ["-o", zip, "-d", dir], { stdio: "ignore" });
      unzip.on("error", function () {
        finish(new Error("unzip"));
      });
      unzip.on("exit", function (code) {
        finish(code === 0 ? null : new Error("unzip"));
      });
    }
    const python = spawn("python3", ["-c", "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", zip, dir], { stdio: "ignore" });
    python.on("error", runUnzip);
    python.on("exit", function (code) {
      if (code === 0) finish(null);
      else runUnzip();
    });
  });
}

async function installChrome() {
  let lastError = null;
  for (const home of chromeHomes()) {
    try {
      mkdirSync(home, { recursive: true });
      const zip = home + "/chrome.zip";
      const response = await fetch(CHROME_URL, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) {
        throw new Error("download");
      }
      writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
      await extractZip(zip, home);
      const bin = home + "/chrome-headless-shell-linux64/chrome-headless-shell";
      chmodSync(bin, 0o755);
      rmSync(zip, { force: true });
      return bin;
    } catch (error) {
      lastError = error;
    }
  }
  const failure = new Error("服务器上还没有浏览器，账号登录开不了");
  failure.code = "browser";
  failure.cause = lastError;
  throw failure;
}

export function ensureChrome() {
  const existing = findChrome();
  if (existing) {
    return Promise.resolve(existing);
  }
  if (!chromeInstall) {
    chromeInstall = installChrome().catch(function (error) {
      chromeInstall = null;
      throw error;
    });
  }
  return chromeInstall;
}

function send(ws, method, params) {
  const id = ws.__seq = (ws.__seq || 0) + 1;
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      ws.removeEventListener("message", onMessage);
      reject(new Error(method + " timeout"));
    }, 15000);
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.id !== id) {
        return;
      }
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      if (message.error) {
        reject(new Error(method));
      } else {
        resolve(message.result || {});
      }
    }
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
  });
}

function evaluate(ws, expression) {
  return send(ws, "Runtime.evaluate", { expression: expression, returnByValue: true, awaitPromise: true }).then(function (result) {
    if (result.exceptionDetails) {
      return null;
    }
    return result.result ? result.result.value : null;
  });
}

function stopCurrent() {
  const desk = current;
  current = null;
  if (!desk) {
    return;
  }
  desk.password = "";
  try {
    if (desk.ws) {
      desk.ws.close();
    }
  } catch {
    /* already closed */
  }
  const removeDir = function () {
    try {
      rmSync(desk.dir, { recursive: true, force: true });
    } catch {
      /* temp dir already gone */
    }
  };
  try {
    if (desk.chrome && desk.chrome.exitCode == null) {
      desk.chrome.once("exit", removeDir);
      desk.chrome.kill("SIGKILL");
    } else {
      removeDir();
    }
  } catch {
    removeDir();
  }
}

function encodeFrame(text) {
  const payload = Buffer.from(String(text));
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0xfe;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0xff;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

function openSocket(url) {
  const parsed = new URL(url);
  const socket = connectTcp(Number(parsed.port), parsed.hostname);
  const listeners = { open: [], message: [], error: [] };
  let buf = Buffer.alloc(0);
  let opened = false;
  let fragments = [];
  const ws = {
    addEventListener: function (type, fn) {
      (listeners[type] || (listeners[type] = [])).push(fn);
    },
    removeEventListener: function (type, fn) {
      listeners[type] = (listeners[type] || []).filter(function (item) {
        return item !== fn;
      });
    },
    send: function (data) {
      socket.write(encodeFrame(data));
    },
    close: function () {
      socket.end();
    }
  };
  function emit(type, event) {
    (listeners[type] || []).forEach(function (fn) {
      fn(event);
    });
  }
  function takeFrame() {
    if (buf.length < 2) {
      return false;
    }
    const fin = (buf[0] & 128) !== 0;
    const opcode = buf[0] & 15;
    let size = buf[1] & 127;
    let offset = 2;
    if (size === 126) {
      if (buf.length < 4) {
        return false;
      }
      size = buf.readUInt16BE(2);
      offset = 4;
    } else if (size === 127) {
      if (buf.length < 10) {
        return false;
      }
      size = Number(buf.readBigUInt64BE(2));
      offset = 10;
    }
    if (buf.length < offset + size) {
      return false;
    }
    const payload = buf.slice(offset, offset + size);
    buf = buf.slice(offset + size);
    if (opcode === 8) {
      socket.end();
      return true;
    }
    if (opcode === 1 || opcode === 0) {
      fragments.push(payload);
      if (fin) {
        const text = Buffer.concat(fragments).toString();
        fragments = [];
        emit("message", { data: text });
      }
    }
    return true;
  }
  socket.on("error", function () {
    emit("error", {});
  });
  socket.on("data", function (chunk) {
    buf = Buffer.concat([buf, chunk]);
    if (!opened) {
      const split = buf.indexOf("\r\n\r\n");
      if (split < 0) {
        return;
      }
      const header = buf.slice(0, split).toString();
      buf = buf.slice(split + 4);
      if (!header.includes(" 101 ")) {
        emit("error", {});
        socket.destroy();
        return;
      }
      opened = true;
      emit("open", {});
    }
    while (takeFrame()) {
      /* drain */
    }
  });
  socket.on("connect", function () {
    socket.write(
      "GET " + (parsed.pathname || "/") + parsed.search + " HTTP/1.1\r\n" +
      "Host: " + parsed.host + "\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Key: " + randomBytes(16).toString("base64") + "\r\n" +
      "Sec-WebSocket-Version: 13\r\n\r\n"
    );
  });
  return ws;
}

function connectSocket(url) {
  const ws = openSocket(url);
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error("socket"));
    }, 8000);
    ws.addEventListener("open", function () {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", function () {
      clearTimeout(timer);
      reject(new Error("socket"));
    });
  });
}

async function launchChrome() {
  let chromePath = "";
  try {
    chromePath = await ensureChrome();
  } catch (error) {
    if (error && error.code === "browser") {
      throw error;
    }
    const wrapped = new Error("服务器上还没有浏览器，账号登录开不了");
    wrapped.code = "browser";
    throw wrapped;
  }
  if (!chromePath) {
    const error = new Error("服务器上还没有浏览器，账号登录开不了");
    error.code = "browser";
    throw error;
  }
  const dir = mkdtempSync(tmpdir() + "/shen-jingmai-");
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--lang=zh-CN",
    "--window-size=1100,720",
    "--user-data-dir=" + dir,
    "--remote-debugging-port=0",
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });
  try {
    let buf = "";
    const port = await new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        reject(new Error("browser"));
      }, 15000);
      chrome.stderr.on("data", function (chunk) {
        buf = (buf + chunk.toString()).slice(-2000);
        const match = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      chrome.on("exit", function () {
        clearTimeout(timer);
        reject(new Error("browser"));
      });
    });
    const list = await fetch("http://127.0.0.1:" + port + "/json/list").then(function (response) {
      return response.json();
    });
    const page = list.find(function (item) {
      return item.type === "page";
    });
    const ws = await connectSocket(page.webSocketDebuggerUrl);
    return { chrome: chrome, dir: dir, ws: ws, port: port, password: "" };
  } catch (error) {
    try {
      chrome.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

async function readCookies(ws) {
  const result = await send(ws, "Network.getCookies", {});
  return (result.cookies || [])
    .filter(function (cookie) {
      return String(cookie.domain || "").includes("jd.com") && cookie.name && cookie.value;
    })
    .map(function (cookie) {
      return { name: cookie.name, value: cookie.value };
    });
}

function hasSession(cookies) {
  return cookies.some(function (cookie) {
    return SESSION_NAMES.has(cookie.name) && cookie.value;
  });
}

async function pageText(ws) {
  const text = await evaluate(ws, "document.body ? document.body.innerText.slice(0, 500) : ''");
  return String(text || "");
}

function failureMessage(text) {
  if (text.includes("不匹配") || text.includes("密码不正确") || text.includes("账号或密码")) {
    return "账号或密码不正确";
  }
  if (text.includes("登录异常")) {
    return "京麦拒绝了这次服务器登录，请过一会儿再试";
  }
  if (text.includes("冻结") || text.includes("停用")) {
    return "这个账号现在不能登录";
  }
  return "";
}

async function fillAndSubmit(ws, loginName, password) {
  const accountReady = await evaluate(ws, `(() => {
    const el = [...document.querySelectorAll("input")].find((node) => (node.placeholder || "").includes("账号"));
    if (!el) return false;
    el.focus();
    return true;
  })()`);
  if (!accountReady) {
    return false;
  }
  await send(ws, "Input.insertText", { text: loginName });
  const passwordReady = await evaluate(ws, `(() => {
    const el = [...document.querySelectorAll("input")].find((node) => (node.placeholder || "").includes("密码"));
    if (!el) return false;
    el.focus();
    return true;
  })()`);
  if (!passwordReady) {
    return false;
  }
  await send(ws, "Input.insertText", { text: password });
  return evaluate(ws, `(() => {
    const button = [...document.querySelectorAll("button")].find((node) => (node.innerText || "").includes("立即登录"));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

export function browserReady() {
  return Boolean(findChrome());
}

export function resetDesk() {
  stopCurrent();
}

export async function closeDesk() {
  stopCurrent();
}

export async function openDesk({ store, loginName, password }) {
  stopCurrent();
  let desk = null;
  try {
    desk = await launchChrome();
    desk.store = store;
    current = desk;
    await send(desk.ws, "Page.enable");
    await send(desk.ws, "Network.enable");
    await send(desk.ws, "Emulation.setDeviceMetricsOverride", {
      width: 1100,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send(desk.ws, "Page.navigate", { url: LOGIN_URL });
    let ready = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await sleep(700);
      ready = Boolean(await evaluate(desk.ws, "!![...document.querySelectorAll('input')].find((node) => (node.placeholder || '').includes('账号'))"));
      if (ready) {
        break;
      }
    }
    if (!ready) {
      stopCurrent();
      return { status: "login", message: "服务器没有打开京麦登录页" };
    }
    const submitted = await fillAndSubmit(desk.ws, loginName, password);
    password = "";
    if (!submitted) {
      stopCurrent();
      return { status: "login", message: "服务器没有填上账号" };
    }
    await sleep(2500);
    const cookies = await readCookies(desk.ws);
    if (hasSession(cookies)) {
      return { status: "ok", cookies: cookies };
    }
    const message = failureMessage(await pageText(desk.ws));
    if (message) {
      stopCurrent();
      return { status: "login", message: message };
    }
    return { status: "verify" };
  } catch (error) {
    stopCurrent();
    if (error && error.code === "browser") {
      return { status: "login", message: error.message };
    }
    return { status: "login", message: "服务器登录没有打开" };
  } finally {
    password = "";
    if (desk) {
      desk.password = "";
    }
  }
}

export async function pollDesk(store) {
  if (!current || current.store !== store || !current.ws) {
    return { status: "missing", message: "请重新打开登录" };
  }
  try {
    const cookies = await readCookies(current.ws);
    if (hasSession(cookies)) {
      return { status: "ok", cookies: cookies };
    }
    const message = failureMessage(await pageText(current.ws));
    if (message) {
      return { status: "login", message: message };
    }
    return { status: "verify", message: "" };
  } catch {
    return { status: "login", message: "服务器登录中断了" };
  }
}

export async function shotDesk(store) {
  if (!current || current.store !== store || !current.ws) {
    return null;
  }
  try {
    const shot = await send(current.ws, "Page.captureScreenshot", { format: "jpeg", quality: 60 });
    return Buffer.from(shot.data || "", "base64");
  } catch {
    return null;
  }
}

export async function clickDesk(store, x, y) {
  if (!current || current.store !== store || !current.ws) {
    return;
  }
  const point = { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
  await send(current.ws, "Input.dispatchMouseEvent", Object.assign({ type: "mousePressed", button: "left", clickCount: 1 }, point));
  await send(current.ws, "Input.dispatchMouseEvent", Object.assign({ type: "mouseReleased", button: "left", clickCount: 1 }, point));
}

export async function typeDesk(store, text) {
  if (!current || current.store !== store || !current.ws) {
    return;
  }
  const value = String(text || "").slice(0, 20);
  if (!value) {
    return;
  }
  await send(current.ws, "Input.insertText", { text: value });
}

export const jingmaiDesk = {
  open: openDesk,
  poll: pollDesk,
  shot: shotDesk,
  click: clickDesk,
  type: typeDesk,
  close: closeDesk,
  reset: resetDesk
};
