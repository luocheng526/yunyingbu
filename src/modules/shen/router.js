import { Router } from "express";
import { addTask, getBrief, getStoreSummary, listTasks, setBrief } from "./store.js";

export const shenRouter = Router();

// 其他智能体只读本模块：GET /api/shen/summary?store=&from=&to=
// 只返回按店 + 时间范围聚合后的计数，不返回明细，也不开放内部表查询。
shenRouter.get("/summary", async (req, res) => {
  try {
    res.json(
      await getStoreSummary({
        store: req.query.store,
        from: req.query.from,
        to: req.query.to
      })
    );
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载汇总" });
  }
});

shenRouter.get("/tasks", async (_req, res) => {
  try {
    res.json({ tasks: await listTasks() });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载任务" });
  }
});

shenRouter.post("/tasks", async (req, res) => {
  try {
    const task = await addTask(req.body?.title, req.body?.store);
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
