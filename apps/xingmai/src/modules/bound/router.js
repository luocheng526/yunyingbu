import { Router } from "express";
import { isHrDesk } from "../home/nav-items.js";
import {
  catalogBody,
  coverageBody,
  progressBody,
  ensureCollectLoop,
  exportView,
  isBoundAdmin,
  linkStatus,
  noteQrClient,
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
  res.json(await pollLink());
});

boundRouter.post("/link/start", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.json(await startLink((req.body || {}).provider));
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
  noteQrClient(req.query || {});
  const image = await qrBytes();
  if (!image) {
    res.status(404).json({ ok: false, error: "二维码还没生成", module: "bound", source: "crawler", erp: false });
    return;
  }
  if (image.kind === "url") {
    res.json({ ok: true, url: image.url, module: "bound", source: "crawler", erp: false });
    return;
  }
  res.setHeader("Content-Type", image.type || "image/png");
  res.setHeader("Cache-Control", "private, max-age=120");
  res.send(image.buffer);
});

boundRouter.post("/collect/tick", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  res.json(await tick());
});
