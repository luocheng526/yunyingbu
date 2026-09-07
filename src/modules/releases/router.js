import express from "express";
import path from "node:path";
import { requireReleasesAuth } from "./auth.js";
import { hasCompleteDocument, parseMainBrainOrder, parseReleaseDocument } from "./document.js";
import { pushXingmaiToEcs } from "./push.js";
import { restartMengkaiService } from "./restart.js";
import { attachPipelineRoutes, attachPipelineWebhook } from "./pipeline/attach.js";
import { createPipelineStore } from "./pipeline/store.js";
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

function successLog(item, pushResult, extra, noDoc) {
  const pushNote = pushResult && pushResult.stdout ? String(pushResult.stdout).trim() : "push-xingmai-to-ecs.sh 完成";
  const prefix = noDoc
    ? "前期无文档，全量同步 apps/xingmai。"
    : `按发布文档发版（模块 ${item.module}）。已推送：${(item.files || []).join("、") || "（无文件）"}。`;
  return `${prefix}${pushNote} ${extra} 公网验收：打开 ${PUBLIC_VERIFY} 看对应模块。队列下一条不会自动发布。`;
}

export function createReleasesRouter(options = {}) {
  const stateDir = options.stateDir || process.env.MENGKAI_STATE_DIR || "";
  const store =
    options.store ||
    createStore({
      now: options.now,
      persistPath: stateDir ? path.join(stateDir, "tickets.json") : ""
    });
  const pipelineStore =
    options.pipelineStore ||
    createPipelineStore({
      now: options.now,
      persistPath: stateDir ? path.join(stateDir, "pipeline.json") : ""
    });
  const restart = options.restart || restartMengkaiService;
  const push = options.push || pushXingmaiToEcs;
  const router = express.Router();
  router.use(requireReleasesAuth(options));
  attachPipelineWebhook(router, { ...options, pipelineStore });
  attachPipelineRoutes(router, { ...options, pipelineStore });

  async function runPublishJob(item, noDoc) {
    const files = noDoc ? [] : item.files || [];
    const shouldRestart = Boolean(item.restart);
    const pushResult = await push(files);
    let extra = "";
    if (shouldRestart) {
      const result = await restart();
      extra = result && result.skipped ? `未执行 systemctl：${result.reason}` : "已 systemctl restart mengkai.service";
    } else {
      extra = "文档要求不重启，已跳过 systemctl。";
    }
    await store.markSuccess(item, successLog(item, pushResult, extra, noDoc));
    return { ok: true };
  }

  async function handlePublish(req, res, item) {
    const blocked = publishBlockedReason(item);
    if (blocked) {
      res.status(blocked.status).json({ ok: false, error: blocked.error });
      return;
    }

    const acquired = await store.tryAcquireLock(item);
    if (!acquired) {
      res.status(409).json({ ok: false, error: "有发布正在进行，禁止抢发" });
      return;
    }

    await store.markPublishing(item);
    const noDoc = !hasCompleteDocument(item);

    const runJob = async () => {
      try {
        return await runPublishJob(item, noDoc);
      } catch (err) {
        const message = `发版失败：${err?.message || err}。已释放发布锁。`;
        await store.markFailed(item, message);
        return { ok: false, error: message };
      } finally {
        await store.releaseLock();
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

  router.get("/", async (_req, res) => {
    res.json({ ok: true, items: await store.list() });
  });

  router.get("/queue", async (_req, res) => {
    res.json({ ok: true, items: await store.queue() });
  });

  router.get("/lock", async (_req, res) => {
    res.json({ ok: true, ...(await store.getLock()) });
  });

  router.post("/go", (req, res) => {
    const order = parseMainBrainOrder(req.body?.order ?? req.body?.口令);
    if (!order.ok) {
      res.status(409).json({ ok: false, error: order.error });
      return;
    }
    res.status(409).json({
      ok: false,
      error: "未通过禁止发。请各对话 POST /api/releases 交单，主脑在看板点通过。"
    });
  });

  router.post("/", async (req, res) => {
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
    const item = await store.create({
      version,
      applicant,
      source: body.source || applicant,
      summary,
      module,
      files: parsed.complete ? parsed.document.files : parsed.document.files,
      acceptance: parsed.complete ? parsed.document.acceptance : parsed.document.acceptance,
      restart: parsed.complete ? parsed.document.restart : true
    });
    res.status(201).json({ ok: true, item, incomplete: !parsed.complete });
  });

  router.post("/reorder", async (req, res) => {
    const result = await store.reorder(req.body?.ids);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, items: result.items });
  });

  router.post("/:id/approve", async (req, res) => {
    const item = await store.get(req.params.id);
    await handlePublish(req, res, item);
  });

  router.post("/:id/reject", async (req, res) => {
    const result = await store.reject(req.params.id, req.body?.reason);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item });
  });

  router.post("/:id/move", async (req, res) => {
    const result = await store.move(req.params.id, req.body?.direction);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item, items: result.items });
  });

  router.post("/:id/confirm", async (req, res) => {
    const item = await store.get(req.params.id);
    await handlePublish(req, res, item);
  });

  router.post("/:id/publish", (_req, res) => {
    res.status(409).json({ ok: false, error: "未通过禁止发。请在看板点通过。" });
  });

  return router;
}

export const releasesRouter = createReleasesRouter();
