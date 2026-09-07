import express from "express";
import os from "node:os";
import path from "node:path";
import { requireReleasesAuth } from "./auth.js";
import { NEED_PASS_ERROR, REORDER_FORBIDDEN, withCharter } from "./charter.js";
import { hasCompleteDocument, parseMainBrainOrder, parseReleaseDocument } from "./document.js";
import { assertQueueHead, describeNextVersion, listModuleVersions, resolveReleaseVersion } from "./version.js";
import { assertSafeRel, attachRollbackMeta, formatExecError, listMissingSourceFiles, liveRoot, markSnapshotRolledBack, pathsToSnapshot, pushXingmaiToEcs, restoreSnapshot, sourceRoot } from "./push.js";
import {
  parseGitRef,
  parseRepository,
  resolveStageRoots,
  shouldRejectUnchangedAtCreate,
  sourceMatchesLive,
  stageTicketSources,
  unchangedCreateError
} from "./stage.js";
import { filesNeedProcessRestart, restartMengkaiService, ticketNeedsProcessRestart } from "./restart.js";
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
  const resolveLive = () => options.liveRoot || liveRoot(options.env);
  const resolveSource = () => options.sourceRoot || sourceRoot(options.env);
  const resolveState = () => stateDir || os.tmpdir();
  const withSnap = (item) => attachRollbackMeta(item, resolveState());
  const withSnapList = (items) => (items || []).map(withSnap);
  const router = express.Router();
  router.use(requireReleasesAuth(options));
  attachPipelineWebhook(router, { ...options, pipelineStore });
  attachPipelineRoutes(router, { ...options, pipelineStore });

  async function runPublishJob(item, noDoc) {
    const files = noDoc ? [] : item.files || [];
    const shouldRestart = ticketNeedsProcessRestart(item, noDoc);
    const snapshotDir = path.join(stateDir || os.tmpdir(), "snapshots", item.id);
    if (!noDoc && item.gitRef) {
      await stageTicketSources(files, {
        sourceRoot: resolveSource(),
        ref: item.gitRef,
        repository: item.repository,
        fetchImpl: options.fetchImpl,
        env: options.env || process.env,
        keepSourceOnMiss: true
      });
    }
    const pushResult = await push(files, {
      snapshotDir,
      sourceRoot: options.sourceRoot,
      liveRoot: resolveLive(),
      env: options.env || process.env
    });
    item.snapshotDir = snapshotDir;
    let extra = "";
    if (shouldRestart) {
      extra = "成功状态已先落盘，随后重启线上进程。";
      await store.markSuccess(item, successLog(item, pushResult, extra, noDoc));
      await store.releaseLock();
      const result = await restart();
      extra = result && result.skipped ? `未执行 systemctl：${result.reason}` : "已 systemctl restart mengkai.service";
      await store.markSuccess(item, successLog(item, pushResult, extra, noDoc));
    } else if (item.restart && !filesNeedProcessRestart(files)) {
      extra = "只改了页面或测试文件，已跳过重启，避免打断正在使用的人。";
      await store.markSuccess(item, successLog(item, pushResult, extra, noDoc));
    } else {
      extra = "文档要求不重启，已跳过 systemctl。";
      await store.markSuccess(item, successLog(item, pushResult, extra, noDoc));
    }
    return { ok: true };
  }

  async function handlePublish(req, res, item) {
    const blocked = publishBlockedReason(item);
    if (blocked) {
      res.status(blocked.status).json({ ok: false, error: blocked.error });
      return;
    }

    const skip = assertQueueHead(item, await store.queue());
    if (skip) {
      res.status(skip.status).json({ ok: false, error: skip.error });
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
        const message = formatExecError(err);
        await store.markFailed(item, message);
        return { ok: false, error: message };
      } finally {
        await store.releaseLock();
      }
    };

    const willRestart = ticketNeedsProcessRestart(item, noDoc);
    const defer = (noDoc || willRestart) && restart === restartMengkaiService;
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
    res.json(withCharter({ ok: true, items: withSnapList(await store.list()) }));
  });

  router.get("/queue", async (_req, res) => {
    res.json(withCharter({ ok: true, items: await store.queue() }));
  });

  router.get("/lock", async (_req, res) => {
    res.json(withCharter({ ok: true, ...(await store.getLock()) }));
  });

  router.get("/versions", async (_req, res) => {
    res.json(withCharter({ ok: true, ...listModuleVersions(withSnapList(await store.list())) }));
  });

  router.get("/next", async (req, res) => {
    const slug = req.query?.slug || req.query?.说明 || "next";
    res.json(withCharter({ ok: true, ...describeNextVersion(await store.list(), slug) }));
  });

  router.post("/go", (req, res) => {
    const order = parseMainBrainOrder(req.body?.order ?? req.body?.口令);
    if (!order.ok) {
      res.status(409).json({ ok: false, error: order.error });
      return;
    }
    res.status(409).json({
      ok: false,
      error: NEED_PASS_ERROR
    });
  });

  router.post("/", async (req, res) => {
    const body = req.body || {};
    const applicant = String(body.applicant || "").trim();
    const summary = String(body.summary || "").trim();
    const parsed = parseReleaseDocument(body);
    if (!applicant || !summary) {
      res.status(400).json({
        ok: false,
        error: "申请人、变更摘要均为必填",
        missing: ["申请人", "变更摘要"].filter((label, i) => ![applicant, summary][i])
      });
      return;
    }
    const items = await store.list();
    const resolved = resolveReleaseVersion(items, body.version, body.slug || summary);
    if (!resolved.ok) {
      res.status(resolved.status || 400).json({
        ok: false,
        error: resolved.error,
        next: describeNextVersion(items)
      });
      return;
    }
    const version = resolved.version;
    const module = parsed.document.module || "其他";
    if (parsed.complete && !MODULES.includes(module)) {
      res.status(400).json({ ok: false, error: "模块不在允许列表中" });
      return;
    }
    let files = parsed.document.files || [];
    try {
      files = files.map(assertSafeRel);
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: `${err.message}。只允许 public、src、test、package.json、package-lock.json。`
      });
      return;
    }
    const gitRef = parseGitRef(body);
    let repository = "";
    try {
      repository = gitRef ? parseRepository(body, options.env || process.env) : "";
      await stageTicketSources(files, {
        sourceRoot: resolveSource(),
        contents: body.contents || body.blobs,
        ref: gitRef,
        repository,
        fetchImpl: options.fetchImpl,
        env: options.env || process.env
      });
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message });
      return;
    }
    const missing = listMissingSourceFiles(files, resolveSource());
    if (missing.length) {
      res.status(400).json({
        ok: false,
        error: `源目录缺少文件：${missing.join("、")}。闸门不读 Cloud 工作区。交单请带 contents 或 ref，或先把文件放到源目录。`,
        missing
      });
      return;
    }
    const roots = resolveStageRoots({
      sourceRoot: resolveSource(),
      liveRoot: resolveLive(),
      env: options.env || process.env
    });
    if (files.length && shouldRejectUnchangedAtCreate(roots.source, roots.live) && sourceMatchesLive(files, roots.source, roots.live)) {
      res.status(409).json({
        ok: false,
        error: unchangedCreateError(),
        hint: "交单只登记路径。GitHub 上的提交不会自动进源目录。请带 contents 或 ref。"
      });
      return;
    }
    const item = await store.create({
      version,
      applicant,
      source: body.source || applicant,
      summary,
      module,
      files,
      acceptance: parsed.complete ? parsed.document.acceptance : parsed.document.acceptance,
      restart: parsed.complete ? parsed.document.restart : true,
      gitRef,
      repository
    });
    res.status(201).json({ ok: true, item, incomplete: !parsed.complete });
  });

  router.post("/reorder", (_req, res) => {
    res.status(409).json({ ok: false, error: REORDER_FORBIDDEN });
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

  router.post("/:id/move", (_req, res) => {
    res.status(409).json({ ok: false, error: REORDER_FORBIDDEN });
  });

  router.post("/:id/requeue", async (req, res) => {
    const result = await store.requeueFailed(req.params.id);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item });
  });

  router.post("/:id/confirm", async (req, res) => {
    const item = await store.get(req.params.id);
    await handlePublish(req, res, item);
  });

  router.post("/:id/rollback", async (req, res) => {
    const item = withSnap(await store.get(req.params.id));
    if (!item) {
      res.status(404).json({ ok: false, error: "单据不存在" });
      return;
    }
    if (item.status !== "success") {
      res.status(409).json({ ok: false, error: "只能回滚已成功发布的版本" });
      return;
    }
    if (!item.snapshotDir) {
      res.status(409).json({ ok: false, error: "该版本没有升级前快照，不能回滚" });
      return;
    }
    const acquired = await store.tryAcquireLock(item);
    if (!acquired) {
      res.status(409).json({ ok: false, error: "有发布正在进行，禁止抢发" });
      return;
    }
    try {
      const restored = restoreSnapshot(item.snapshotDir, resolveLive(), pathsToSnapshot(item.files || []));
      let extra = "已按快照回滚文件。";
      markSnapshotRolledBack(item.snapshotDir);
      item.rolledBack = true;
      const willRestart = ticketNeedsProcessRestart(item);
      if (willRestart) {
        extra += " 回滚结果已先落盘，随后重启。";
        item.log = `已回滚到升级前快照。${restored.stdout || ""} ${extra} 版本号仍记为 ${item.version}，下一条不会自动发。`;
        await store.markSuccess(item, item.log);
        await store.releaseLock();
        const result = await restart();
        extra = "已按快照回滚文件。";
        extra += result && result.skipped ? ` ${result.reason}` : " 已重启 mengkai。";
      } else if (item.restart) {
        extra += " 只改了页面或测试，回滚后不重启，避免打断正在使用的人。";
      }
      item.log = `已回滚到升级前快照。${restored.stdout || ""} ${extra} 版本号仍记为 ${item.version}，下一条不会自动发。`;
      await store.markSuccess(item, item.log);
      res.json({ ok: true, item, version: item.version, rolledBack: true });
    } catch (err) {
      const message = formatExecError(err);
      res.status(500).json({ ok: false, error: message, item });
    } finally {
      await store.releaseLock();
    }
  });

  router.post("/:id/publish", (_req, res) => {
    res.status(409).json({ ok: false, error: NEED_PASS_ERROR });
  });

  return router;
}

export const releasesRouter = createReleasesRouter();
