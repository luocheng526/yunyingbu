import { Router } from "express";
import { createHanStore } from "./store.js";

export function createHanRouter(store = createHanStore()) {
  const hanRouter = Router();

  // 智能体只读汇总：按店 + 时间范围。不要直接查 han_* 内部表。
  hanRouter.get("/summary", async (req, res) => {
    try {
      const summary = await store.listSummary({
        store: req.query.store,
        from: req.query.from,
        to: req.query.to,
      });
      res.json({ ok: true, ...summary });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/tasks", async (_req, res) => {
    try {
      res.json({ ok: true, tasks: await store.listTasks() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/tasks", async (req, res) => {
    try {
      const task = await store.createTask(req.body || {});
      res.status(201).json({ ok: true, task });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/brief", async (_req, res) => {
    try {
      res.json({ ok: true, ...(await store.getBrief()) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.put("/brief", async (req, res) => {
    try {
      const body = req.body || {};
      res.json({ ok: true, ...(await store.setBrief({ text: body.text })) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/selection", async (_req, res) => {
    try {
      res.json({ ok: true, items: await store.listSelection() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/selection", async (req, res) => {
    try {
      const item = await store.createSelection(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/products", async (_req, res) => {
    try {
      res.json({ ok: true, items: await store.listProducts() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/products", async (req, res) => {
    try {
      const item = await store.createProduct(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/paid", async (_req, res) => {
    try {
      res.json({ ok: true, items: await store.listPaid() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/paid", async (req, res) => {
    try {
      const item = await store.createPaid(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/training", async (_req, res) => {
    try {
      res.json({ ok: true, items: await store.listTraining() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/training", async (req, res) => {
    try {
      const item = await store.createTraining(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  return hanRouter;
}

export const hanRouter = createHanRouter();
export default hanRouter;
