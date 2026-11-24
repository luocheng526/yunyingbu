import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import { setImmediate } from "node:timers/promises";
import express from "express";
import { registerWeekManagement } from "../src/modules/home/week-management.js";
import { reportRevision, listWeekHistory, readWeekHistory, publicHistoryImage } from "../src/modules/home/week-history.js";
import { createWpsService, saveWpsConfig, publicWpsConfig, parseIndexes, validateWpsUrl } from "../src/modules/home/week-wps-config.js";
import { readWpsConfig, wpsStorePath } from "../src/modules/home/week-storage.js";
import { writeWpsStore, readWpsStore } from "../src/modules/home/week-wps.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
function fixture() {
  return { title: "业绩归档", ymd: "2026-11-23", registrationDate: "2026-11-23", source: "wps", readyToSend: true, sync: { testOnly: false },
    columns: [{ key: "shop", label: "店铺", w: 170 }, { key: "gmv", label: "业绩", group: "gmv", w: 74 }, { key: "rate", label: "费比", group: "feeRate" }],
    teams: [{ key: "shen", label: "沈子晗组", rows: [{ shop: "=不执行公式", cells: { gmv: 0, rate: "12.50%" } }], foot: [], sourceSummary: [{ label: "组业绩", value: "0" }] },
      { key: "han", label: "韩梦凯组", rows: [{ shop: "清洁店铺", cells: { gmv: 200, rate: "" } }], foot: [] }],
    grandSummary: { key: "grand", label: "全部团队汇总", rows: [], foot: [{ label: "总汇总", kind: "fine", cells: { gmv: 200 } }] } };
}
function configForm() {
  return { accountLabel: "报表账号", sources: ["han", "shen"].map(team => ({ team, url: `https://www.kdocs.cn/l/${team}Example`, sheetName: "近七天业绩",
    headerRow: 2, rows: "3-5", columns: "A:H,MG:MH", footerRows: "28-29", summaryRows: "3-5", summaryLabelColumn: "A", summaryValueColumn: "B", verified: true })) };
}
test("WPS config validates ranges/URLs, keeps server-only paths, invalidates snapshots and persists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "week-config-")); process.env.HOME_WEEK_DATA_DIR = dir;
  try {
    const form = configForm(); form.cli = "untrusted executable";
    saveWpsConfig(form);
    assert.equal(readWpsConfig().cli, undefined);
    assert.equal(publicWpsConfig().sources[0].rows, "3-5");
    assert.equal(publicWpsConfig().accountLabel, "报表账号");
    assert.deepEqual(parseIndexes("A:C,MG:MH", true), [0, 1, 2, 344, 345]);
    assert.throws(() => validateWpsUrl("https://evil.test/l/han"));
    assert.throws(() => validateWpsUrl("https://www.kdocs.cn@evil.test/l/han"));
    assert.throws(() => parseIndexes("1-10000000"));
    const invalid = configForm(); invalid.sources[0].rows = "2-5";
    assert.throws(() => saveWpsConfig(invalid), /重叠/);
    assert.equal(publicWpsConfig().sources[0].rows, "3-5");
    writeWpsStore(wpsStorePath(), { teams: { han: { status: "ok", complete: true } }, expectedTeams: ["han", "shen"] });
    form.sources[0].url = "https://www.kdocs.cn/l/changed"; saveWpsConfig(form);
    assert.equal(readWpsStore(wpsStorePath()).teams.han.complete, false);
  } finally { delete process.env.HOME_WEEK_DATA_DIR; fs.rmSync(dir, { recursive: true, force: true }); }
});
test("WPS authorization exposes only an official URL and safe status, never CLI token output", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "week-auth-")); process.env.HOME_WEEK_DATA_DIR = dir;
  try {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => child.emit("close", 1);
    const service = createWpsService({ prepare: async () => {}, launch: () => child, exec: async () => ({ stdout: JSON.stringify({ authenticated: true, token: "SECRET-TOKEN" }) }) });
    await service.startAuth();
    child.stdout.emit("data", Buffer.from("https://mcp-center.wps.cn/kdocs-auth/auth-guide?auth_code=abc-123\nSECRET-TOKEN\n"));
    assert.equal(service.authState().status, "waiting");
    assert.equal(service.authState().url, "https://mcp-center.wps.cn/kdocs-auth/auth-guide?auth_code=abc-123");
    assert.ok(!JSON.stringify(service.authState()).includes("SECRET"));
    child.emit("close", 0); await setImmediate();
    assert.equal(service.authState().status, "authorized");
    assert.ok(!JSON.stringify(await service.status()).includes("SECRET"));
    let calls = 0;
    const denied = createWpsService({ read: async () => { calls++; throw new Error("无文档权限"); } });
    await assert.rejects(denied.check({ url: "https://www.kdocs.cn/l/test", sheetName: "test" }));
    assert.equal(calls, 1);
  } finally { delete process.env.HOME_WEEK_DATA_DIR; fs.rmSync(dir, { recursive: true, force: true }); }
});

test("send transaction archives immutable table/XLSX/PNG, deduplicates, versions and distinguishes failures", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "week-history-")); process.env.HOME_WEEK_DATA_DIR = dir;
  let pack = fixture(), sends = 0, mode = "ok", haveWebhook = true;
  const app = express(); app.use(express.json());
  const router = express.Router();
  registerWeekManagement(router, { getUser: req => req.get("x-test-user") ? { username: req.get("x-test-user") } : null,
    getPack: async () => pack, ding: {
    target: async () => { if (!haveWebhook) throw new Error("请先配置钉钉机器人"); return { destination: { key: "mock-group", channel: "group" } }; },
    send: async ({ picUrl }) => {
      sends++;
      const token = new URL(picUrl).pathname.split("/").at(-1).replace(".png", "");
      assert.deepEqual(publicHistoryImage(token), png);
      if (mode === "timeout") throw new Error("timeout");
      return mode === "fail" ? { ok: false, definiteFailure: true } : { ok: true };
    } } });
  app.use("/api/home", router);
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/home`;
  const read = (route, user = "罗成") => fetch(base + route, { headers: user ? { "x-test-user": encodeURIComponent(user) } : {} });
  // HTTP headers are Latin-1: use the supported ASCII administrator name.
  const request = (route, method = "GET", body, extra = {}) => fetch(base + route, { method, headers: { "x-test-user": "luocheng", ...(body ? { "Content-Type": "application/octet-stream", "X-Week-Revision": reportRevision(pack) } : {}), ...extra }, body });
  try {
    assert.equal((await read("/week-history", "")).status, 401);
    assert.equal((await request("/week-schedule", "GET", null, { "x-test-user": "employee" })).status, 403);
    assert.equal((await request("/week-schedule", "POST", null, { Origin: "https://evil.test" })).status, 403);
    assert.equal((await request("/week-wps/config")).status, 404);
    assert.equal((await (await request("/week-schedule")).json()).config.time, "09:00");
    const time = await request("/week-schedule", "POST", JSON.stringify({ time: "15:30" }), { "Content-Type": "application/json" });
    assert.equal((await time.json()).config.time, "15:30");
    assert.equal((await request("/week-send", "POST", png, { "X-Week-Revision": "stale" })).status, 409);
    pack.sync.testOnly = true;
    assert.equal((await request("/week-send", "POST", png)).status, 409);
    pack.sync.testOnly = false; haveWebhook = false;
    assert.equal((await request("/week-send", "POST", png)).status, 400); assert.equal(listWeekHistory().length, 0);
    haveWebhook = true;
    const first = await (await request("/week-send", "POST", png)).json();
    assert.equal(first.sent, true); assert.equal(sends, 1);
    const duplicate = await (await request("/week-send", "POST", png)).json();
    assert.equal(duplicate.duplicate, true); assert.equal(sends, 1);
    const item = readWeekHistory(first.historyId);
    assert.equal(item.meta.status, "sent"); assert.ok(!("imageToken" in item.meta));
    pack.teams[0].rows[0].cells.gmv = 100;
    assert.equal(readWeekHistory(first.historyId).pack.teams[0].rows[0].cells.gmv, 0);
    const second = await (await request("/week-send", "POST", png)).json();
    assert.equal(readWeekHistory(second.historyId).meta.version, 2);
    assert.equal((await (await request("/week-history?from=2026-11-24")).json()).items.length, 0);
    assert.equal((await request(`/week-history/${first.historyId}/export/png`, "GET", null, { "x-test-user": "" })).status, 401);
    assert.deepEqual(Buffer.from(await (await request(`/week-history/${first.historyId}/export/png`)).arrayBuffer()), png);
    const xlsx = Buffer.from(await (await request(`/week-history/${first.historyId}/export/xlsx`)).arrayBuffer());
    assert.equal(xlsx.readUInt32LE(0), 0x04034b50);
    const xml = xlsx.toString("utf8");
    assert.ok(xml.includes("全部团队汇总")); assert.ok(xml.includes("=不执行公式")); assert.ok(xml.includes("<v>0.125</v>")); assert.ok(xml.includes("<v>0</v>")); assert.ok(!xml.includes("<f>"));
    mode = "fail"; pack.teams[0].rows[0].cells.gmv = 101;
    const failed = await (await request("/week-send", "POST", png)).json();
    assert.equal(failed.sent, false); assert.equal(readWeekHistory(failed.historyId).meta.status, "failed");
    mode = "timeout"; pack.teams[0].rows[0].cells.gmv = 102;
    const uncertain = await (await request("/week-send", "POST", png)).json();
    assert.equal(readWeekHistory(uncertain.historyId).meta.status, "uncertain");
    const before = sends; assert.equal((await request("/week-send", "POST", png)).status, 400); assert.equal(sends, before);
    assert.equal((await request("/week-history/not-a-record")).status, 400);
    assert.equal((await request(`/week-history/${first.historyId}/export/json`)).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); delete process.env.HOME_WEEK_DATA_DIR; fs.rmSync(dir, { recursive: true, force: true }); }
});
