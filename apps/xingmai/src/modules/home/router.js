import { Router, raw } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHomeErpKpis } from "./erp-kpis.js";
import { getHomeErpPaid } from "./erp-paid.js";
import { HOME_JS_STAMP } from "./asset-ver.js";
import { patchConnectPicker } from "./connect-patch.js";
import {
  getHomeLocalPaid,
  postHomeLocalPaid,
  shanghaiNow
} from "./local-paid.js";
import {
  beginRelogin,
  beginReloginAll,
  cancelRelogin,
  jingmaiCollectStatus,
  reloginInput,
  reloginScreen,
  reloginState,
  startJingmaiCollector
} from "./jingmai-runner.js";
import { getLive2Board, startLive2Round } from "./live2-collect.js";
import {
  buildWeekPack,
  saveWeekCells,
  dingWebhook,
  saveWeekShot,
  getWeekShot,
  postDingTalk,
  readWeekStore
} from "./week-report.js";

const homeJsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/shared/modules/home.js"
);

const OLD_SHOW_DESK = "      function showDesk(st) {\n        state.desk = st || {};\n";
const KEPT_SHOW_DESK =
  "      function showDesk(st) {\n" +
  "        state.desk = st || {};\n" +
  "        state.desk.open = true;\n" +
  "        if (state.desk.status !== \"ok\" && state.desk.status !== \"done\" && state.desk.status !== \"verify\") {\n" +
  "          state.desk.status = \"screen\";\n" +
  "        }\n";
const OLD_OPENING =
  "        state.desk = { open: true, status: \"opening\", store: name, message: \"正在打开「\" + name + \"」的登录画面\" };\n" +
  "        if (!dead) {\n" +
  "          paint(root, state);\n" +
  "        }\n" +
  "        api(\"/api/home/live-login/one\", { store: name }).then(function (st) {";
const KEPT_OPENING =
  "      function watchOpeningShot(seq, name) {\n" +
  "        var timer = window.setInterval(function () {\n" +
  "          if (dead || seq !== deskSeq || !state.desk || !state.desk.preview) {\n" +
  "            window.clearInterval(timer);\n" +
  "            return;\n" +
  "          }\n" +
  "          var probe = new Image();\n" +
  "          probe.onload = function () {\n" +
  "            if (dead || seq !== deskSeq || !state.desk || !state.desk.preview) {\n" +
  "              return;\n" +
  "            }\n" +
  "            state.desk.status = \"screen\";\n" +
  "            var img = root.querySelector(\"#xm-hm-desk-shot\");\n" +
  "            if (!img) {\n" +
  "              paint(root, state);\n" +
  "              img = root.querySelector(\"#xm-hm-desk-shot\");\n" +
  "            }\n" +
  "            if (img && img.getAttribute(\"src\") !== probe.src) {\n" +
  "              img.src = probe.src;\n" +
  "            }\n" +
  "          };\n" +
  "          probe.src = \"/api/home/live-login/screen?store=\" + encodeURIComponent(name) + \"&t=\" + Date.now();\n" +
  "        }, 1500);\n" +
  "      }\n" +
  "        state.desk = { open: true, status: \"opening\", store: name, preview: true, message: \"正在打开「\" + name + \"」的登录画面\" };\n" +
  "        if (!dead) {\n" +
  "          paint(root, state);\n" +
  "        }\n" +
  "        watchOpeningShot(seq, name);\n" +
  "        api(\"/api/home/live-login/one\", { store: name }).then(function (st) {";
const OLD_DESK_PAINT =
  "        if (!dead) {\n" +
  "          paint(root, state);\n" +
  "        }\n" +
  "        var status = state.desk && state.desk.status;\n" +
  "        if (status === \"screen\" || status === \"verify\") {\n" +
  "          pollDesk();\n" +
  "        }\n";
const KEPT_DESK_PAINT =
  "        var status = state.desk && state.desk.status;\n" +
  "        var img = root.querySelector(\"#xm-hm-desk-shot\");\n" +
  "        if (!dead && !(status === \"screen\" && img)) {\n" +
  "          paint(root, state);\n" +
  "        }\n" +
  "        if (status === \"screen\" || status === \"verify\") {\n" +
  "          pollDesk();\n" +
  "        }\n";
const OLD_DESK_SRC = "              img.src = \"/api/home/live-login/screen?t=\" + Date.now();\n";
const KEPT_DESK_SRC =
  "              if (!img.dataset.busy) {\n" +
  "                img.dataset.busy = \"1\";\n" +
  "                var nextSrc = \"/api/home/live-login/screen?t=\" + Date.now();\n" +
  "                var probe = new Image();\n" +
  "                probe.onload = function () {\n" +
  "                  img.dataset.busy = \"\";\n" +
  "                  if (img.isConnected) img.src = nextSrc;\n" +
  "                };\n" +
  "                probe.onerror = function () { img.dataset.busy = \"\"; };\n" +
  "                probe.src = nextSrc;\n" +
  "              }\n";
const OLD_CLICK_POINT =
  "            y: Math.round((event.clientY - rect.top) * scaleY)\n" +
  "          }).then(function (st) {";
const KEPT_CLICK_POINT =
  "            y: Math.round((event.clientY - rect.top) * scaleY),\n" +
  "            imageWidth: deskShot.naturalWidth || 0,\n" +
  "            imageHeight: deskShot.naturalHeight || 0\n" +
  "          }).then(function (st) {";
const OLD_LIVE_LINK =
  "  function liveLinkOf(row) {\n" +
  "    var t = parseLiveAt(row && (row.capturedAt || row.ingestedAt));\n" +
  "    return Number.isFinite(t) && Date.now() - t <= 6e5\n" +
  "      ? { label: \"在线\", kind: \"on\" }\n" +
  "      : { label: \"掉线\", kind: \"off\" };\n" +
  "  }";
const KEPT_LIVE_LINK =
  "  var liveBoardSlot = \"\";\n" +
  "  function fiveMinuteStamp(stamp) {\n" +
  "    var match = String(stamp || \"\").match(/(\\d{4})[/-](\\d{1,2})[/-](\\d{1,2})[ T](\\d{1,2}):(\\d{2})/);\n" +
  "    if (!match) {\n" +
  "      return \"\";\n" +
  "    }\n" +
  "    var minute = Math.floor(Number(match[5]) / 5) * 5;\n" +
  "    function pad(value) {\n" +
  "      value = String(value);\n" +
  "      return value.length < 2 ? \"0\" + value : value;\n" +
  "    }\n" +
  "    return match[1] + \"/\" + pad(match[2]) + \"/\" + pad(match[3]) + \" \" + pad(match[4]) + \":\" + pad(minute);\n" +
  "  }\n" +
  "  function liveSlotOf(rows) {\n" +
  "    var latest = \"\";\n" +
  "    (rows || []).forEach(function (row) {\n" +
  "      if (row && row.online === true && row.capturedAt > latest) {\n" +
  "        latest = row.capturedAt;\n" +
  "      }\n" +
  "    });\n" +
  "    if (!latest) {\n" +
  "      (rows || []).forEach(function (row) {\n" +
  "        if (row && row.capturedAt > latest) {\n" +
  "          latest = row.capturedAt;\n" +
  "        }\n" +
  "      });\n" +
  "    }\n" +
  "    return fiveMinuteStamp(latest);\n" +
  "  }\n" +
  "  function liveLinkOf(row) {\n" +
  "    if (row && row.online === true) {\n" +
  "      if (row.adsFailed === true) {\n" +
  "        return { label: \"在线·广告异常\", kind: \"ads\" };\n" +
  "      }\n" +
  "      return { label: \"在线\", kind: \"on\" };\n" +
  "    }\n" +
  "    if (row && row.loginExpired === true) {\n" +
  "      return { label: \"掉线\", kind: \"off\" };\n" +
  "    }\n" +
  "    if (row && row.adsFailed === true) {\n" +
  "      return { label: \"广告异常\", kind: \"ads\" };\n" +
  "    }\n" +
  "    if (row && row.offline === true) {\n" +
  "      return { label: \"采集异常\", kind: \"warn\" };\n" +
  "    }\n" +
  "    return { label: \"\", kind: \"\" };\n" +
  "  }";
const OLD_ONLINE_COPY =
  "      online: row && row.online,\n" +
  "      capturedAt: row && (row.capturedAt || row.ingestedAt),";
const KEPT_ONLINE_COPY =
  "      online: row && row.online === true,\n" +
  "      offline: row && row.offline === true,\n" +
  "      offlineReason: row && row.offlineReason ? String(row.offlineReason) : \"\",\n" +
  "      adsFailed: row && row.adsFailed === true,\n" +
  "      adsReason: row && row.adsReason ? String(row.adsReason) : \"\",\n" +
  "      loginExpired: row && row.loginExpired === true,\n" +
  "      capturedAt: row && (row.capturedAt || row.ingestedAt),";
const OLD_LIVE_AT =
  "    if (key === \"liveAt\") {\n" +
  "      return '<td class=\"xm-hm-num\">' + escapeHtml(fmtShopAt(row && (row.capturedAt || row.ingestedAt || row.liveAt)) || \"—\") + \"</td>\";\n" +
  "    }";
const KEPT_LIVE_AT =
  "    if (key === \"liveAt\") {\n" +
  "      var ownAt = row && (row.capturedAt || row.ingestedAt || row.liveAt);\n" +
  "      return '<td class=\"xm-hm-num\">' + escapeHtml(ownAt && liveBoardSlot ? liveBoardSlot : \"—\") + \"</td>\";\n" +
  "    }";
const OLD_LIVE_ROWS =
  "      shops.map(function (row, i) {\n" +
  "        return liveShopRowHtml(row, i, state.liveAt);\n" +
  "      }).join(\"\")";
const KEPT_LIVE_ROWS =
  "      (liveBoardSlot = liveSlotOf(shops), shops).map(function (row, i) {\n" +
  "        return liveShopRowHtml(row, i, liveBoardSlot || state.liveAt);\n" +
  "      }).join(\"\")";
const OLD_LIVE_CLOCK =
  "        if (stampClock || !state.liveAt) {\n" +
  "          state.liveAt = shanghaiClock();\n" +
  "        }";
const KEPT_LIVE_CLOCK =
  "        state.liveAt = liveSlotOf(state.shops) || shanghaiClock();";
const OLD_LIVE_SUM = "    var sum = rows.length ? sumLocalPaid(rows) : {};";
const KEPT_LIVE_SUM =
  "    var liveRows = rows.filter(function (row) { return !row || row.online !== false; });\n" +
  "    var sum = liveRows.length ? sumLocalPaid(liveRows) : {};";
const OLD_CONNECT_BTN = "'<button type=\"button\" class=\"xm-hm-live-refresh\" data-refresh-live'";
const KEPT_CONNECT_BTN =
  "'<button type=\"button\" class=\"xm-hm-live-refresh\" data-connect-jingmai>连接京麦</button>' +\n" +
  "      '<button type=\"button\" class=\"xm-hm-live-refresh\" data-refresh-live'";
const OLD_REFRESH_CLICK =
  "        if (event.target.closest(\"[data-refresh-live]\")) {\n" +
  "          refreshLive();\n" +
  "          return;\n" +
  "        }";
const KEPT_REFRESH_CLICK =
  "        if (event.target.closest(\"[data-refresh-live]\")) {\n" +
  "          refreshLive();\n" +
  "          return;\n" +
  "        }\n" +
  "        if (event.target.closest(\"[data-connect-jingmai]\")) {\n" +
  "          var seqAll = ++deskSeq;\n" +
  "          window.clearInterval(deskTimer);\n" +
  "          deskTimer = 0;\n" +
  "          state.desk = { open: true, status: \"opening\", store: \"全部店铺\", message: \"正在打开还没有登录的店铺\" };\n" +
  "          if (!dead) paint(root, state);\n" +
  "          api(\"/api/home/live-login\", {}).then(function (st) {\n" +
  "            if (dead || seqAll !== deskSeq) return;\n" +
  "            var nextAll = st || { status: \"login\", message: \"登录没有打开\" };\n" +
  "            nextAll.open = true;\n" +
  "            if (nextAll.status === \"done\" || nextAll.status === \"ok\") {\n" +
  "              state.desk = null;\n" +
  "              if (!dead) { paint(root, state); pullLive(); }\n" +
  "              return;\n" +
  "            }\n" +
  "            nextAll.store = nextAll.store || \"全部店铺\";\n" +
  "            showDesk(nextAll);\n" +
  "          });\n" +
  "          return;\n" +
  "        }";

export function patchHomeClientSource(text) {
  const source = String(text || "");
  const patched = source.includes("function applyDesk(st)") || !source.includes(OLD_SHOW_DESK)
    ? source
    : source
    .replace(OLD_SHOW_DESK, KEPT_SHOW_DESK)
    .replace(OLD_DESK_PAINT, KEPT_DESK_PAINT)
    .replace(OLD_DESK_SRC, KEPT_DESK_SRC)
    .replace(OLD_CLICK_POINT, KEPT_CLICK_POINT)
    .replace(OLD_OPENING, KEPT_OPENING)
    .replace(OLD_LIVE_LINK, KEPT_LIVE_LINK)
    .replace(OLD_ONLINE_COPY, KEPT_ONLINE_COPY)
    .replace(OLD_LIVE_AT, KEPT_LIVE_AT)
    .replace(OLD_LIVE_ROWS, KEPT_LIVE_ROWS)
    .replace(OLD_LIVE_CLOCK, KEPT_LIVE_CLOCK)
    .replace(OLD_LIVE_SUM, KEPT_LIVE_SUM)
    .replace(OLD_CONNECT_BTN, KEPT_CONNECT_BTN)
    .replace(OLD_REFRESH_CLICK, KEPT_REFRESH_CLICK)
    .replace('{ key: "liveOn", label: "状态"', '{ key: "liveOn", label: "登录状态"')
    .replace("var LIVE_REFRESH_MS = 10 * 60 * 1000;", "var LIVE_REFRESH_MS = 60 * 1000;")
    .replaceAll("0.1.1039-loginpop", "0.1.1090-paidon")
    .replaceAll("0.1.1043-deskkeep", "0.1.1090-paidon")
    .replaceAll("0.1.1070-liveon", "0.1.1090-paidon");
  return patchConnectPicker(patched);
}

function homeClientSource() {
  return patchHomeClientSource(fs.readFileSync(homeJsPath, "utf8"));
}

export function homeRouter() {
  const router = Router();

  router.get("/client.js", (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.type("application/javascript");
    res.send(homeClientSource());
  });

  router.get("/erp-kpis", async (req, res) => {
    try {
      const data = await getHomeErpKpis(req.query || {});
      if (!data.ok) {
        return res.status(503).json(data);
      }
      return res.json(data);
    } catch (err) {
      return res.status(Number(err.statusCode) || 502).json({
        ok: false,
        error: err.message || "星脉 ERP 调用失败"
      });
    }
  });

  router.get("/live2", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      return res.json(await getLive2Board(req.headers.cookie || ""));
    } catch (err) {
      return res.status(Number(err.statusCode) || 502).json({
        ok: false,
        source: "live2",
        records: [],
        error: err.message || "实时（新版）还没有读到数据"
      });
    }
  });

  router.post("/live2", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const store = req.body && req.body.store;
      return res.json(await startLive2Round(req.headers.cookie || "", store));
    } catch (err) {
      return res.status(Number(err.statusCode) || 502).json({
        ok: false,
        source: "live2",
        records: [],
        error: err.message || "实时（新版）采集没有开始"
      });
    }
  });

  router.get("/local-paid", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      return res.json(await getHomeLocalPaid(req));
    } catch (err) {
      res.status(502).json({
        ok: false,
        source: "jingmai-local",
        records: [],
        error: err.message || "京麦实时采集失败"
      });
    }
  });

  /** Ops evidence: session counts / owner / needsQr — never returns cookie jars. */
  router.get("/jingmai/status", async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      return res.json(await jingmaiCollectStatus());
    } catch (err) {
      res.status(502).json({ ok: false, error: err.message || "无法读取京麦采集状态" });
    }
  });

  router.post("/live-login", async (req, res) => {
    try {
      res.json(await beginReloginAll(req.headers.cookie || ""));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message || "无法登录京麦" });
    }
  });

  router.post("/live-login/one", async (req, res) => {
    try {
      res.json(await beginRelogin(req.body && req.body.store, req.headers.cookie || "", {
        manual: Boolean(req.body && req.body.manual)
      }));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message || "无法登录京麦" });
    }
  });

  router.get("/live-login/state", async (req, res) => {
    try {
      res.json(await reloginState(req.query.store));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message || "无法登录京麦" });
    }
  });

  router.get("/live-login/screen", async (req, res) => {
    try {
      const image = await reloginScreen(req.query.store);
      if (!image || !image.length) {
        res.status(404).json({ error: "登录画面没有打开" });
        return;
      }
      res.set("cache-control", "no-store");
      res.type("jpeg").send(image);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message || "无法登录京麦" });
    }
  });

  router.post("/live-login/input", async (req, res) => {
    try {
      res.json(await reloginInput(req.body || {}));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message || "无法登录京麦" });
    }
  });

  router.post("/live-login/cancel", async (_req, res) => {
    try {
      res.json(await cancelRelogin());
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message || "无法登录京麦" });
    }
  });

  router.post("/local-paid", (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      return res.json(postHomeLocalPaid(req.body || {}));
    } catch (err) {
      return res.status(500).json({
        ok: false,
        source: "jingmai-local",
        records: [],
        error: err.message || "实时留底失败"
      });
    }
  });

  router.get("/erp-paid", async (_req, res) => {
    try {
      const data = await getHomeErpPaid();
      if (!data.ok) {
        return res.status(503).json(data);
      }
      return res.json(data);
    } catch (err) {
      return res.status(Number(err.statusCode) || 502).json({
        ok: false,
        error: err.message || "星脉 ERP 实时付费调用失败"
      });
    }
  });

  router.get("/summary", (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ ok: true, module: "home", stamp: HOME_JS_STAMP });
  });

  router.get("/week-report", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      const live = await getHomeLocalPaid(req);
      return res.json(buildWeekPack((live && live.records) || []));
    } catch {
      return res.json(buildWeekPack([]));
    }
  });

  router.post("/week-report", (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const saved = saveWeekCells(req.body || {});
    return res.json({ ok: true, updatedAt: saved.updatedAt, dingReady: Boolean(saved.webhook || dingWebhook()) });
  });

  router.get("/week-shot/:id.png", (req, res) => {
    const buf = getWeekShot(req.params.id);
    if (!buf) {
      return res.status(404).type("text").send("gone");
    }
    res.setHeader("Cache-Control", "public, max-age=600");
    res.type("png").send(buf);
  });

  router.post("/week-send", raw({ type: "application/octet-stream", limit: "12mb" }), async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!buf.length) {
      return res.status(400).json({ ok: false, error: "没有图片" });
    }
    const id = saveWeekShot(buf);
    const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    const proto = String(req.get("x-forwarded-proto") || req.protocol || "https")
      .split(",")[0]
      .trim();
    const picUrl = host ? `${proto}://${host}/api/home/week-shot/${id}.png` : "";
    const hook = dingWebhook();
    if (!hook) {
      return res.json({
        ok: true,
        sent: false,
        shot: id,
        picUrl,
        error: "表已出图。到本页填钉钉机器人 webhook 后再发。"
      });
    }
    try {
      const ding = await postDingTalk({
        webhook: hook,
        title: "近七天业绩汇总",
        text: `甄选五倍业绩统计 ${shanghaiNow()}`,
        picUrl
      });
      return res.json({ ok: ding.ok, sent: ding.ok, shot: id, picUrl, error: ding.error || "" });
    } catch (err) {
      return res.status(502).json({ ok: false, sent: false, shot: id, picUrl, error: err.message || "钉钉发送失败" });
    }
  });

  router.get("/week-ding", (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const saved = readWeekStore();
    res.json({ ok: true, dingReady: Boolean(saved.webhook || dingWebhook()) });
  });

  return router;
}

// Gate smoke imports set MENKAI_SMOKE_LIVE and must not start the real collector.
if (!process.env.MENGKAI_SMOKE_LIVE) {
  startJingmaiCollector();
}
