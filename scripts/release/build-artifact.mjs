#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packArtifact } from "../../src/modules/releases/pipeline/artifact.js";
import { PRODUCTION_BRANCH, RELEASE_PROFILE, BUILD_WORKFLOW_FILE } from "../../src/modules/releases/pipeline/constants.js";
import { makeReleaseId } from "../../src/modules/releases/pipeline/ids.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const mergeSha = process.env.GITHUB_SHA;
const runId = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";
const repository = process.env.GITHUB_REPOSITORY;
const sourceSha = process.env.RELEASE_SOURCE_SHA || mergeSha;
const treeSha = process.env.RELEASE_TREE_SHA || mergeSha;
const prNumber = Number(process.env.RELEASE_PR_NUMBER || "0");

if (!mergeSha || !runId || !repository) {
  console.error("GITHUB_SHA / GITHUB_RUN_ID / GITHUB_REPOSITORY required");
  process.exit(1);
}
if (!prNumber) {
  console.error("RELEASE_PR_NUMBER required; refuse to guess the merged PR");
  process.exit(1);
}

const releaseId = makeReleaseId({
  profile: RELEASE_PROFILE,
  version: pkg.version,
  mergeSha,
  runId,
  attempt
});
const outDir = path.join(repoRoot, "dist", "release");
fs.rmSync(outDir, { recursive: true, force: true });
const packed = packArtifact({
  sourceRoot: repoRoot,
  outDir,
  identity: {
    releaseId,
    profile: RELEASE_PROFILE,
    version: pkg.version,
    repository,
    branch: PRODUCTION_BRANCH,
    prNumber,
    sourceSha,
    mergeSha,
    treeSha,
    ciWorkflow: BUILD_WORKFLOW_FILE,
    ciRunId: Number(runId),
    ciRunAttempt: Number(attempt)
  }
});
console.log(JSON.stringify({ ok: true, release_id: packed.manifest.release_id, artifact_sha256: packed.artifactSha256 }, null, 2));
