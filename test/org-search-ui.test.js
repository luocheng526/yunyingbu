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
import { resetSiteAcl } from "../src/modules/people/site-acl.js";

test.beforeEach(() => {
  resetSiteAcl();
});

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
        const yangLead = Array.prototype.find.call(
          document.querySelectorAll(".rights-mod-lead"),
          function (lead) {
            const supervisor = lead.querySelector('.rights-mod-card[data-role="主管"]');
            return supervisor && supervisor.textContent.trim() === "杨润泽";
          }
        );
        const yangSelfOperator =
          yangLead && Array.prototype.some.call(
            yangLead.querySelectorAll('.rights-mod-card[data-role="运营"]'),
            function (card) { return card.textContent.trim() === "杨润泽"; }
          );
        const ok = rightsHtml.indexOf("rights-mod-band") >= 0 && rightsHtml.indexOf("rights-mod-lead") >= 0 && rightsHtml.indexOf("韩梦凯") >= 0 && rightsHtml.indexOf("杨润泽") >= 0 && rightsHtml.indexOf("data-role=\\"主管\\"") >= 0 && rightsHtml.indexOf("data-role=\\"运营\\"") >= 0 && yangSelfOperator;
        document.body.setAttribute("data-self-operator", yangSelfOperator ? "1" : "0");
        document.body.setAttribute("data-rights-n", String(rightsHtml.length));
        document.body.setAttribute("data-ok", ok ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

const SPLIT_OPS_SMOKE = `<!doctype html>
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
        async function post(url, body) {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          return res.json();
        }
        await post("/api/people", { name: "刘璇", role: "运营", center: "韩梦凯运营中心", lineManager: "韩梦凯", supervisor: "陈晓曼", operator: "刘璇", status: "在职" });
        await post("/api/people", { name: "潘梦玉", role: "运营", center: "韩梦凯运营中心", lineManager: "韩梦凯", supervisor: "陈晓曼", operator: "", assistant: "潘梦玉", status: "在职" });
        await post("/api/people/org/stores", { storeName: "飒望生活日用旗舰店", manager: "韩梦凯", supervisor: "陈晓曼", operator: "刘璇", assistant: "潘梦玉", remark: "运营中" });
        await post("/api/people/org/stores", { storeName: "ZYUO驱蚊驱虫旗舰店", manager: "韩梦凯", supervisor: "陈晓曼", operator: "刘璇", assistant: "", remark: "运营中" });
        await post("/api/people/org/stores", { storeName: "无运营对照店", manager: "韩梦凯", supervisor: "陈晓曼", operator: "", assistant: "", remark: "运营中" });
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        document.querySelector('[data-pane="rights"]').click();
        await sleep(1200);
        const chenLead = Array.prototype.find.call(document.querySelectorAll(".rights-mod-lead"), function (lead) {
          const supervisor = lead.querySelector('.rights-mod-card[data-role="主管"]');
          return supervisor && supervisor.textContent.trim() === "陈晓曼";
        });
        const rows = chenLead ? Array.prototype.map.call(chenLead.querySelectorAll(".rights-mod-row"), function (row) {
          const cols = row.querySelectorAll(".rights-mod-col");
          return {
            op: ((cols[0] && cols[0].textContent) || "").replace(/\\s+/g, " ").trim(),
            asst: ((cols[1] && cols[1].textContent) || "").replace(/\\s+/g, " ").trim(),
            shops: ((cols[2] && cols[2].textContent) || "").replace(/\\s+/g, " ").trim()
          };
        }) : [];
        const panRow = rows.find(function (row) { return row.asst.indexOf("潘梦玉") >= 0; });
        const liuSolo = rows.find(function (row) { return row.op.indexOf("刘璇") >= 0 && row.asst.indexOf("潘梦玉") < 0; });
        const chenOp = rows.find(function (row) { return row.op.indexOf("陈晓曼") >= 0 && row.shops.indexOf("无运营对照店") >= 0; });
        const panAlone = panRow && panRow.shops.indexOf("飒望生活日用旗舰店") >= 0 && panRow.shops.indexOf("ZYUO驱蚊驱虫旗舰店") < 0;
        const liuAlone = liuSolo && liuSolo.shops.indexOf("ZYUO驱蚊驱虫旗舰店") >= 0 && liuSolo.shops.indexOf("飒望生活日用旗舰店") < 0;
        document.body.setAttribute("data-rows", JSON.stringify(rows));
        document.body.setAttribute("data-pan", panAlone ? "1" : "0");
        document.body.setAttribute("data-liu", liuAlone ? "1" : "0");
        document.body.setAttribute("data-fallback", chenOp ? "1" : "0");
        document.body.setAttribute("data-ok", panAlone && liuAlone && chenOp ? "1" : "0");
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

const BLOCKING_NOTICE_SMOKE = `<!doctype html>
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
        const mask = document.createElement("div");
        mask.id = "xm-notice-mask";
        mask.style.cssText = "position:fixed;inset:0;z-index:80;display:flex";
        mask.innerHTML =
          '<div class="xm-notice-dialog"><button id="notice-action" type="button">查看公告</button></div>';
        document.body.append(mask);
        await sleep(80);
        const search = document.getElementById("people-q");
        search.scrollIntoView({ block: "center" });
        const searchRect = search.getBoundingClientRect();
        const sx = Math.min(window.innerWidth - 2, Math.max(2, searchRect.left + searchRect.width / 2));
        const sy = Math.min(window.innerHeight - 2, Math.max(2, searchRect.top + searchRect.height / 2));
        const searchHit = document.elementFromPoint(sx, sy);
        const noticeButton = document.getElementById("notice-action");
        const noticeRect = noticeButton.getBoundingClientRect();
        const noticeHit = document.elementFromPoint(
          noticeRect.left + noticeRect.width / 2,
          noticeRect.top + noticeRect.height / 2
        );
        document.body.setAttribute("data-search-hit", searchHit && searchHit.id || "");
        document.body.setAttribute("data-notice-hit", noticeHit && noticeHit.id || "");
        document.body.setAttribute(
          "data-ok",
          searchHit === mask && noticeHit === noticeButton ? "1" : "0"
        );
      })();
    </script>
  </body>
</html>`;

test("headless chrome keeps explicit login notices blocking", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__blocking-notice-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(BLOCKING_NOTICE_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__blocking-notice-smoke`, 10000);
    assert.match(html, /data-ok="1"/, html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 180) : html.slice(-400));
    assert.match(html, /data-search-hit="xm-notice-mask"/);
    assert.match(html, /data-notice-hit="notice-action"/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

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

const FILTER_HEADER_ON_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><link rel="stylesheet" href="/people.css" /></head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        function snap(prefix, btn) {
          const th = btn.closest("th");
          const name = btn.querySelector(".org-filter-name");
          const thCs = getComputedStyle(th);
          const nameCs = getComputedStyle(name);
          document.body.setAttribute("data-" + prefix + "-on", btn.classList.contains("is-on") && th.classList.contains("is-on") ? "1" : "0");
          document.body.setAttribute("data-" + prefix + "-bg", thCs.backgroundColor.replace(/\\s+/g, ""));
          document.body.setAttribute("data-" + prefix + "-color", nameCs.color.replace(/\\s+/g, ""));
        }
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        await sleep(700);
        const reserveBtn = document.querySelector('.org-filter-btn[data-filter-key="reserve"]');
        const managerBtn = document.querySelector('.org-filter-btn[data-filter-key="manager"]');
        snap("before", reserveBtn);
        reserveBtn.click();
        await sleep(50);
        const first = document.querySelector("#org-filter-pop .org-filter-value");
        first.checked = false;
        first.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(80);
        snap("during", reserveBtn);
        document.getElementById("org-count").click();
        await sleep(120);
        snap("after", reserveBtn);
        snap("manager", managerBtn);
        const ok =
          document.body.getAttribute("data-before-on") === "0" &&
          document.body.getAttribute("data-during-on") === "1" &&
          document.body.getAttribute("data-after-on") === "1" &&
          document.body.getAttribute("data-manager-on") === "0" &&
          document.body.getAttribute("data-after-bg") === "rgb(217,217,217)" &&
          document.body.getAttribute("data-after-color") === "rgb(38,38,38)";
        document.body.setAttribute("data-ok", ok ? "1" : "0");
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

test("headless chrome darkens filtered 储备 header", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__filter-header-on-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(FILTER_HEADER_ON_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__filter-header-on-smoke`, 10000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 280) : html.slice(-400)
    );
    assert.match(html, /data-before-on="0"/);
    assert.match(html, /data-during-on="1"/);
    assert.match(html, /data-after-on="1"/);
    assert.match(html, /data-manager-on="0"/);
    assert.match(html, /data-after-bg="rgb\(217,217,217\)"/);
    assert.match(html, /data-after-color="rgb\(38,38,38\)"/);
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
        cell.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
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

const STORE_CLICK_SMOKE = `<!doctype html>
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
        const fields = ["director","manager","supervisor","reserve","operator","assistant","storeName","formerNames","storeId","merchantId","remark","updatedOn","closedOn","login","password"];
        const missing = [];
        fields.forEach(function (field) {
          const cell = document.querySelector('#org-tbody tr[data-id] td[data-field="' + field + '"]');
          if (!cell) {
            missing.push("td:" + field);
            return;
          }
          cell.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          const editor = cell.querySelector(field === "remark" ? "select" : "input");
          if (!editor) {
            missing.push(field);
          }
        });
        document.getElementById("org-count").dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
        );
        await sleep(400);
        const row = document.querySelector("#org-tbody tr[data-id]");
        const login = row && row.querySelector('td[data-field="login"]');
        if (!login) {
          document.body.setAttribute("data-missing", missing.join(","));
          document.body.setAttribute("data-ok", "no-login-td");
          return;
        }
        login.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        const loginInput = login.querySelector("input");
        if (!loginInput) {
          document.body.setAttribute("data-missing", missing.join(","));
          document.body.setAttribute("data-ok", "no-login-input");
          return;
        }
        loginInput.value = "demo_click_login";
        loginInput.dispatchEvent(new Event("input", { bubbles: true }));
        document.getElementById("org-count").dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
        );
        await sleep(800);
        const listed = await fetch("/api/people/org/stores").then(function (res) { return res.json(); });
        const id = row.getAttribute("data-id");
        const stored = (listed.stores || []).find(function (item) { return String(item.id) === String(id); });
        document.body.setAttribute("data-missing", missing.join(","));
        document.body.setAttribute("data-login", stored && stored.login || "");
        document.body.setAttribute("data-ok", !missing.length && stored && stored.login === "demo_click_login" ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome clicks every store column to edit", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__store-click-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(STORE_CLICK_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__store-click-smoke`, 16000);
    assert.match(html, /data-ok="1"/, html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 180) : html.slice(-400));
    assert.match(html, /data-login="demo_click_login"/);
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
    assert.match(rights, /data-self-operator="1"/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

const LEFTOVER_PEOPLE_SMOKE = `<!doctype html>
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
        async function post(url, body) {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          return res.json();
        }
        await post("/api/people", { name: "张航", role: "运营", center: "沈子晗运营中心", lineManager: "沈子晗", operator: "张航", status: "在职" });
        await post("/api/people", { name: "贾孜怡", role: "助理", center: "沈子晗运营中心", lineManager: "沈子晗", operator: "", assistant: "贾孜怡", status: "在职" });
        await post("/api/people", { name: "王煜斐", role: "助理", center: "沈子晗运营中心", lineManager: "沈子晗", operator: "", assistant: "王煜斐", status: "在职" });
        await post("/api/people", { name: "赵庆举", role: "助理", center: "沈子晗运营中心", lineManager: "沈子晗", operator: "", assistant: "赵庆举", status: "在职" });
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        document.querySelector('[data-pane="rights"]').click();
        await sleep(1400);
        const shenBand = Array.prototype.find.call(document.querySelectorAll(".rights-mod-band"), function (band) {
          const manager = band.querySelector('.rights-mod-card[data-role="经理"]');
          return manager && manager.textContent.trim() === "沈子晗";
        });
        const leftover = shenBand && Array.prototype.find.call(shenBand.querySelectorAll(".rights-mod-lead"), function (lead) {
          const supervisor = lead.querySelector('.rights-mod-card[data-role="主管"]');
          const reserve = lead.querySelector('.rights-mod-card[data-role="储备"]');
          const hang = ((lead.querySelector(".rights-mod-chain") && lead.querySelector(".rights-mod-chain").textContent) || "").replace(/\\s+/g, " ");
          return !supervisor && !reserve && hang.indexOf("张航") >= 0;
        });
        const leftoverText = leftover ? leftover.textContent.replace(/\\s+/g, " ").trim() : "";
        const blankLeads = shenBand ? Array.prototype.filter.call(shenBand.querySelectorAll(".rights-mod-lead"), function (lead) {
          const text = lead.textContent.replace(/\\s+/g, " ").trim();
          return text.indexOf("填写对应的店铺") >= 0 || /^[—\\-\\s无]+$/.test(text) || (text.indexOf("无") >= 0 && text.indexOf("填写") >= 0 && !lead.querySelector(".rights-mod-card"));
        }).length : -1;
        const hasZhang = leftoverText.indexOf("张航") >= 0;
        const hasJia = leftoverText.indexOf("贾孜怡") >= 0;
        const hasWang = leftoverText.indexOf("王煜斐") >= 0;
        const hasZhao = leftoverText.indexOf("赵庆举") >= 0;
        const hasUnassigned = leftoverText.indexOf("未分配店铺") >= 0;
        document.body.setAttribute("data-hang", leftoverText);
        document.body.setAttribute("data-blank", String(blankLeads));
        document.body.setAttribute("data-ok", leftover && hasZhang && hasJia && hasWang && hasZhao && hasUnassigned && blankLeads === 0 ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome shows leftover people instead of a blank rights row", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__leftover-people-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(LEFTOVER_PEOPLE_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__leftover-people-smoke`, 14000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 400) : html.slice(-500)
    );
    assert.match(html, /data-blank="0"/);
    assert.match(html, /张航/);
    assert.match(html, /贾孜怡/);
    assert.match(html, /未分配店铺/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("headless chrome splits 潘梦玉 and 刘璇 operator cards", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__split-ops-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SPLIT_OPS_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__split-ops-smoke`, 14000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 400) : html.slice(-500)
    );
    assert.match(html, /data-pan="1"/);
    assert.match(html, /data-liu="1"/);
    assert.match(html, /data-fallback="1"/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

const SITE_ACL_SMOKE = `<!doctype html>
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
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        document.querySelector('[data-pane="acl"]').click();
        await sleep(900);
        const person = Array.prototype.find.call(document.querySelectorAll("[data-acl-person]"), function (btn) {
          return btn.getAttribute("data-acl-person") === "张文静";
        });
        if (!person) {
          document.body.setAttribute("data-ok", "no-person");
          return;
        }
        person.click();
        await sleep(500);
        const workbench = document.querySelector('input[data-acl-kind="feature"][data-acl-id="home.workbench"][data-acl-cap="see"]');
        const storeSee = document.querySelector('input[data-acl-kind="store"][data-acl-cap="see"]');
        if (!workbench || !storeSee) {
          document.body.setAttribute("data-ok", "no-box");
          return;
        }
        const storeId = storeSee.getAttribute("data-acl-id");
        workbench.click();
        const enter = document.querySelector('input[data-acl-kind="feature"][data-acl-id="home.workbench"][data-acl-cap="enter"]');
        if (enter) {
          enter.click();
        }
        const storeSee2 = document.querySelector('input[data-acl-kind="store"][data-acl-id="' + storeId + '"][data-acl-cap="see"]');
        if (storeSee2) {
          storeSee2.click();
        }
        document.getElementById("site-acl-save").click();
        await sleep(700);
        const after = await fetch("/api/people/org/site-acl/me?actor=" + encodeURIComponent("张文静")).then(function (res) { return res.json(); });
        const homeOk = after.me && after.me.modules.home && after.me.modules.home.features["home.workbench"].enter;
        const storeOk = after.me && after.me.stores && after.me.stores[storeId] && after.me.stores[storeId].see;
        const gateOff = after.me && after.me.modules.releases && after.me.modules.releases.features["releases.gate"].see === false;
        const captions = Array.prototype.map.call(document.querySelectorAll(".site-acl-mod caption"), function (el) {
          return el.textContent.trim();
        });
        const catalogOk =
          captions.indexOf("智能人事") >= 0 &&
          captions.indexOf("边界数据中心") >= 0 &&
          captions.indexOf("工作汇报") >= 0 &&
          captions.indexOf("月度大会") >= 0 &&
          captions.indexOf("需求与反馈") >= 0 &&
          captions.indexOf("星脉数据中心") >= 0;
        document.body.setAttribute("data-home", homeOk ? "1" : "0");
        document.body.setAttribute("data-store", storeOk ? "1" : "0");
        document.body.setAttribute("data-hr", catalogOk ? "1" : "0");
        document.body.setAttribute("data-ok", person && homeOk && storeOk && gateOff && catalogOk ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

const LOGIN_OPS_SMOKE = `<!doctype html>
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
        document.querySelector('[data-pane="members"]').click();
        await sleep(500);
        const loginBtn = document.querySelector(".people-login-btn");
        const passBtn = document.querySelector(".people-pass-btn");
        if (!loginBtn || !passBtn) {
          document.body.setAttribute("data-ok", "no-btn");
          return;
        }
        loginBtn.click();
        await sleep(80);
        const loginModal = document.getElementById("people-login-modal");
        const loginTitle = (document.getElementById("people-login-title") && document.getElementById("people-login-title").textContent) || "";
        const loginAccount = document.querySelector('#people-login-form input[name="username"]');
        const loginPass = document.querySelector('#people-login-form input[name="password"]');
        const loginOk = loginModal && loginModal.classList.contains("show") && loginTitle.indexOf("登录信息") >= 0 && loginAccount && loginAccount.value && loginPass && loginPass.value;
        document.getElementById("people-login-close").click();
        await sleep(40);
        passBtn.click();
        await sleep(80);
        const passModal = document.getElementById("people-pass-modal");
        const passTitle = (document.getElementById("people-pass-title") && document.getElementById("people-pass-title").textContent) || "";
        const newPass = document.querySelector('#people-pass-form input[name="password"]');
        const confirm = document.querySelector('#people-pass-form input[name="confirm"]');
        const passOk = passModal && passModal.classList.contains("show") && passTitle.indexOf("设置密码") >= 0 && newPass && confirm;
        document.body.setAttribute("data-login-title", loginTitle);
        document.body.setAttribute("data-pass-title", passTitle);
        document.body.setAttribute("data-ok", loginOk && passOk ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

const DEPT_BOARDS_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><link rel="stylesheet" href="/people.css" /></head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        function headersOf() {
          return Array.prototype.map.call(document.querySelectorAll('[data-pane="members"] thead th'), function (th) {
            return th.textContent.replace(/▾/g, "").trim();
          });
        }
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        await sleep(700);
        document.querySelector('[data-pane="members"]').click();
        await sleep(500);
        const tabs = Array.prototype.map.call(document.querySelectorAll(".people-dept-tab"), function (btn) {
          return btn.textContent.trim();
        });
        const opsHeaders = headersOf();
        const opsActive = document.querySelector('.people-dept-tab[data-board="ops"]').classList.contains("is-active");
        const opsHasShen = Array.prototype.some.call(document.querySelectorAll("#people-tbody tr"), function (tr) {
          return ((tr.cells[1] && tr.cells[1].textContent) || "").indexOf("沈子晗") >= 0;
        });
        document.querySelector('.people-dept-tab[data-board="hrTech"]').click();
        await sleep(200);
        const hrActive = document.querySelector('.people-dept-tab[data-board="hrTech"]').classList.contains("is-active");
        const hrEmpty = (document.querySelector("#people-tbody") && document.querySelector("#people-tbody").textContent) || "";
        const hrHeaders = headersOf();
        document.querySelector('.people-dept-tab[data-board="backend"]').click();
        await sleep(200);
        const backendEmpty = (document.querySelector("#people-tbody") && document.querySelector("#people-tbody").textContent) || "";
        const backendHeaders = headersOf();
        const headerNeed = ["姓名", "总监", "经理", "主管", "储备", "运营", "助理", "状态", "账号", "登录密码"];
        const headerOk = headerNeed.every(function (name) { return opsHeaders.indexOf(name) >= 0; });
        const sameHeaders = opsHeaders.join("|") === hrHeaders.join("|") && hrHeaders.join("|") === backendHeaders.join("|");
        const tabsOk = tabs.join(",") === "运营部门管理,人事和技术部门,后端部门";
        document.body.setAttribute("data-tabs", tabs.join(","));
        document.body.setAttribute("data-headers", opsHeaders.join(","));
        document.body.setAttribute("data-hr", hrEmpty.replace(/\\s+/g, " ").trim());
        document.body.setAttribute("data-ok", tabsOk && opsActive && opsHasShen && hrActive && hrEmpty.indexOf("还没有人") >= 0 && backendEmpty.indexOf("还没有人") >= 0 && sameHeaders && headerOk ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome opens 登录信息 and 设置密码 from 成员管理", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__login-ops-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(LOGIN_OPS_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__login-ops-smoke`, 12000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 240) : html.slice(-400)
    );
    assert.match(html, /data-login-title="登录信息/);
    assert.match(html, /data-pass-title="设置密码/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("headless chrome switches 运营 / 人事技术 / 后端 boards with the same headers", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__dept-boards-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(DEPT_BOARDS_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__dept-boards-smoke`, 12000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 360) : html.slice(-400)
    );
    assert.match(html, /data-tabs="运营部门管理,人事和技术部门,后端部门"/);
    assert.match(html, /data-headers="[^"]*姓名[^"]*总监[^"]*经理/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("headless chrome assigns website see/enter/edit for a roster person", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  resetSiteAcl();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__site-acl-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SITE_ACL_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__site-acl-smoke`, 16000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 240) : html.slice(-400)
    );
    assert.match(html, /data-home="1"/);
    assert.match(html, /data-store="1"/);
    assert.match(html, /data-hr="1"/);
    assert.match(html, /智能人事/);
    assert.match(html, /边界数据中心/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

const NOTICE_TAB_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><link rel="stylesheet" href="/people.css" /></head>
  <body>
    <div id="xm-content"></div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        await sleep(400);
        const tabs = Array.prototype.map.call(document.querySelectorAll(".org-tab-name"), function (el) {
          return el.textContent.trim();
        });
        document.body.setAttribute("data-org-tabs", tabs.join(","));
        const noticeTab = document.querySelector('.org-tab[data-pane="notices"]');
        if (noticeTab) {
          noticeTab.click();
        }
        await sleep(900);
        const noticeTabs = Array.prototype.map.call(document.querySelectorAll(".notice-tab"), function (el) {
          return el.textContent.trim();
        });
        const afterLogs = tabs.indexOf("改动日志") >= 0 && tabs.indexOf("公告中心") === tabs.indexOf("改动日志") + 1;
        const mounted = noticeTabs.indexOf("公告管理") >= 0 && noticeTabs.indexOf("日常公告") >= 0;
        document.body.setAttribute("data-notice-tabs", noticeTabs.join(","));
        document.body.setAttribute("data-ok", afterLogs && mounted ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome keeps 公告中心 after 改动日志 and mounts the notice board", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__notice-tab-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(NOTICE_TAB_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__notice-tab-smoke`, 14000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 360) : html.slice(-400)
    );
    assert.match(html, /data-org-tabs="店铺主数据,成员管理,责权,权限,改动日志,公告中心"/);
    assert.match(html, /data-notice-tabs="[^"]*公告管理[^"]*日常公告/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

const PAGE_SCROLL_SMOKE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <style>
      html,body{height:480px;max-height:480px;margin:0;overflow:hidden}
      .xm-shell{display:flex;height:480px;max-height:480px;overflow:hidden}
      .xm-sider{flex:0 0 80px}
      .xm-main{flex:1 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
      .xm-topbar{flex:0 0 48px;height:48px}
      .xm-workspace{flex:1 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
      .xm-content{flex:1 1 auto;min-width:0;min-height:0;overflow:auto}
    </style>
    <link rel="stylesheet" href="/people.css" />
  </head>
  <body>
    <div class="xm-shell">
      <aside class="xm-sider"></aside>
      <div class="xm-main">
        <header class="xm-topbar"></header>
        <div class="xm-workspace">
          <div class="xm-content xm-pane is-active" id="xm-content"></div>
        </div>
      </div>
    </div>
    <script src="/shared/modules/people.js"></script>
    <script>
      (async function () {
        function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        await sleep(800);
        const pane = document.getElementById("xm-content");
        const cs = window.getComputedStyle(pane);
        const overflowY = cs.overflowY;
        const can = pane.scrollHeight > pane.clientHeight + 40;
        pane.scrollTop = 0;
        pane.dispatchEvent(new WheelEvent("wheel", { deltaY: 240, bubbles: true, cancelable: true }));
        await sleep(50);
        const moved = pane.scrollTop > 20;
        if (!moved) {
          pane.scrollTop = 120;
        }
        const assigned = pane.scrollTop > 20;
        document.body.setAttribute("data-overflow", overflowY);
        document.body.setAttribute("data-can", can ? "1" : "0");
        document.body.setAttribute("data-moved", moved ? "1" : "0");
        document.body.setAttribute("data-scroll", String(pane.scrollTop));
        document.body.setAttribute("data-sh", String(pane.scrollHeight));
        document.body.setAttribute("data-ch", String(pane.clientHeight));
        document.body.setAttribute("data-ok", can && assigned && overflowY === "auto" ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome scrolls 店铺主数据 inside the shell content pane", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__page-scroll-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE_SCROLL_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__page-scroll-smoke`, 14000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 420) : html.slice(-400)
    );
    assert.match(html, /data-overflow="auto"/);
    assert.match(html, /data-can="1"/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

const ORG_STRUCT_SMOKE = `<!doctype html>
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
        window.XmModules["/people"].mount(document.getElementById("xm-content"));
        document.querySelector('[data-pane="rights"]').click();
        await sleep(1400);
        const tree = document.getElementById("rights-dept-tree");
        const members = document.getElementById("rights-members-tbody");
        const title = document.getElementById("rights-members-title");
        const kpis = document.querySelectorAll(".org-struct .org-hero-kpi");
        const chart = document.getElementById("rights-tree-chart");
        const firstTitle = title ? title.textContent : "";
        const firstCount = members ? members.querySelectorAll("tr").length : 0;
        const hasLogin = members && members.querySelector(".people-login-btn");
        const boardBtn = tree && tree.querySelector('[data-tree-select="board:ops"]');
        if (boardBtn) {
          boardBtn.click();
        }
        await sleep(200);
        const filteredTitle = title ? title.textContent : "";
        const filteredCount = members ? members.querySelectorAll("tr").length : 0;
        const search = document.getElementById("rights-tree-q");
        if (search) {
          search.value = "人事";
          search.dispatchEvent(new Event("input", { bubbles: true }));
        }
        await sleep(80);
        const searched = ((tree && tree.textContent) || "").indexOf("人事和技术部门") >= 0 && ((tree && tree.textContent) || "").indexOf("后端部门") < 0;
        if (search) {
          search.value = "";
          search.dispatchEvent(new Event("input", { bubbles: true }));
        }
        document.querySelector("#rights-tree-collapse").click();
        await sleep(80);
        const collapsed = tree && !tree.querySelector(".org-struct-kids");
        document.querySelector("#rights-tree-expand").click();
        await sleep(80);
        const expanded = tree && tree.querySelector(".org-struct-kids");
        const ok =
          document.querySelector(".org-struct-stage") &&
          tree &&
          ((tree.textContent || "").indexOf("组织中心") >= 0) &&
          kpis.length >= 5 &&
          chart &&
          ((chart.innerHTML || "").indexOf("rights-mod-band") >= 0) &&
          firstCount > 0 &&
          hasLogin &&
          firstTitle.indexOf("组织中心") >= 0 &&
          filteredTitle.indexOf("运营部门管理") >= 0 &&
          filteredCount > 0 &&
          filteredCount <= firstCount &&
          searched &&
          collapsed &&
          expanded;
        document.body.setAttribute("data-first-n", String(firstCount));
        document.body.setAttribute("data-filtered-n", String(filteredCount));
        document.body.setAttribute("data-title", filteredTitle);
        document.body.setAttribute("data-ok", ok ? "1" : "0");
      })();
    </script>
  </body>
</html>`;

test("headless chrome restyles 责权 as 组织结构 explorer", async () => {
  resetPeopleStore();
  resetOrgBoard();
  resetOrgExtra();
  const app = createApp();
  const server = http.createServer((req, res) => {
    if (req.url === "/__org-struct-smoke") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(ORG_STRUCT_SMOKE);
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const html = await chromeDump(`http://127.0.0.1:${port}/__org-struct-smoke`, 16000);
    assert.match(
      html,
      /data-ok="1"/,
      html.includes("data-ok=") ? html.slice(html.indexOf("data-ok="), html.indexOf("data-ok=") + 280) : html.slice(-400)
    );
    assert.match(html, /组织结构/);
    assert.match(html, /org-struct-stage/);
    assert.doesNotMatch(html, /新建部门/);
    assert.doesNotMatch(html, /编制分析/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
