import express from "express";
import { requireReleasesAuth } from "./auth.js";
import { checkMainBrainOrder, hasCompleteDocument, parseMainBrainOrder, parseReleaseDocument } from "./document.js";
import { pushXingmaiToEcs } from "./push.js";
import { restartMengkaiService } from "./restart.js";
import { createStore, MODULES } from "./store.js";

const PUBLIC_VERIFY = "http://zx.xingmaierp.cc/";

function publishBlockedReason(item) {
  if (!item) {
    return { status: 404, error: "单据不存在" };
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
  if (item.status !== "queued" && item.status !== "approved") {
    return { status: 409, error: "当前状态不允许发布" };
  }
  return null;
}

function ticketFromOrder(body, order) {
  const parsed = parseReleaseDocument(body);
  const complete = parsed.complete;
  let module = parsed.document.module || order.module || "";
  if (!module) {
    module = "版本发布中心";
  }
  const version = String(body.version || "").trim() || `fast-${Date.now()}`;
  const applicant = String(body.applicant || "").trim() || "主脑";
  if (complete) {
    return {
      complete: true,
      version,
      applicant,
      module,
      summary: String(body.summary || "").trim() || `按文档发版 ${module}`,
      files: parsed.document.files,
      acceptance: parsed.document.acceptance,
      restart: parsed.document.restart
    };
  }
  return {
    complete: false,
    version,
    applicant,
    module,
    summary: String(body.summary || "").trim() || "前期无文档，全量同步 apps/xingmai",
    files: [],
    acceptance: "前期无文档，全量同步 apps/xingmai",
    restart: true
  };
}

function successLog(item, pushResult, extra, noDoc) {
  const pushNote = pushResult && pushResult.stdout ? String(pushResult.stdout).trim() : "push-xingmai-to-ecs.sh 完成";
  const prefix = noDoc
    ? "前期无文档，全量同步 apps/xingmai。"
    : `按发布文档发版（模块 ${item.module}）。已推送：${(item.files || []).join("、") || "（无文件）"}。`;
  return `${prefix}${pushNote} ${extra} 公网验收：打开 ${PUBLIC_VERIFY} 看对应模块。队列下一条不会自动发布。`;
}

export function createReleasesRouter(options = {}) {
  const store = options.store || createStore({ now: options.now });
  const restart = options.restart || restartMengkaiService;
  const push = options.push || pushXingmaiToEcs;
  const router = express.Router();
  router.use(requireReleasesAuth(options));

  async function runPublishJob(item, noDoc) {
    const files = noDoc ? [] : item.files || [];
    const shouldRestart = noDoc ? true : Boolean(item.restart);
    const pushResult = await push(files);
    let extra = "";
    if (shouldRestart) {
      const result = await restart();
      extra = result && result.skipped ? `未执行 systemctl：${result.reason}` : "已 systemctl restart mengkai.service";
    } else {
      extra = "文档要求不重启，已跳过 systemctl。";
    }
    store.markSuccess(item, successLog(item, pushResult, extra, noDoc));
    return { ok: true };
  }

  async function handlePublish(req, res, item, extras = {}) {
    const blocked = publishBlockedReason(item);
    if (blocked) {
      res.status(blocked.status).json({ ok: false, error: blocked.error });
      return;
    }

    const rawOrder = extras.websiteConfirm ? "发版" : req.body?.order ?? req.body?.口令;
    const order = checkMainBrainOrder(rawOrder, item.module);
    if (!order.ok) {
      res.status(409).json({ ok: false, error: order.error });
      return;
    }

    const acquired = store.tryAcquireLock(item);
    if (!acquired) {
      res.status(409).json({ ok: false, error: "有发布正在进行，禁止抢发" });
      return;
    }

    store.markPublishing(item);
    const noDoc = !hasCompleteDocument(item);

    const runJob = async () => {
      try {
        return await runPublishJob(item, noDoc);
      } catch (err) {
        const message = `发版失败：${err?.message || err}。已释放发布锁。`;
        store.markFailed(item, message);
        return { ok: false, error: message };
      } finally {
        store.releaseLock();
      }
    };

    const defer = (noDoc || item.restart) && restart === restartMengkaiService;
    if (defer) {
      res.json({
        ok: true,
        item,
        version: item.version,
        noDoc,
        note: noDoc ? "前期无文档，全量同步 apps/xingmai" : ""
      });
      setTimeout(() => {
        runJob().catch((err) => {
          console.error("release job failed", err);
        });
      }, 400);
      return;
    }

    const result = await runJob();
    if (result.ok) {
      res.json({
        ok: true,
        item,
        version: item.version,
        noDoc,
        note: noDoc ? "前期无文档，全量同步 apps/xingmai" : ""
      });
      return;
    }
    res.status(500).json({ ok: false, error: result.error, item, version: item.version });
  }

  router.get("/", (_req, res) => {
    res.json({ ok: true, items: store.list() });
  });

  router.get("/queue", (_req, res) => {
    res.json({ ok: true, items: store.queue() });
  });

  router.get("/lock", (_req, res) => {
    res.json({ ok: true, ...store.getLock() });
  });

  router.post("/go", async (req, res) => {
    const body = req.body || {};
    const order = parseMainBrainOrder(body.order ?? body.口令);
    if (!order.ok) {
      res.status(409).json({ ok: false, error: order.error });
      return;
    }
    if (store.getLock().locked) {
      res.status(409).json({ ok: false, error: "有发布正在进行，禁止抢发" });
      return;
    }
    const ticket = ticketFromOrder(body, order);
    if (ticket.complete && ticket.module && !MODULES.includes(ticket.module)) {
      res.status(400).json({ ok: false, error: "模块不在允许列表中" });
      return;
    }
    const item = store.create({
      version: ticket.version,
      applicant: ticket.applicant,
      summary: ticket.summary,
      module: ticket.module,
      files: ticket.files,
      acceptance: ticket.acceptance,
      restart: ticket.restart,
      source: String(body.source || body.对话 || ticket.applicant).trim()
    });
    await handlePublish(req, res, item);
  });

  router.post("/", (req, res) => {
    const body = req.body || {};
    const version = String(body.version || "").trim();
    const applicant = String(body.applicant || "").trim();
    const summary = String(body.summary || "").trim();
    const parsed = parseReleaseDocument(body);
    if (!version || !applicant || !summary) {
      res.status(400).json({
        ok: false,
        error: "版本号、申请人、变更摘要均为必填",
        missing: ["版本号", "申请人", "变更摘要"].filter((label, i) => ![version, applicant, summary][i])
      });
      return;
    }
    const module = parsed.document.module || "其他";
    if (parsed.complete && !MODULES.includes(module)) {
      res.status(400).json({ ok: false, error: "模块不在允许列表中" });
      return;
    }
    const item = store.create({
      version,
      applicant,
      summary,
      module,
      files: parsed.complete ? parsed.document.files : parsed.document.files,
      acceptance: parsed.complete ? parsed.document.acceptance : parsed.document.acceptance,
      restart: parsed.complete ? parsed.document.restart : true,
      source: String(body.source || body.对话 || applicant).trim()
    });
    res.status(201).json({ ok: true, item, incomplete: !parsed.complete });
  });

  router.post("/reorder", (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length) {
      res.status(400).json({ ok: false, error: "请提供排队 id 列表" });
      return;
    }
    const items = store.reorder(ids);
    res.json({ ok: true, items });
  });

  router.post("/:id/move", (req, res) => {
    const direction = String(req.body?.direction || "").trim();
    if (direction !== "up" && direction !== "down") {
      res.status(400).json({ ok: false, error: "direction 只能是 up 或 down" });
      return;
    }
    const result = store.move(req.params.id, direction);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item, items: result.items });
  });

  router.post("/:id/confirm", async (req, res) => {
    const item = store.get(req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, error: "单据不存在" });
      return;
    }
    if (item.status === "queued") {
      store.approve(item.id);
    }
    await handlePublish(req, res, store.get(req.params.id), { websiteConfirm: true });
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
    await handlePublish(req, res, item);
  });

  return router;
}

export const releasesRouter = createReleasesRouter();
