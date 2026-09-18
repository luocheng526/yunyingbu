import { Router } from "express";
import {
  addTask,
  getBrief,
  getPaidSummary,
  getStoreSummary,
  ingestPaid,
  ingestRecharge,
  listPaid,
  listRecharge,
  listSubaccounts,
  listTasks,
  setBrief
} from "./store.js";
import {
  ackWorkerConfig,
  listEditorConfig,
  listRuleHistory,
  pullWorkerConfig,
  replaceStoreOwners,
  resolveActor,
  saveEditorConfig
} from "./recharge-config.js";

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

// 本地程序跑完付费数据后回传。同一店铺名称 + 日期再传会覆盖。
shenRouter.post("/paid/ingest", async (req, res) => {
  try {
    res.status(201).json(await ingestPaid(req.body));
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || "无法回传付费数据" });
  }
});

shenRouter.post("/paid/recharge/ingest", async (req, res) => {
  try {
    res.status(201).json(await ingestRecharge(req.body));
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || "无法回传充值记录" });
  }
});

shenRouter.get("/paid/subaccounts", async (req, res) => {
  try {
    res.json(
      await listSubaccounts({
        store: req.query.store,
        from: req.query.from,
        to: req.query.to,
        limit: req.query.limit
      })
    );
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载子账号" });
  }
});

shenRouter.get("/paid/recharges", async (req, res) => {
  try {
    res.json(
      await listRecharge({
        store: req.query.store,
        from: req.query.from,
        to: req.query.to,
        limit: req.query.limit
      })
    );
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载充值记录" });
  }
});

shenRouter.get("/paid/summary", async (req, res) => {
  try {
    res.json(
      await getPaidSummary({
        store: req.query.store,
        from: req.query.from,
        to: req.query.to,
        scope: req.query.scope,
        enabled: req.query.enabled,
        view: req.query.view,
        latest: req.query.latest
      })
    );
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载付费汇总" });
  }
});

shenRouter.get("/paid/recharge-config/editor", async (req, res) => {
  try {
    res.json(await listEditorConfig(req.query, resolveActor(req)));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载充值规则" });
  }
});

shenRouter.put("/paid/recharge-config", async (req, res) => {
  try {
    res.json(await saveEditorConfig(req.body, resolveActor(req)));
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || "无法保存充值规则" });
  }
});

shenRouter.get("/paid/recharge-config/history", async (req, res) => {
  try {
    res.json(await listRuleHistory(req.query, resolveActor(req)));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载修改历史" });
  }
});

shenRouter.post("/paid/recharge-config/owners", async (req, res) => {
  try {
    const actor = resolveActor(req);
    if (actor.username && req.body?.username && req.body.username !== actor.username && !String(actor.role || "").includes("超级管理员")) {
      res.status(403).json({ error: "只能维护自己的店铺归属" });
      return;
    }
    res.status(201).json(await replaceStoreOwners(req.body?.username || actor.username, req.body?.stores || req.body?.店铺 || []));
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || "无法保存店铺归属" });
  }
});

shenRouter.get("/paid/recharge-config", async (req, res) => {
  try {
    const payload = await pullWorkerConfig(req.query, resolveActor(req));
    if (payload.changed === false && String(req.query.http304 || "") === "1") {
      res.status(304).end();
      return;
    }
    res.json(payload);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法读取充值规则" });
  }
});

shenRouter.post("/paid/recharge-config/ack", async (req, res) => {
  try {
    res.json(await ackWorkerConfig(req.body, resolveActor(req)));
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || "无法确认同步" });
  }
});

shenRouter.get("/paid", async (req, res) => {
  try {
    res.json(
      await listPaid({
        store: req.query.store,
        from: req.query.from,
        to: req.query.to,
        limit: req.query.limit,
        view: req.query.view,
        latest: req.query.latest,
        scope: req.query.scope,
        enabled: req.query.enabled
      })
    );
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || "无法加载付费数据" });
  }
});
