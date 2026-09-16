import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { resetOrgBoard } from "../src/modules/people/org-board.js";
import { resetOrgExtra } from "../src/modules/people/org-extra.js";
import { resetPeopleStore } from "../src/modules/people/store.js";

const SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="/people.css" />
  </head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        const root = document.getElementById("xm-content");
        const mod = window.XmModules && window.XmModules["/people"];
        if (!mod) {
          document.body.setAttribute("data-ok", "no-mod");
          return;
        }
        mod.mount(root);
        await sleep(800);
        document.querySelector('[data-pane="members"]').click();
        await sleep(500);
        const kpiText = (document.getElementById("people-kpis") && document.getElementById("people-kpis").textContent) || "";
        const kpiOk = kpiText.indexOf("总监") >= 0 && kpiText.indexOf("经理") >= 0 && kpiText.indexOf("主管") >= 0 && kpiText.indexOf("储备") >= 0 && kpiText.indexOf("运营") >= 0 && kpiText.indexOf("助理") >= 0;
        document.body.setAttribute("data-kpis", kpiText.replace(/\\s+/g, " ").trim());
        const peopleQ = document.getElementById("people-q");
        peopleQ.focus();
        peopleQ.value = "杨润泽";
        peopleQ.dispatchEvent(new Event("input", { bubbles: true }));
        if (window.__xmSearchPeople) { window.__xmSearchPeople(); }
        await sleep(200);
        const peopleNames = Array.prototype.map.call(document.querySelectorAll("#people-tbody tr"), function (tr) {
          return (tr.cells[1] && tr.cells[1].textContent) || "";
        });
        document.querySelector('[data-pane="stores"]').click();
        await sleep(200);
        const storeQ = document.getElementById("org-q");
        storeQ.focus();
        storeQ.value = "ZYUO";
        storeQ.dispatchEvent(new Event("input", { bubbles: true }));
        if (window.__xmSearchStores) { window.__xmSearchStores(); }
        await sleep(200);
        const storeText = Array.prototype.map.call(document.querySelectorAll("#org-tbody tr"), function (tr) {
          return tr.textContent;
        });
        const peopleOk = peopleNames.some(function (name) { return name.indexOf("杨润泽") >= 0; }) && peopleNames.length >= 1 && peopleNames.length < 16;
        const storeOk = storeText.some(function (text) { return text.indexOf("ZYUO") >= 0; }) && storeText.length >= 1 && storeText.length < 15;
        document.body.setAttribute("data-people-n", String(peopleNames.length));
        document.body.setAttribute("data-people-names", peopleNames.join(","));
        document.body.setAttribute("data-store-n", String(storeText.length));
        document.body.setAttribute("data-ok", peopleOk && storeOk && kpiOk ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

function chromeDump(url, budget = 8000) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "xm-chrome-"));
  const bin = fs.existsSync("/opt/google/chrome/chrome") ? "/opt/google/chrome/chrome" : "google-chrome";
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--user-data-dir=" + profile,
        "--virtual-time-budget=" + budget,
        "--timeout=15000",
        "--dump-dom",
        url
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("chrome timeout: " + err.slice(-400)));
    }, 20000);
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch (_err) {
        /* ignore */
      }
      if (!out) {
        reject(new Error(err || "chrome exit " + code));
        return;
      }
      resolve(out);
    });
  });
}

const RIGHTS_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="/people.css" />
  </head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        const root = document.getElementById("xm-content");
        const mod = window.XmModules && window.XmModules["/people"];
        if (!mod) {
          document.body.setAttribute("data-ok", "no-mod");
          return;
        }
        mod.mount(root);
        document.querySelector('[data-pane="rights"]').click();
        await sleep(1200);
        const rightsHtml = (document.getElementById("rights-tree-chart") && document.getElementById("rights-tree-chart").innerHTML) || "";
        const ok = rightsHtml.indexOf("rights-mod-band") >= 0 && rightsHtml.indexOf("rights-mod-lead") >= 0 && rightsHtml.indexOf("韩梦凯") >= 0 && rightsHtml.indexOf("杨润泽") >= 0 && rightsHtml.indexOf("data-role=\\"主管\\"") >= 0 && rightsHtml.indexOf("data-role=\\"运营\\"") >= 0;
        document.body.setAttribute("data-rights-n", String(rightsHtml.length));
        document.body.setAttribute("data-ok", ok ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome can type-search people and stores", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__search-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SMOKE);
      return;
    }
    if (req.url === "/__rights-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(RIGHTS_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__search-smoke`);
    assert.match(html, /data-ok="1"/, html.slice(html.indexOf("<body"), html.indexOf("<body") + 800));
    const rights = await chromeDump(`http://127.0.0.1:${port}/__rights-smoke`, 12000);
    assert.match(rights, /data-ok="1"/, rights.includes("data-ok=") ? rights.slice(rights.indexOf("data-ok="), rights.indexOf("data-ok=") + 80) : rights.slice(-400));
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
