import "./_memory-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { setTimeout } from "node:timers";
import express from "express";
import { homeRouter } from "../src/modules/home/router.js";
import { createLive2Collector, LIVE2_INTERVAL_MS } from "../src/modules/home/live2-collect.js";
import { readServerOrgShops } from "../src/modules/home/org-roster.js";
import { fetchAccountIdentity, fetchHome } from "../src/modules/home/jingmai-client.js";
import { beijingParts, displayStamp } from "../src/modules/home/jingmai.js";
import { getSession, listSamples, readJingmaiLive, resetJingmaiStore, saveSession } from "../src/modules/home/jingmai-store.js";

async function listen(app, t) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("46 simulated shops: full collection and next round survive DSM 601 using the existing browser fallback", async (t) => {
  await resetJingmaiStore();
  const retryMs = process.env.SHEN_DEAL_RETRY_MS;
  process.env.SHEN_DEAL_RETRY_MS = "0";
  t.after(() => {
    if (retryMs == null) delete process.env.SHEN_DEAL_RETRY_MS;
    else process.env.SHEN_DEAL_RETRY_MS = retryMs;
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunyingbu-live2-e2e-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const rosterFile = path.join(dir, "org-stores.json");
  const storeFile = path.join(dir, "live2.json");
  let clock = Date.now(), round = 1, adsFail = false, identityBlocked = false, browserReads = 0;
  let active = 0, maximum = 0, fetches = 0, logins = 0, task;
  const rows = Array.from({ length: 46 }, (_, i) => ({
    storeName: `本地测试店${i + 1}`, shopId: String(i + 1), statusKey: "operating",
    login: "fixture-only", password: "fixture-only", team: "测试团队"
  }));
  fs.writeFileSync(rosterFile, JSON.stringify({ rows }));
  for (const [i, row] of rows.entries()) {
    await saveSession(row.storeName, {
      shopId: row.shopId, enabled: true, authState: i < 17 ? "login_expired" : "ok",
      cookies: [{ name: "thor", value: `fixture-${row.shopId}`, domain: ".jd.com", path: "/", secure: true }]
    });
  }
  const jd = express();
  jd.use(express.json());
  jd.use((req, res) => {
    const id = Number((req.headers.cookie || "").match(/thor=fixture-(\d+)/)?.[1]);
    assert.ok(id >= 1 && id <= 46, "the real cookie filter sends the scoped session");
    const href = decodeURIComponent(req.originalUrl);
    if (href.includes("findAccountInfo")) {
      if (identityBlocked) return res.json({ code: 601, msg: "非法请求拦截" });
      res.setHeader("Set-Cookie", "refreshed=valid; Domain=.jd.com; Path=/; Secure; HttpOnly");
      return res.json({ code: 200, data: { belongVos: [{ belongType: "200", belongBizId: String(id), shopName: `本地测试店${id}` }] } });
    }
    assert.match(req.headers.cookie || "", /refreshed=valid/, "HTTP response cookies survive into subsequent requests");
    if (href.includes("findShopDataByChannel")) {
      if (identityBlocked) return res.json({ code: 601, msg: "非法请求拦截" });
      return res.json({ code: 200, data: { indicatorList: [{ code: "3009", todayNum: id * 100 * round }] } });
    }
    if (href.includes("realtimeSummary")) return res.json({ code: 601, msg: "非法请求拦截" });
    if (href.includes("pinlist")) {
      return res.json(adsFail ? { code: -100 } : { code: 1, data: { own: [{ userId: id, shopId: String(id), shopName: `本地测试店${id}` }] } });
    }
    if (href.includes("summary/overview")) {
      return res.json({ code: 1, data: { summary: [
        { index: "cost", value: id * 10 * round },
        { index: "totalOrderSum", value: id * 20 * round },
        { index: "ROI", value: 2 }
      ] } });
    }
    if (href.startsWith("/jdm/home") || href.startsWith("/custom-report")) return res.send("<html>fixture</html>");
    assert.fail(`Unexpected JD fixture request: ${href}`);
  });
  const jdOrigin = await listen(jd, t);
  const transport = (url, init) => {
    const target = new URL(url);
    assert.ok(target.hostname.endsWith(".jd.com"));
    // Only synthetic cookies ever go to this loopback fixture. No requests leave the PC.
    return fetch(jdOrigin + target.pathname + target.search, init);
  };
  const options = {
    loadOrg: async (cookie) => {
      if (cookie !== "fixture=authorized") throw Object.assign(new Error("请先登录运营中心"), { statusCode: 401 });
      return readServerOrgShops(rosterFile);
    },
    loadBackgroundOrg: () => readServerOrgShops(rosterFile),
    now: () => displayStamp(beijingParts(new Date(clock)).stamp),
    storePath: storeFile,
    concurrency: 3,
    track: (value) => { task = value; },
    client: {
      login: async () => { logins += 1; assert.fail("saved sessions must be reused"); },
      fetchAccountIdentity: (jar, _fetch, signal) => fetchAccountIdentity(jar, transport, signal),
      fetchHome: async (jar, signal, expected) => {
        active += 1; maximum = Math.max(maximum, active); fetches += 1;
        try {
          await new Promise((resolve) => setTimeout(resolve, 15));
          return await fetchHome(jar, transport, async (_cookies, _signal, bound) => {
            assert.equal(identityBlocked, true);
            assert.equal(bound.store, `本地测试店${bound.shopId}`);
            browserReads += 1;
            return { dealAmount: Number(bound.shopId) * 100 * round };
          }, signal, expected);
        } finally { active -= 1; }
      }
    }
  };
  const collector = createLive2Collector(options);
  const app = express();
  app.use(express.json());
  app.use("/api/home", homeRouter({ getLive2Board: collector.board, startLive2Round: collector.start }));
  const origin = await listen(app, t);
  const call = (method, body) => fetch(origin + "/api/home/live2", {
    method, headers: { cookie: "fixture=authorized", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  }).then((res) => res.json());
  assert.equal((await fetch(origin + "/api/home/live2")).status, 401);
  assert.equal((await call("POST")).started, true);
  assert.equal((await call("POST")).started, false);
  await task;
  let board = await call("GET");
  assert.equal(board.records.length, 46);
  assert.equal(board.records.filter((row) => row.online).length, 46);
  assert.equal(board.loginExpiredShops, 0);
  assert.equal(fetches, 46);
  assert.equal(logins, 0);
  assert.equal(maximum, 3);
  assert.equal(board.lastError, "");
  assert.doesNotMatch(JSON.stringify(board), /fixture-only|fixture-1|password|cookies/);
  const today = beijingParts(new Date(clock)).day;
  let samples = await listSamples(today, today);
  assert.equal(samples.length, 46, "partial and full metrics upsert the same sample");
  assert.equal(samples.find((row) => row.store === "本地测试店46").paidAmount, 460);
  const oldView = await readJingmaiLive(beijingParts(new Date(clock)));
  assert.equal(oldView.shops.find((row) => row.shop === "本地测试店46").paidAmount, 460);

  const source = fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");
  const functions = ["applyLive2Pack", "live2Sums", "asNum", "fmtMoney", "fmtInt", "fmtRate"].map((name) => {
    const start = source.indexOf(`  function ${name}(`);
    assert.ok(start >= 0);
    return source.slice(start, source.indexOf("\n  function ", start + 1));
  }).join("\n");
  const context = vm.createContext({ rows: rows.map((row) => ({ shop: row.storeName })), pack: board });
  const total = vm.runInContext(functions + "\nlive2Sums(applyLive2Pack(rows, pack))", context);
  assert.equal(total.deal, 108100);
  assert.equal(total.spend, 10810);
  assert.equal(total.shops, 46);
  assert.equal(total.fee, 0.1);
  const restarted = createLive2Collector(options);
  assert.deepEqual((await restarted.board("fixture=authorized")).records, board.records);

  // Advance the test clock; a background round needs no browser cookie.
  clock += LIVE2_INTERVAL_MS; round = 2; identityBlocked = true;
  assert.equal((await restarted.start("", "", true)).started, true);
  await task;
  board = await restarted.board("fixture=authorized");
  assert.equal(board.records.find((row) => row.shop === "本地测试店46").liveAmount, 9200);
  samples = await listSamples(today, beijingParts(new Date(clock)).day);
  assert.equal(samples.length, 92);
  assert.equal(fetches, 92);
  assert.equal(browserReads, 46, "DSM 601 must not block the existing browser data path");
  assert.equal(board.records.filter((row) => row.online).length, 46);

  clock += LIVE2_INTERVAL_MS; adsFail = true;
  await restarted.start("fixture=authorized", "本地测试店1");
  await task;
  const partial = (await restarted.board("fixture=authorized")).records.find((row) => row.shop === "本地测试店1");
  assert.equal(partial.liveAmount, 200);
  assert.equal(partial.online, false);
  assert.equal(partial.partialData, true);
  assert.equal(partial.adsFailed, true);
  assert.equal(partial.loginExpired, false);
  assert.equal((await getSession("本地测试店1")).authState, "ok");
  assert.equal(logins, 0);
});

test("background roster rejects corrupt data and excludes non-operating shops", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yunyingbu-roster-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "org.json");
  fs.writeFileSync(file, JSON.stringify({ rows: [
    { storeName: "开业", statusKey: "operating" }, { storeName: "停业", statusKey: "closed" }
  ] }));
  assert.deepEqual((await readServerOrgShops(file)).map((row) => row.store), ["开业"]);
  fs.writeFileSync(file, "{}");
  await assert.rejects(readServerOrgShops(file), /配置格式/);
});
