import { Router } from "express";
import { createItem, listItems, updateItem } from "./store.js";

export const feedbackRouter = Router();

function sendResult(res, result, fallbackStatus = 400) {
  if (!result || result.ok === false) {
    res.status(Number(result?.statusCode) || fallbackStatus).json({
      ok: false,
      error: result?.error || "失败"
    });
    return;
  }
  const status = result.created ? 201 : 200;
  const body = { ...result };
  delete body.created;
  res.status(status).json(body);
}

function wrap(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      res.status(500).json({ ok: false, error: err.message || "失败" });
    });
  };
}

// 壳上的导航测试锁定这个桩。列表和提交走 /items，不要改这一条的响应。
feedbackRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "feedback" });
});

feedbackRouter.get(
  "/items",
  wrap(async (req, res) => {
    sendResult(res, await listItems(req.user, req.query || {}), 401);
  })
);

feedbackRouter.post(
  "/items",
  wrap(async (req, res) => {
    const result = await createItem(req.user, req.body || {});
    if (result && result.ok) {
      result.created = true;
    }
    sendResult(res, result, 401);
  })
);

feedbackRouter.patch(
  "/items/:id",
  wrap(async (req, res) => {
    sendResult(res, await updateItem(req.user, req.params.id, req.body || {}), 401);
  })
);
