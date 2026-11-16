import { Router } from "express";
import { getReport, getSettings, saveMembers, saveReport, saveTemplate, snapshot } from "./store.js";

export const workRouter = Router();

function sendResult(res, result, fallbackStatus = 400) {
  if (!result || result.ok === false) {
    res.status(Number(result?.statusCode) || fallbackStatus).json({
      ok: false,
      error: result?.error || "失败"
    });
    return;
  }
  res.json(result);
}

function wrap(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      res.status(500).json({ ok: false, error: err.message || "失败" });
    });
  };
}

workRouter.get(
  "/",
  wrap(async (req, res) => {
    sendResult(res, await snapshot(req.user), 401);
  })
);

workRouter.get(
  "/settings",
  wrap(async (req, res) => {
    sendResult(res, await getSettings(req.user), 403);
  })
);

workRouter.put(
  "/settings/members",
  wrap(async (req, res) => {
    sendResult(res, await saveMembers(req.user, req.body || {}));
  })
);

workRouter.put(
  "/settings/templates",
  wrap(async (req, res) => {
    sendResult(res, await saveTemplate(req.user, req.body || {}));
  })
);

workRouter.get(
  "/report",
  wrap(async (req, res) => {
    sendResult(res, await getReport(req.user, req.query || {}));
  })
);

workRouter.put(
  "/report",
  wrap(async (req, res) => {
    sendResult(res, await saveReport(req.user, req.body || {}));
  })
);
