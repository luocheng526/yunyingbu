import { Router } from "express";
import { addTask, getBrief, listTasks, setBrief } from "./store.js";

export const shenRouter = Router();

shenRouter.get("/tasks", async (_req, res) => {
  try {
    res.json({ tasks: await listTasks() });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载任务" });
  }
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
  try {
    res.json(await getBrief());
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载简报" });
  }
});

shenRouter.put("/brief", async (req, res) => {
  if (req.body == null || !Object.prototype.hasOwnProperty.call(req.body, "text")) {
    res.status(400).json({ error: "text 必填" });
    return;
  }
  try {
    res.json(await setBrief(req.body.text));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法保存简报" });
  }
});
