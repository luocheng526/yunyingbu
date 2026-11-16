import { Router } from "express";
import { getBoard, saveBoard } from "./store.js";

export const meetingRouter = Router();

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

meetingRouter.get(
  "/",
  wrap(async (req, res) => {
    sendResult(res, await getBoard(req.user, req.query?.month), 401);
  })
);

meetingRouter.put(
  "/",
  wrap(async (req, res) => {
    sendResult(res, await saveBoard(req.user, req.body || {}));
  })
);
