import { Router } from "express";
import { createTask, getBrief, listTasks, setBrief } from "./store.js";

export const hanRouter = Router();

hanRouter.get("/tasks", async (_req, res) => {
  res.json({ ok: true, tasks: await listTasks() });
});

hanRouter.post("/tasks", async (req, res) => {
  try {
    const task = await createTask(req.body || {});
    res.status(201).json({ ok: true, task });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

hanRouter.get("/brief", async (_req, res) => {
  res.json({ ok: true, ...(await getBrief()) });
});

hanRouter.put("/brief", async (req, res) => {
  const body = req.body || {};
  res.json({ ok: true, ...(await setBrief({ text: body.text })) });
});

export default hanRouter;
