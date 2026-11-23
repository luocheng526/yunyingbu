import { Router } from "express";
import { fileURLToPath } from "node:url";
import { isHrDesk } from "../home/nav-items.js";
import { runSingleProbe, singleProbeStatus } from "./probe.js";
import { createShopDayRouter } from "./shop-day-router.js";
import {
  catalogBody,
  coverageBody,
  progressBody,
  ensureCollectLoop,
  exportView,
  isBoundAdmin,
  loginWithPassword,
  setAutoReloginPreference,
  pickAccount,
  pollLink,
  qrBytes,
  readView,
  savePagePref,
  saveRowMark,
  startLink,
  tick
} from "./store.js";

export const boundRouter = Router();

function denyHr(req, res) {
  if (!isHrDesk(req.user)) {
    return false;
  }
  res.status(403).json({
    ok: false,
    error: "人事部只看智能人事和个人中心",
    module: "bound",
    source: "crawler",
    erp: false
  });
  return true;
}

function requireUser(req, res) {
  if (req.user) {
    return true;
  }
  res.status(401).json({ ok: false, error: "未登录", module: "bound", source: "crawler", erp: false });
  return false;
}

function requireAdmin(req, res) {
  if (!requireUser(req, res)) {
    return false;
  }
  if (isBoundAdmin(req.user)) {
    return true;
  }
  res.status(403).json({ ok: false, error: "只有管理员能连接旧站", module: "bound", source: "crawler", erp: false });
  return false;
}

boundRouter.use((req, res, next) => {
  if (!denyHr(req, res)) {
    ensureCollectLoop();
    next();
  }
});

boundRouter.get("/", (req, res) => {
  res.json({ ok: true, module: "bound", source: "crawler", erp: false });
});

// The deployed shell still references this alias. Serve the same module file
// as SPA navigation without changing the shared shell or retaining a stale copy.
// Like /shared/modules/bound.js, this is public application code. The shell's
// asset middleware deliberately skips populating req.user for .js requests.
boundRouter.get("/client.js", (_req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.type("application/javascript").sendFile(fileURLToPath(new URL("../../../public/shared/modules/bound.js", import.meta.url)));
});

boundRouter.use("/shop-day", (req, res, next) => {
  if (requireAdmin(req, res)) next();
}, createShopDayRouter());

boundRouter.get("/catalog", (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json(catalogBody());
});

boundRouter.get("/board", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const coverage = await coverageBody();
  res.json({
    ok: true,
    module: "bound",
    source: "crawler",
    erp: false,
    demo: false,
    label: "爬虫，非 ERP",
    startOn: coverage.startOn,
    today: coverage.today,
    reports: coverage.reports
  });
});

boundRouter.get("/progress", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.json(await progressBody());
});

boundRouter.get("/coverage", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json(await coverageBody());
});

boundRouter.get("/view", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json(await readView(req.query || {}));
});

boundRouter.get("/export", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const file = await exportView(req.query || {});
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.send(file.body);
});

boundRouter.post("/prefs", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  res.json(await savePagePref(req.body || {}));
});

boundRouter.post("/marks", async (req, res) => {
  if (!requireUser(req, res)) {
    return;
  }
  const saved = await saveRowMark(req.body || {});
  res.status(saved.statusCode || 200).json(saved);
});

boundRouter.get("/link", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(await pollLink());
});

boundRouter.post("/link/start", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.json(await startLink((req.body || {}).provider));
});

boundRouter.post("/link/auto-relogin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  let sameOrigin = true;
  try { if (req.headers.origin) sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch { sameOrigin = false; }
  if (!sameOrigin || req.headers["sec-fetch-site"] === "cross-site" || !req.is("application/json")) {
    return res.status(403).json({ ok: false, message: "请在本站页面修改自动重登设置。" });
  }
  try {
    const result = await setAutoReloginPreference(req.body);
    res.status(result.statusCode || 200).json(result);
  } catch {
    res.status(500).json({ ok: false, message: "自动重登设置未保存，请刷新确认后再操作。" });
  }
});

boundRouter.post("/link/password", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  try {
    const result = await loginWithPassword(req.body || {});
    res.status(result.statusCode || 200).json(result);
  } catch {
    // Never forward an upstream login error, which may contain request credentials.
    res.status(500).json({ ok: false, message: "登录状态保存失败，请重新登录。" });
  }
});

boundRouter.post("/link/pick", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.json(await pickAccount((req.body || {}).companyId));
});

boundRouter.get("/link/qr", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  let image;
  try { image = await qrBytes(); }
  catch { return res.status(502).json({ ok: false, message: "二维码暂时未取得，请稍后重试。" }); }
  if (!image) {
    res.status(404).json({ ok: false, error: "二维码还没生成", module: "bound", source: "crawler", erp: false });
    return;
  }
  if (image.kind === "url") {
    if (req.query.open === "1") {
      try {
        const url = new URL(image.url);
        if (url.protocol !== "https:") throw new Error("invalid_auth_url");
        return res.redirect(url.href);
      } catch { return res.status(400).json({ ok: false, message: "官方授权地址不可用，请重新获取。" }); }
    }
    res.json({ ok: true, url: image.url, module: "bound", source: "crawler", erp: false });
    return;
  }
  res.setHeader("Content-Type", image.type || "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.send(image.buffer);
});

boundRouter.post("/collect/tick", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.json(await tick());
});

boundRouter.get("/collect/probe", async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await singleProbeStatus(req.query.date);
    res.status(result.statusCode || 200).json(result);
  } catch (error) { next(error); }
});

boundRouter.post("/collect/probe", async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await runSingleProbe(req.body || {});
    res.status(result.statusCode || 200).json(result);
  } catch (error) { next(error); }
});
