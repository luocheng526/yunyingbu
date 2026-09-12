import express from "express";
import os from "node:os";
import path from "node:path";
import { requireReleasesAuth } from "./auth.js";
import { INCOMPLETE_ARTIFACT_ERROR, NEED_PASS_ERROR, REORDER_FORBIDDEN, returnFailedItem, withCharter } from "./charter.js";
import { documentGaps, hasCompleteDocument, parseMainBrainOrder, parseReleaseDocument, ticketGuardReason } from "./document.js";
import { readBoardView, slimFailedItem, slimVersionItem } from "./board.js";
import { assertQueueHead, describeNextVersion, listModuleVersions, resolveReleaseVersion } from "./version.js";
import { assertSafeRel, attachRollbackMeta, attachRollbackMetaList, formatExecError, listMissingSourceFiles, liveRoot, markSnapshotRolledBack, pathsToSnapshot, pushXingmaiToEcs, restoreSnapshot, sourceRoot } from "./push.js";
import {
  normalizeContents,
  parseGitRef,
  parseRepository,
  resolveStageRoots,
  shouldRejectUnchangedAtCreate,
  sourceMatchesLive,
  stageTicketSources,
  unchangedCreateError
} from "./stage.js";
import { filesNeedProcessRestart, restartMengkaiService, ticketNeedsProcessRestart } from "./restart.js";
import { smokeCheckBuffers, smokeCheckSyntax } from "./smoke.js";
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
  if (item.status === "failed") {
    return { status: 409, error: "该单据已结束，禁止再次发布" };
  }
  if (item.status !== "queued" && item.status !== "approved") {
    return { status: 409, error: "当前状态不允许发布" };
  }
  return null;
}

function alreadyPublishedPayload(item) {
  return {
    ok: true,
    item,
    version: item.version,
    already: item.status
  };
}

function successLog(item, pushResult, extra) {
  const pushNote = pushResult && pushResult.stdout ? String(pushResult.stdout).trim() : "push-xingmai-to-ecs.sh 完成";
  const prefix = `按发布文档发版（模块 ${item.module}）。已推送：${(item.files || []).join("、") || "（无文件）"}。`;
  return `${prefix}${pushNote} ${extra} 公网验收：打开 ${PUBLIC_VERIFY} 看对应模块。队列下一条不会自动发布。`;
}

function artifactGaps(item) {
  const gaps = documentGaps(item);
  if (item && item.module && !MODULES.includes(item.module)) {
    gaps.push("模块须在允许列表");
  }
  return gaps;
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
  const withSnapList = (items) => attachRollbackMetaList(items, resolveState());
  let listInflight = null;
  async function listed() {
    if (!listInflight) {
      listInflight = Promise.resolve()
        .then(() => store.list())
        .finally(() => {
          listInflight = null;
        });
    }
    return listInflight;
  }
  const router = express.Router();
  router.use(requireReleasesAuth(options));
  attachPipelineWebhook(router, { ...options, pipelineStore });
  attachPipelineRoutes(router, { ...options, pipelineStore });

  async function runPublishJob(item) {
    const files = item.files || [];
    if (!files.length) {
      throw Object.assign(new Error(INCOMPLETE_ARTIFACT_ERROR), { stderr: INCOMPLETE_ARTIFACT_ERROR });
    }
    const shouldRestart = ticketNeedsProcessRestart(item);
    const snapshotDir = path.join(stateDir || os.tmpdir(), "snapshots", item.id);
    if (item.gitRef) {
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
      await store.markSuccess(item, successLog(item, pushResult, extra));
      await store.releaseLock();
      const result = await restart();
      extra = result && result.skipped ? `未执行 systemctl：${result.reason}` : "已 systemctl restart mengkai.service";
      await store.markSuccess(item, successLog(item, pushResult, extra));
    } else if (item.restart && !filesNeedProcessRestart(files)) {
      extra = "只改了页面或测试文件，已跳过重启，避免打断正在使用的人。";
      await store.markSuccess(item, successLog(item, pushResult, extra));
    } else {
      extra = "文档要求不重启，已跳过 systemctl。";
      await store.markSuccess(item, successLog(item, pushResult, extra));
    }
    return { ok: true };
  }

  async function handlePublish(req, res, item) {
    if (!item) {
      res.status(404).json({ ok: false, error: "单据不存在" });
      return;
    }
    if (item.status === "publishing" || item.status === "success") {
      res.json(alreadyPublishedPayload(item));
      return;
    }

    const blocked = publishBlockedReason(item);
    if (blocked) {
      res.status(blocked.status).json({ ok: false, error: blocked.error });
      return;
    }

    const gaps = artifactGaps(item);
    if (gaps.length || !hasCompleteDocument(item)) {
      res.status(409).json({
        ok: false,
        error: INCOMPLETE_ARTIFACT_ERROR,
        missing: gaps
      });
      return;
    }

    const danger = ticketGuardReason({
      module: item.module,
      files: item.files,
      contents: req.body?.contents || item.contents
    });
    if (danger) {
      res.status(400).json({ ok: false, error: danger });
      return;
    }

    const skip = assertQueueHead(item, await store.queue());
    if (skip) {
      res.status(skip.status).json({ ok: false, error: skip.error });
      return;
    }

    const acquired = await store.tryAcquireLock(item);
    if (!acquired) {
      const latest = (await store.get(item.id)) || item;
      const lock = await store.getLock();
      if (latest.status === "publishing" || latest.status === "success") {
        res.json(alreadyPublishedPayload(latest));
        return;
      }
      if (lock && lock.locked && lock.current && lock.current.id === item.id) {
        res.json({
          ok: true,
          item: latest,
          version: latest.version,
          already: "publishing"
        });
        return;
      }
      res.status(409).json({ ok: false, error: "有发布正在进行，禁止抢发" });
      return;
    }

    await store.markPublishing(item);

    const runJob = async () => {
      try {
        return await runPublishJob(item);
      } catch (err) {
        const message = formatExecError(err);
        await store.markFailed(item, message);
        return { ok: false, error: message };
      } finally {
        await store.releaseLock();
      }
    };

    const willRestart = ticketNeedsProcessRestart(item);
    const defer = willRestart && restart === restartMengkaiService;
    if (defer) {
      res.json({
        ok: true,
        item,
        version: item.version
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
        version: item.version
      });
      return;
    }
    res.status(500).json({ ok: false, error: result.error, item, version: item.version });
  }

  async function sendBoardView(res, view, page, limit) {
    const payload = await readBoardView(store, view, page, limit, listed);
    if (!payload) {
      return false;
    }
    if (view === "history") {
      res.json(withCharter({ ok: true, ...payload, items: withSnapList(payload.items) }));
      return true;
    }
    res.json(withCharter({ ok: true, ...payload }));
    return true;
  }

  router.get("/", async (req, res) => {
    const view = String(req.query?.view || "");
    const page = Number(req.query?.page) || 1;
    const limit = Number(req.query?.limit) || 20;
    if (await sendBoardView(res, view, page, limit)) {
      return;
    }
    res.json(withCharter({ ok: true, items: withSnapList(await listed()) }));
  });

  router.get("/summary", async (_req, res) => {
    await sendBoardView(res, "summary", 1, 20);
  });

  router.get("/history", async (req, res) => {
    await sendBoardView(res, "history", Number(req.query?.page) || 1, Number(req.query?.limit) || 20);
  });

  router.get("/logs", async (req, res) => {
    await sendBoardView(res, "logs", Number(req.query?.page) || 1, Number(req.query?.limit) || 20);
  });

  router.get("/failed", async (req, res) => {
    await sendBoardView(res, "failed", Number(req.query?.page) || 1, Number(req.query?.limit) || 20);
  });

  router.get("/queue", async (_req, res) => {
    res.json(withCharter({ ok: true, items: await store.queue() }));
  });

  router.get("/item/:id", async (req, res) => {
    const item = await store.get(req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, error: "单据不存在" });
      return;
    }
    res.json(withCharter({ ok: true, item: withSnap(item) }));
  });

  router.get("/lock", async (_req, res) => {
    res.json(withCharter({ ok: true, ...(await store.getLock()) }));
  });

  router.get("/versions", async (_req, res) => {
    let rows = [];
    try {
      rows = typeof store.versionRows === "function" ? await store.versionRows() : (await listed()).map(slimVersionItem);
    } catch (err) {
      console.error("release versionRows failed", err);
      rows = (await listed()).map(slimVersionItem);
    }
    res.json(withCharter({ ok: true, ...listModuleVersions(withSnapList(rows)) }));
  });

  router.get("/next", async (req, res) => {
    const slug = req.query?.slug || req.query?.说明 || "next";
    res.json(withCharter({ ok: true, ...describeNextVersion(await listed(), slug) }));
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
    if (!parsed.complete) {
      res.status(400).json({
        ok: false,
        error: INCOMPLETE_ARTIFACT_ERROR,
        missing: parsed.missing
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
    const module = parsed.document.module;
    if (!MODULES.includes(module)) {
      res.status(400).json({ ok: false, error: "模块不在允许列表中" });
      return;
    }
    const danger = ticketGuardReason({
      module,
      files: parsed.document.files,
      contents: body.contents || body.blobs
    });
    if (danger) {
      res.status(400).json({ ok: false, error: danger });
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
      const buffers = normalizeContents(body.contents || body.blobs, files);
      await smokeCheckBuffers(buffers);
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
      if (err.code === "SMOKE_IMPORT_ERROR") {
        res.status(409).json({
          ok: false,
          error: `${INCOMPLETE_ARTIFACT_ERROR}${err.message || err}`,
          missing: files
        });
        return;
      }
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
    try {
      await smokeCheckSyntax(resolveSource(), files);
    } catch (err) {
      res.status(409).json({
        ok: false,
        error: `${INCOMPLETE_ARTIFACT_ERROR}${err.message || err}`,
        missing: files
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
      acceptance: parsed.document.acceptance,
      restart: parsed.document.restart,
      gitRef,
      repository
    });
    res.status(201).json({ ok: true, item, incomplete: false });
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

  router.post("/:id/return", async (req, res) => {
    let result;
    if (typeof store.returnFailed === "function") {
      result = await store.returnFailed(req.params.id);
    } else {
      result = returnFailedItem(await store.get(req.params.id));
      if (!result.error && result.item) {
        result.item = slimFailedItem(result.item);
      }
    }
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({
      ok: true,
      item: result.item,
      already: Boolean(result.already),
      dialog: result.dialog
    });
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
