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
        peopleQ.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        peopleQ.value = "yangrunze";
        peopleQ.dispatchEvent(new Event("input", { bubbles: true }));
        peopleQ.value = "杨润泽";
        peopleQ.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "杨润泽" }));
        await sleep(200);
        const peopleFocusOk = document.activeElement === peopleQ;
        const peopleNames = Array.prototype.map.call(document.querySelectorAll("#people-tbody tr"), function (tr) {
          return (tr.cells[1] && tr.cells[1].textContent) || "";
        });
        document.querySelector('[data-pane="stores"]').click();
        await sleep(200);
        const storeQ = document.getElementById("org-q");
        storeQ.focus();
        storeQ.value = "ZYUO";
        storeQ.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(200);
        const storeText = Array.prototype.map.call(document.querySelectorAll("#org-tbody tr"), function (tr) {
          return tr.textContent;
        });
        const peopleOk =
          peopleFocusOk &&
          peopleNames.some(function (name) { return name.indexOf("杨润泽") >= 0; }) &&
          peopleNames.length >= 1 &&
          peopleNames.length < 16;
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

const RESERVE_SMOKE = `<!doctype html>
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
        await sleep(400);
        document.querySelector('[data-pane="members"]').click();
        await sleep(600);
        const row = Array.prototype.find.call(document.querySelectorAll("#people-tbody tr"), function (tr) {
          return tr.cells[1] && tr.cells[1].textContent.indexOf("陈明婧") >= 0;
        });
        if (!row) {
          document.body.setAttribute("data-ok", "no-row");
          return;
        }
        const id = row.getAttribute("data-id");
        function dbl(el) {
          el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        }
        const cell = row.querySelector('td[data-field="reserve"]');
        const beforeBox = cell.getBoundingClientRect();
        dbl(cell);
        await sleep(80);
        const input = cell.querySelector("input");
        if (!input) {
          document.body.setAttribute("data-ok", "no-input");
          return;
        }
        const afterBox = cell.getBoundingClientRect();
        const grew = afterBox.width > beforeBox.width + 8 || afterBox.height > beforeBox.height + 8;
        input.focus();
        input.value = "张文静";
        input.dispatchEvent(new CompositionEvent("compositionend", { data: "张文静" }));
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        await sleep(900);
        const cell2 = document.querySelector('#people-tbody tr[data-id="' + id + '"] td[data-field="reserve"]');
        const afterFill = (cell2 && cell2.textContent) || "";
        dbl(cell2);
        await sleep(80);
        const input2 = cell2.querySelector("input");
        if (!input2) {
          document.body.setAttribute("data-after", afterFill);
          document.body.setAttribute("data-ok", "no-reedit");
          return;
        }
        input2.focus();
        input2.value = "杨润泽";
        input2.dispatchEvent(new CompositionEvent("compositionend", { data: "杨润泽" }));
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        await sleep(900);
        const cell3 = document.querySelector('#people-tbody tr[data-id="' + id + '"] td[data-field="reserve"]');
        const afterChange = (cell3 && cell3.textContent) || "";
        const assist = document.querySelector('#people-tbody tr[data-id="' + id + '"] td[data-field="assistant"]');
        const assistBefore = assist.getBoundingClientRect();
        dbl(assist);
        await sleep(80);
        const assistInput = assist.querySelector("input");
        const assistBox = assist.getBoundingClientRect();
        const assistGrew = assistBox.width > assistBefore.width + 8 || assistBox.height > assistBefore.height + 8;
        if (!assistInput) {
          document.body.setAttribute("data-ok", "no-assist");
          return;
        }
        assistInput.value = "小助";
        assistInput.dispatchEvent(new CompositionEvent("compositionend", { data: "小助" }));
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        await sleep(900);
        const assistAfter = document.querySelector('#people-tbody tr[data-id="' + id + '"] td[data-field="assistant"]');
        const assistText = (assistAfter && assistAfter.textContent) || "";
        document.body.setAttribute("data-after", afterFill);
        document.body.setAttribute("data-changed", afterChange);
        document.body.setAttribute("data-assist", assistText);
        document.body.setAttribute("data-grew", grew || assistGrew ? "1" : "0");
        document.body.setAttribute("data-ok", !grew && !assistGrew && afterFill.indexOf("张文静") >= 0 && afterChange.indexOf("杨润泽") >= 0 && assistText.indexOf("小助") >= 0 ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

const DEFERRED_FILTER_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><link rel="stylesheet" href="/people.css" /></head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        await sleep(700);
        const before = document.querySelectorAll("#org-tbody tr[data-id]").length;
        document.querySelector('.org-filter-btn[data-filter-key="manager"]').click();
        await sleep(50);
        const first = document.querySelector("#org-filter-pop .org-filter-value");
        first.checked = false;
        first.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(80);
        const during = document.querySelectorAll("#org-tbody tr[data-id]").length;
        const popOpen = !document.getElementById("org-filter-pop").hidden;
        document.getElementById("org-count").click();
        await sleep(120);
        const after = document.querySelectorAll("#org-tbody tr[data-id]").length;
        const popClosed = document.getElementById("org-filter-pop").hidden;
        document.body.setAttribute("data-before", String(before));
        document.body.setAttribute("data-during", String(during));
        document.body.setAttribute("data-after", String(after));
        document.body.setAttribute(
          "data-ok",
          popOpen && popClosed && during === before && after < before ? "1" : "0"
        );
      })();
    </script>
  </body>
</html>`;

test("headless chrome applies column filters only after popup closes", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__deferred-filter-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(DEFERRED_FILTER_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__deferred-filter-smoke`, 10000);
    assert.match(html, /data-ok="1"/, html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 180) : html.slice(-400));
    const before = Number(html.match(/data-before="(\d+)"/)?.[1]);
    const during = Number(html.match(/data-during="(\d+)"/)?.[1]);
    const after = Number(html.match(/data-after="(\d+)"/)?.[1]);
    assert.equal(during, before);
    assert.ok(after < before);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

const PEOPLE_FORM_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><link rel="stylesheet" href="/people.css" /></head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        await sleep(500);
        document.querySelector('[data-pane="members"]').click();
        await sleep(500);
        document.getElementById("people-add").click();
        await sleep(80);
        const form = document.getElementById("people-form");
        const name = form.elements.namedItem("name");
        name.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
        name.value = "ceshirenyuan";
        name.dispatchEvent(new Event("input", { bubbles: true }));
        name.value = "测试人员";
        name.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "测试人员" }));
        name.dispatchEvent(new Event("input", { bubbles: true }));
        const manager = form.elements.namedItem("manager");
        const managerRect = manager.getBoundingClientRect();
        const managerHit = document.elementFromPoint(
          managerRect.left + managerRect.width / 2,
          managerRect.top + managerRect.height / 2
        );
        if (managerHit === manager) {
          manager.focus();
          manager.value = "测试经理";
          manager.dispatchEvent(new Event("input", { bubbles: true }));
        }
        await sleep(80);
        const ok =
          name.value === "测试人员" &&
          form.elements.namedItem("username").value === "测试人员" &&
          managerHit === manager &&
          document.activeElement === manager &&
          manager.value === "测试经理";
        document.body.setAttribute("data-name", name.value);
        document.body.setAttribute("data-account", form.elements.namedItem("username").value);
        document.body.setAttribute("data-manager", manager.value);
        document.body.setAttribute("data-hit", managerHit && managerHit.name || managerHit && managerHit.id || "");
        document.body.setAttribute("data-ok", ok ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome can type Chinese in add-person form", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__people-form-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PEOPLE_FORM_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__people-form-smoke`, 10000);
    assert.match(html, /data-ok="1"/, html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 160) : html.slice(-400));
    assert.match(html, /data-name="测试人员"/);
    assert.match(html, /data-account="测试人员"/);
    assert.match(html, /data-manager="测试经理"/);
    assert.match(html, /data-hit="manager"/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

const STORE_CLEAR_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><link rel="stylesheet" href="/people.css" /></head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        await sleep(700);
        const row = document.querySelector("#org-tbody tr[data-id]");
        const id = row && row.getAttribute("data-id");
        const cell = row && row.querySelector('td[data-field="operator"]');
        if (!cell) {
          document.body.setAttribute("data-ok", "no-cell");
          return;
        }
        cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        await sleep(80);
        const input = cell.querySelector("input");
        if (!input) {
          document.body.setAttribute("data-ok", "no-input");
          return;
        }
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.getElementById("org-count").dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
        );
        await sleep(900);
        const savedCell = document.querySelector(
          '#org-tbody tr[data-id="' + id + '"] td[data-field="operator"]'
        );
        const listed = await fetch("/api/people/org/stores").then(function (res) { return res.json(); });
        const stored = (listed.stores || []).find(function (item) { return String(item.id) === String(id); });
        const text = (savedCell && savedCell.textContent || "").trim();
        document.body.setAttribute("data-cell", text);
        document.body.setAttribute("data-stored", stored && stored.operator || "");
        document.body.setAttribute(
          "data-ok",
          text === "—" && stored && stored.operator === "" && !savedCell.querySelector("input") ? "1" : "0"
        );
      })();
    </script>
  </body>
</html>`;

test("headless chrome saves a cleared store cell on outside pointer", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__store-clear-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(STORE_CLEAR_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__store-clear-smoke`, 10000);
    assert.match(html, /data-ok="1"/, html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 120) : html.slice(-400));
    assert.match(html, /data-cell="—"/);
    assert.match(html, /data-stored=""/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("headless chrome can fill and change 储备", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__reserve-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(RESERVE_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__reserve-smoke`, 12000);
    assert.match(html, /data-ok="1"/, html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 120) : html.slice(-400));
    assert.match(html, /data-after="张文静"/);
    assert.match(html, /data-changed="杨润泽"/);
    assert.match(html, /data-assist="小助"/);
    assert.match(html, /data-grew="0"/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

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
