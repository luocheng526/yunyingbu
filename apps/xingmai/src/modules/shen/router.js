import { Router } from "express";
import { addTask, getBrief, listTasks, setBrief } from "./store.js";

export const shenRouter = Router();

shenRouter.get("/tasks", async (_req, res) => {
  res.json({ tasks: await listTasks() });
});

shenRouter.post("/tasks", async (req, res) => {
  try {
    const task = await addTask(req.body?.title);
    res.status(201).json(task);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || "无法创建任务" });
  }
});

shenRouter.get("/brief", async (_req, res) => {
  res.json(await getBrief());
});

shenRouter.put("/brief", async (req, res) => {
  if (req.body == null || !Object.prototype.hasOwnProperty.call(req.body, "text")) {
    res.status(400).json({ error: "text 必填" });
    return;
  }
  res.json(await setBrief(req.body.text));
});
