import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PRODUCTION_BRANCH, RELEASE_MODE, BUILD_WORKFLOW_NAME, STATES } from "./constants.js";
import { verifyArtifactDir } from "./artifact.js";
import { downloadReleaseTriple, githubFactsFromWake, resolveGithubToken } from "./github-artifact.js";
import { verifySignature } from "./hmac.js";
import { createIngest } from "./ingest.js";
import { shadowInstall } from "./shadow.js";

function extraApproveFields(body) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return ["body"];
  }
  return Object.keys(body).filter((key) => body[key] !== undefined && body[key] !== null && body[key] !== "");
}

export function attachPipelineWebhook(router, options = {}) {
  const store = options.pipelineStore;
  const secret = options.webhookSecret || process.env.CONTROLLER_WEBHOOK_SECRET || "";
  const mode = options.releaseMode || RELEASE_MODE;
  const ingest = createIngest({ store, mode });

  router.post("/webhooks/github", async (req, res) => {
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    if (!secret || !verifySignature(secret, raw, req.get("x-hub-signature-256"))) {
      res.status(401).json({ ok: false, error: "HMAC 无效" });
      return;
    }
    const body = req.body || {};
    const run = body.workflow_run || {};
    const deliveryId = String(req.get("x-github-delivery") || `${run.id}-${run.run_attempt}-${body.action}`);
    const recorded = store.recordDelivery({
      deliveryId,
      repository: body.repository?.full_name,
      runId: run.id,
      attempt: run.run_attempt,
      event: run.event,
      headBranch: run.head_branch,
      conclusion: run.conclusion,
      workflow: run.name
    });
    if (recorded.duplicate) {
      res.status(202).json({ ok: true, duplicate: true });
      return;
    }
    if (
      body.action !== "completed" ||
      run.conclusion !== "success" ||
      run.event !== "push" ||
      run.head_branch !== PRODUCTION_BRANCH ||
      run.name !== BUILD_WORKFLOW_NAME
    ) {
      res.status(202).json({ ok: true, ignored: true });
      return;
    }
    const overlay = ingest.placeWakeOverlay(body, { actor: "github-wake" });
    const fetchArtifact = options.fetchReleaseArtifact;
    const token = options.githubToken || resolveGithubToken();
    if (!fetchArtifact && !token) {
      res.status(202).json({
        ok: true,
        accepted: true,
        state: overlay.state,
        overlay: true,
        item: overlay
      });
      return;
    }
    try {
      const dest = fs.mkdtempSync(path.join(os.tmpdir(), "rel-fetch-"));
      const artifactDir = fetchArtifact
        ? await fetchArtifact({ run, body, destDir: dest })
        : await downloadReleaseTriple({
            token,
            repository: body.repository.full_name,
            runId: run.id,
            destDir: dest
          });
      const verified = verifyArtifactDir(artifactDir);
      const github = githubFactsFromWake({
        run,
        repository: body.repository.full_name,
        manifest: verified.manifest
      });
      const item = ingest.ingestVerified({ github, artifactDir, actor: "github-wake" });
      res.status(202).json({
        ok: true,
        ingested: true,
        overlay: false,
        state: item.state,
        item
      });
    } catch (err) {
      res.status(202).json({
        ok: true,
        accepted: true,
        overlay: true,
        state: overlay.state,
        item: overlay,
        fetch_error: err.message || String(err)
      });
    }
  });
}

export function attachPipelineRoutes(router, options = {}) {
  const store = options.pipelineStore;
  const mode = options.releaseMode || RELEASE_MODE;
  const ingest = createIngest({ store, mode });

  router.get("/candidates", (_req, res) => {
    res.json({
      ok: true,
      release_mode: mode,
      items: store.list().map((row) => ingest.view(row))
    });
  });

  router.get("/candidates/:id", (req, res) => {
    const row = store.get(req.params.id);
    if (!row) {
      res.status(404).json({ ok: false, error: "候选不存在" });
      return;
    }
    res.json({ ok: true, item: ingest.view(row) });
  });

  router.post("/candidates/:id/approve", (req, res) => {
    const extra = extraApproveFields(req.body);
    if (extra.length) {
      res.status(400).json({ ok: false, error: "批准只允许空 body，禁止手填 SHA/路径/命令", extra });
      return;
    }
    const row = store.get(req.params.id);
    if (!row) {
      res.status(404).json({ ok: false, error: "候选不存在" });
      return;
    }
    const view = ingest.view(row);
    if (!view.can_approve) {
      res.status(409).json({
        ok: false,
        error: view.block_reason || "当前候选不可批准",
        item: view
      });
      return;
    }
    store.transition(row.id, STATES.approved, {
      actor: req.user?.username || req.user?.displayName || "publisher",
      reason: "发布人批准 candidate_id"
    });
    store.pushOutbox({ type: "deploy", candidateId: row.id, releaseId: row.releaseId });
    store.transition(row.id, STATES.deploy_queued, {
      actor: "controller",
      reason: "审批与部署 outbox 同一逻辑提交"
    });
    res.json({ ok: true, item: ingest.view(store.get(row.id)) });
  });

  router.post("/candidates/:id/dismiss", (req, res) => {
    const row = store.get(req.params.id);
    if (!row) {
      res.status(404).json({ ok: false, error: "候选不存在" });
      return;
    }
    if (row.state !== STATES.pending_approval) {
      res.status(409).json({ ok: false, error: "只允许移出待审批候选" });
      return;
    }
    store.transition(row.id, STATES.dismissed, {
      actor: req.user?.username || "publisher",
      reason: String(req.body?.reason || "dismiss")
    });
    res.json({ ok: true, item: ingest.view(store.get(row.id)) });
  });

  router.post("/ingress/local", (req, res) => {
    if (mode === "production" && !options.allowLocalIngress) {
      res.status(409).json({ ok: false, error: "production 禁止本地入库" });
      return;
    }
    try {
      const item = ingest.ingestVerified({
        github: req.body?.github,
        artifactDir: req.body?.artifactDir,
        actor: req.user?.username || "test"
      });
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || String(err) });
    }
  });

  router.post("/shadow-install", (req, res) => {
    const row = store.get(req.body?.candidate_id);
    if (!row) {
      res.status(404).json({ ok: false, error: "候选不存在" });
      return;
    }
    try {
      const result = shadowInstall(row.artifactDir);
      res.json({ ok: true, shadow: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message || String(err) });
    }
  });

  router.get("/readyz", (_req, res) => {
    res.json({
      ok: true,
      release_mode: mode,
      worker_ready: mode !== "production",
      deployment_ready: mode === "production",
      outbox: store.outbox().length
    });
  });
}
