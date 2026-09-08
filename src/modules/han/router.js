import { Router } from "express";
import { createTask, getBrief, listTasks, setBrief } from "./store.js";

export const hanRouter = Router();

hanRouter.get("/tasks", (_req, res) => {
  res.json({ ok: true, tasks: listTasks() });
});

hanRouter.post("/tasks", (req, res) => {
  try {
    const task = createTask(req.body || {});
    res.status(201).json({ ok: true, task });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

hanRouter.get("/brief", (_req, res) => {
  res.json({ ok: true, ...getBrief() });
});

hanRouter.put("/brief", (req, res) => {
  const body = req.body || {};
  res.json({ ok: true, ...setBrief({ text: body.text }) });
});

export default hanRouter;
