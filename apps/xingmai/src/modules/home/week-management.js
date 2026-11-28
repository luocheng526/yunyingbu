import { raw } from "express";
import { Buffer } from "node:buffer";
import { currentUser } from "../profile/auth.js";
import { createWeekSchedule } from "./week-schedule.js";
import { readWeekJztSpend } from "./week-jzt.js";
import { listWeekHistory, readWeekHistory, historyFile, prepareWeekHistory, finishWeekHistory, reportRevision } from "./week-history.js";
import { createDingService } from "./week-ding.js";

export function registerWeekManagement(router, {
  getPack, getUser = req => req.user || currentUser(req), ding = createDingService(),
  schedule = createWeekSchedule({ ding }), readJztSpend = readWeekJztSpend
} = {}) {
  if (!process.env.MENGKAI_SMOKE_LIVE && !process.env.NODE_TEST_CONTEXT) schedule.start();
  const login = (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    const user = getUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "请先登录" });
    req.weekUser = user; next();
  };
  const canManage = user => user?.isAdmin === true || user?.role === "admin" || (process.env.HOME_WEEK_ADMINS || "罗成,luocheng,luocheng526").split(",").includes(user?.username);
  const admin = (req, res, next) => {
    if (!canManage(req.weekUser)) return res.status(403).json({ ok: false, error: "仅管理员可修改报表配置或发送业绩报表" });
    if (req.method !== "GET") {
      const origin = req.get("origin");
      let sameSite = !origin;
      try { if (origin) sameSite = new URL(origin).host === req.get("host"); } catch { sameSite = false; }
      if (req.get("sec-fetch-site") === "cross-site" || !sameSite) return res.status(403).json({ ok: false, error: "请从本站页面操作" });
    }
    next();
  };
  const run = handler => async (req, res) => { try { await handler(req, res); } catch (error) { res.status(400).json({ ok: false, error: error.message || "操作失败" }); } };
  router.get("/week-ding/config", login, admin, run(async (_req, res) => res.json({ ok: true, config: await ding.publicConfig() })));
  router.post("/week-ding/config/:channel", login, admin, run(async (req, res) => res.json({ ok: true, config: await ding.save(req.params.channel, req.body || {}) })));
  router.post("/week-ding/check/:channel", login, admin, run(async (req, res) => res.json(await ding.check(req.params.channel))));
  router.get("/week-schedule", login, admin, run(async (_req, res) => res.json({ ok: true, config: schedule.config() })));
  router.post("/week-schedule", login, admin, run(async (req, res) => res.json({ ok: true, config: schedule.saveConfig(req.body) })));
  router.post("/jzt-spend-audit", login, admin, async (req, res) => {
    const { store, date } = req.body || {};
    try {
      const result = await readJztSpend(store, date);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(error.statusCode || 502).json({ ok: false, error: error.statusCode ? error.message : "京准通总花费查询失败" });
    }
  });
  router.get("/week-history", login, run(async (req, res) => res.json({ ok: true, items: listWeekHistory({ from: req.query.from, to: req.query.to }) })));
  router.get("/week-history/:id", login, run(async (req, res) => res.json({ ok: true, ...readWeekHistory(req.params.id) })));
  router.get("/week-history/:id/export/:format", login, run(async (req, res) => {
    const format = req.params.format, { meta } = readWeekHistory(req.params.id);
    const file = historyFile(meta.id, format);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Disposition", `${req.query.view === "1" && format === "png" ? "inline" : "attachment"}; filename="report-${meta.date}-v${meta.version}.${format}"`);
    res.type(format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "image/png").send(file);
  }));
  router.post("/week-send", login, admin, raw({ type: "application/octet-stream", limit: "12mb" }), run(async (req, res) => {
    const pack = await getPack(req);
    if (pack.source === "wps" && (pack.sync?.testOnly || !pack.readyToSend)) return res.status(409).json({ ok: false, sent: false, error: pack.sync?.testOnly ? "本地测试只预览，不发送钉钉" : "各团队当天数据尚未全部同步完成" });
    if (!req.get("x-week-revision") || req.get("x-week-revision") !== reportRevision(pack)) return res.status(409).json({ ok: false, sent: false, error: "表格已更新，请刷新后重新预览再发送" });
    const target = await ding.target(req.get("x-week-ding-channel"), req.get("x-week-ding-revision"));
    const image = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const protocol = String(req.get("x-forwarded-proto") || req.protocol).split(",")[0].trim();
    const host = String(req.get("x-forwarded-host") || req.get("host")).split(",")[0].trim();
    const origin = new URL(process.env.HOME_WEEK_PUBLIC_ORIGIN || `${protocol}://${host}`).origin;
    if (!/^https?:\/\//.test(origin)) throw new Error("报表图片的站点地址配置不正确");
    const history = prepareWeekHistory(pack, image, req.weekUser.username, target.destination);
    if (history.duplicate) return res.json({ ok: true, sent: history.status === "sent", accepted: history.status === "accepted", duplicate: true, historyId: history.id, message: "此版本已向所选对象提交并归档，无需重复发送" });
    const picUrl = `${origin.replace(/\/$/, "")}/api/home/week-shot/${history.imageToken}.png`;
    let result;
    try { result = await ding.send({ target, image, title: "近七天业绩汇总", text: `甄选五倍业绩统计 ${history.date} · 第 ${history.version} 版`, picUrl }); }
    catch {
      finishWeekHistory(history.id, "uncertain");
      return res.status(502).json({ ok: false, sent: false, historyId: history.id, error: "钉钉发送结果待确认，表格和图片已保留，请先核对钉钉消息" });
    }
    const status = result.ok ? result.status || "sent" : result.definiteFailure ? "failed" : "uncertain";
    let meta;
    try { meta = finishWeekHistory(history.id, status, result); }
    catch { return res.status(503).json({ ok: false, sent: status === "sent", historyId: history.id, error: "发送结果归档失败，原始表格和图片已保留，请勿重复发送" }); }
    return res.status(result.ok ? 200 : 502).json({ ok: result.ok, sent: status === "sent", accepted: ["accepted", "partial"].includes(status), status, historyId: history.id,
      message: result.ok ? meta.message : "", error: result.ok ? "" : meta.message });
  }));
}
