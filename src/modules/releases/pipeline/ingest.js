import { PRODUCTION_BRANCH, RELEASE_MODE, STATES } from "./constants.js";
import { candidateIdFromKey, candidateKey, makeReleaseId, overlayIdFromRun } from "./ids.js";
import { verifyArtifactDir } from "./artifact.js";
import { applyTransition } from "./machine.js";

function publicCandidate(row, mode) {
  const shadow = mode === "shadow" || mode === "connected-shadow";
  const real = Boolean(row.id && row.state);
  const overlay = Boolean(row.overlay);
  const canApprove =
    real &&
    !overlay &&
    row.state === STATES.pending_approval &&
    !row.dirty &&
    !row.blockReason &&
    !shadow;
  return {
    ...row,
    overlay: overlay || false,
    can_approve: canApprove,
    dirty: Boolean(row.dirty),
    block_reason: row.blockReason || (shadow && row.state === STATES.pending_approval ? "shadow 模式禁止部署" : null),
    release_mode: mode
  };
}

export function createIngest({ store, mode = RELEASE_MODE }) {
  function ingestVerified({ github, artifactDir, actor = "controller" }) {
    if (!github || github.event !== "push" || github.headBranch !== PRODUCTION_BRANCH) {
      throw new Error("只接受生产主支 push 的成功构建");
    }
    if (github.conclusion !== "success" || github.status !== "completed") {
      throw new Error("构建尚未成功完成");
    }
    if (!github.prNumber || !github.sourceSha || !github.mergeSha || !github.treeSha) {
      throw new Error("无法唯一映射已合并 PR / merge SHA / tree SHA");
    }
    const verified = verifyArtifactDir(artifactDir);
    const manifest = verified.manifest;
    if (manifest.merge_sha !== github.mergeSha || manifest.source_sha !== github.sourceSha) {
      throw new Error("manifest SHA 与 GitHub 事实不一致");
    }
    if (Number(manifest.ci_run_id) !== Number(github.runId) || Number(manifest.ci_run_attempt) !== Number(github.runAttempt)) {
      throw new Error("manifest CI 身份与 run 不一致");
    }
    const releaseId = makeReleaseId({
      profile: manifest.profile,
      version: manifest.version,
      mergeSha: github.mergeSha,
      runId: github.runId,
      attempt: github.runAttempt
    });
    if (manifest.release_id !== releaseId) {
      throw new Error("release_id 与锁定身份不一致");
    }
    const key = candidateKey({
      repository: github.repository,
      prNumber: github.prNumber,
      sourceSha: github.sourceSha,
      releaseId
    });
    const id = candidateIdFromKey(key);
    const now = new Date().toISOString();
    const existing = store.get(id);
    if (existing) {
      return publicCandidate(existing, mode);
    }
    store.consumeOverlay({ ciRunId: github.runId, ciRunAttempt: github.runAttempt });
    const row = {
      id,
      candidateKey: key,
      overlay: false,
      dirty: false,
      blockReason: null,
      state: STATES.received,
      transitions: [],
      releaseId,
      version: manifest.version,
      profile: manifest.profile,
      repository: github.repository,
      branch: github.headBranch,
      prNumber: github.prNumber,
      sourceSha: github.sourceSha,
      mergeSha: github.mergeSha,
      treeSha: github.treeSha,
      ciWorkflow: github.workflow,
      ciRunId: github.runId,
      ciRunAttempt: github.runAttempt,
      artifactSha256: verified.artifactSha256,
      manifestSha256: manifest.manifest_sha256,
      artifactDir,
      createdAt: now,
      updatedAt: now
    };
    applyTransition(row, STATES.waiting_ci, { actor, reason: "已接收可信 run", now });
    applyTransition(row, STATES.artifact_ready, { actor, reason: "制品三件套已校验", now });
    applyTransition(row, STATES.pending_approval, { actor, reason: "进入待上线", now });
    store.insertCandidate(row);
    store.supersedeOlder({
      repository: github.repository,
      prNumber: github.prNumber,
      mergeSha: github.mergeSha,
      actor
    });
    return publicCandidate(row, mode);
  }

  function placeWakeOverlay(body, { actor = "github-wake", now } = {}) {
    const run = body?.workflow_run || {};
    const repository = body?.repository?.full_name;
    if (!repository || !run.id) {
      throw new Error("wake 缺少 repository / workflow_run.id");
    }
    const id = overlayIdFromRun({
      repository,
      runId: run.id,
      attempt: run.run_attempt || 1
    });
    const existing = store.get(id);
    if (existing) {
      return publicCandidate(existing, mode);
    }
    const stamp = now || new Date().toISOString();
    const prNumber = Number(run.pull_requests?.[0]?.number || 0);
    const row = {
      id,
      candidateKey: `overlay|${repository}|${run.id}|${run.run_attempt || 1}`,
      overlay: true,
      dirty: false,
      blockReason: "等待制品入库",
      state: STATES.received,
      transitions: [],
      releaseId: `pending-run${run.id}-${run.run_attempt || 1}`,
      version: "(pending)",
      profile: "mengkai",
      repository,
      branch: run.head_branch || PRODUCTION_BRANCH,
      prNumber,
      sourceSha: null,
      mergeSha: run.head_sha || null,
      treeSha: run.head_sha || null,
      ciWorkflow: run.name,
      ciRunId: run.id,
      ciRunAttempt: run.run_attempt || 1,
      artifactSha256: null,
      manifestSha256: null,
      artifactDir: null,
      createdAt: stamp,
      updatedAt: stamp
    };
    applyTransition(row, STATES.waiting_ci, { actor, reason: "GitHub wake 已接收，等待制品入库", now: stamp });
    store.insertCandidate(row);
    return publicCandidate(row, mode);
  }

  return {
    ingestVerified,
    placeWakeOverlay,
    view(row) {
      return publicCandidate(row, mode);
    }
  };
}
