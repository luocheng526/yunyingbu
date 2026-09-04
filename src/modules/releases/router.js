import express from "express";
import { requireReleasesAuth } from "./auth.js";
import { restartMengkaiService } from "./restart.js";
import { createStore, MODULES } from "./store.js";

function publishBlockedReason(item) {
  if (!item) {
    return { status: 404, error: "单据不存在" };
  }
  if (item.status === "queued") {
    return { status: 409, error: "未审核通过，禁止发布" };
  }
  if (item.status === "rejected") {
    return { status: 409, error: "已驳回的单据禁止发布" };
  }
  if (item.status === "publishing") {
    return { status: 409, error: "有发布正在进行，禁止抢发" };
  }
  if (item.status === "success" || item.status === "failed") {
    return { status: 409, error: "该单据已结束，禁止再次发布" };
  }
  if (item.status !== "approved") {
    return { status: 409, error: "当前状态不允许发布" };
  }
  return null;
}

export function createReleasesRouter(options = {}) {
  const store = options.store || createStore({ now: options.now });
  const restart = options.restart || restartMengkaiService;
  const router = express.Router();
  router.use(requireReleasesAuth(options));

  router.get("/", (_req, res) => {
    res.json({ ok: true, items: store.list() });
  });

  router.get("/queue", (_req, res) => {
    res.json({ ok: true, items: store.queue() });
  });

  router.get("/lock", (_req, res) => {
    res.json({ ok: true, ...store.getLock() });
  });

  router.post("/", (req, res) => {
    const body = req.body || {};
    const version = String(body.version || "").trim();
    const applicant = String(body.applicant || "").trim();
    const module = String(body.module || "").trim();
    const summary = String(body.summary || "").trim();
    if (!version || !applicant || !module || !summary) {
      res.status(400).json({ ok: false, error: "版本号、申请人、模块、变更摘要均为必填" });
      return;
    }
    if (!MODULES.includes(module)) {
      res.status(400).json({ ok: false, error: "模块不在允许列表中" });
      return;
    }
    const item = store.create({ version, applicant, module, summary });
    res.status(201).json({ ok: true, item });
  });

  router.post("/:id/approve", (req, res) => {
    const result = store.approve(req.params.id);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item });
  });

  router.post("/:id/reject", (req, res) => {
    const result = store.reject(req.params.id, req.body?.reason);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item });
  });

  router.post("/:id/publish", async (req, res) => {
    const item = store.get(req.params.id);
    const blocked = publishBlockedReason(item);
    if (blocked) {
      res.status(blocked.status).json({ ok: false, error: blocked.error });
      return;
    }

    const acquired = store.tryAcquireLock(item);
    if (!acquired) {
      res.status(409).json({ ok: false, error: "有发布正在进行，禁止抢发" });
      return;
    }

    store.markPublishing(item);

    try {
      const result = await restart();
      const extra = result && result.skipped ? result.reason : "";
      store.markSuccess(
        item,
        extra
          ? `发布完成（未执行 systemctl：${extra}）。队列下一条不会自动发布。`
          : undefined
      );
      res.json({ ok: true, item });
    } catch (err) {
      const message = `重启失败：${err?.message || err}。已释放发布锁。`;
      store.markFailed(item, message);
      res.status(500).json({ ok: false, error: message, item });
    } finally {
      store.releaseLock();
    }
  });

  return router;
}

export const releasesRouter = createReleasesRouter();
