import { Router, raw } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHomeErpKpis } from "./erp-kpis.js";
import { getHomeErpPaid } from "./erp-paid.js";
import { HOME_JS_STAMP } from "./asset-ver.js";
import {
  getHomeLocalPaid,
  postHomeLocalPaid,
  shanghaiNow
} from "./local-paid.js";
import {
  beginRelogin,
  beginReloginAll,
  cancelRelogin,
  reloginInput,
  reloginScreen,
  reloginState,
  startJingmaiCollector
} from "./jingmai-runner.js";
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
  "        }, 600);\n" +
  "      }\n" +
  "        state.desk = { open: true, status: \"opening\", store: name, preview: true, message: \"正在打开「\" + name + \"」的登录画面\" };\n" +
  "        if (!dead) {\n" +
  "          paint(root, state);\n" +
  "        }\n" +
  "        watchOpeningShot(seq, name);\n" +
  "        api(\"/api/home/live-login/one\", { store: name }).then(function (st) {";
const OLD_CLICK_POINT =
  "            y: Math.round((event.clientY - rect.top) * scaleY)\n" +
  "          }).then(function (st) {";
const KEPT_CLICK_POINT =
  "            y: Math.round((event.clientY - rect.top) * scaleY),\n" +
  "            imageWidth: deskShot.naturalWidth || 0,\n" +
  "            imageHeight: deskShot.naturalHeight || 0\n" +
  "          }).then(function (st) {";

export function patchHomeClientSource(text) {
  const source = String(text || "");
  if (source.includes("function applyDesk(st)") || !source.includes(OLD_SHOW_DESK)) {
    return source;
  }
  return source
    .replace(OLD_SHOW_DESK, KEPT_SHOW_DESK)
    .replace(OLD_CLICK_POINT, KEPT_CLICK_POINT)
    .replace(OLD_OPENING, KEPT_OPENING)
    .replaceAll("0.1.1039-loginpop", "0.1.1043-deskkeep");
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

  router.post("/live-login", async (req, res) => {
    try {
      res.json(await beginReloginAll(req.headers.cookie || ""));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message || "无法登录京麦" });
    }
  });

  router.post("/live-login/one", async (req, res) => {
    try {
      res.json(await beginRelogin(req.body && req.body.store, req.headers.cookie || ""));
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

startJingmaiCollector();
