import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const LOGIN_URL =
  "https://passport.shop.jd.com/login/index.action/jdm?ReturnUrl=" + encodeURIComponent("https://shop.jd.com/");
const SESSION_NAMES = new Set(["thor", "pt_key"]);

let current = null;

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome"
  ];
  return candidates.find(function (path) {
    return path && existsSync(path);
  }) || "";
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

function connectSocket(url) {
  const ws = new WebSocket(url);
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
  const chromePath = findChrome();
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
