import { Router } from "express";
import {
  createRecord,
  createStore,
  deleteRecord,
  deleteStore,
  snapshot,
  updateRecord,
  updateStore
} from "./store.js";

export const storesRouter = Router();

function sendResult(res, result, created) {
  if (!result.ok) {
    res.status(result.statusCode || 400).json({ ok: false, error: result.error });
    return;
  }
  res.status(created ? 201 : 200).json({ ok: true, ...result });
}

storesRouter.get("/", async (_req, res) => {
  const data = await snapshot();
  res.json({
    ok: true,
    module: "店铺维护中心",
    message: "",
    ...data
  });
});

storesRouter.post("/", async (req, res) => {
  sendResult(res, await createStore(req.body || {}), true);
});

storesRouter.patch("/:id", async (req, res) => {
  sendResult(res, await updateStore(req.params.id, req.body || {}), false);
});

storesRouter.delete("/:id", async (req, res) => {
  sendResult(res, await deleteStore(req.params.id), false);
});

storesRouter.post("/records", async (req, res) => {
  sendResult(res, await createRecord(req.body || {}), true);
});

storesRouter.patch("/records/:id", async (req, res) => {
  sendResult(res, await updateRecord(req.params.id, req.body || {}), false);
});

storesRouter.delete("/records/:id", async (req, res) => {
  sendResult(res, await deleteRecord(req.params.id), false);
});
