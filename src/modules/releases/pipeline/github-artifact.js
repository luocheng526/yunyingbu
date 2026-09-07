import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const RELEASE_TRIPLE_NAME = "release-triple";

export function resolveGithubToken(env = process.env) {
  return String(env.RELEASE_GITHUB_TOKEN || env.GITHUB_TOKEN || "");
}

export function githubFactsFromWake({ run, repository, manifest }) {
  if (run?.head_sha && manifest.merge_sha && run.head_sha !== manifest.merge_sha) {
    throw new Error("workflow_run.head_sha 与 manifest.merge_sha 不一致");
  }
  return {
    event: run.event,
    headBranch: run.head_branch,
    conclusion: run.conclusion,
    status: run.status || "completed",
    repository,
    prNumber: manifest.pr_number,
    sourceSha: manifest.source_sha,
    mergeSha: manifest.merge_sha,
    treeSha: manifest.tree_sha,
    runId: run.id,
    runAttempt: run.run_attempt,
    workflow: manifest.ci_workflow
  };
}

function unzip(zipPath, dest) {
  const result = spawnSync("unzip", ["-o", zipPath, "-d", dest], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "unzip 失败");
  }
}

export function findTripleDir(root) {
  const names = ["artifact.tar.gz", "artifact.manifest.json", "artifact.sha256"];
  if (names.every((name) => fs.existsSync(path.join(root, name)))) {
    return root;
  }
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const nested = path.join(root, entry.name);
    if (names.every((name) => fs.existsSync(path.join(nested, name)))) {
      return nested;
    }
  }
  throw new Error("解压结果里没有制品三件套");
}

export async function downloadReleaseTriple({
  token,
  repository,
  runId,
  destDir,
  fetchImpl = fetch
}) {
  if (!token) {
    throw new Error("缺少 GitHub token，无法拉取制品");
  }
  const [owner, repo] = String(repository || "").split("/");
  if (!owner || !repo || !runId) {
    throw new Error("缺少 repository / runId");
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mengkai-release-controller"
  };
  const listRes = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
    { headers }
  );
  if (!listRes.ok) {
    throw new Error(`列举制品失败 ${listRes.status}`);
  }
  const list = await listRes.json();
  const art = (list.artifacts || []).find((row) => row.name === RELEASE_TRIPLE_NAME && !row.expired);
  if (!art) {
    throw new Error("没有未过期的 release-triple 制品");
  }
  const zipRes = await fetchImpl(art.archive_download_url, { headers, redirect: "follow" });
  if (!zipRes.ok) {
    throw new Error(`下载制品失败 ${zipRes.status}`);
  }
  const dest = destDir || fs.mkdtempSync(path.join(os.tmpdir(), "rel-gh-"));
  fs.mkdirSync(dest, { recursive: true });
  const zipPath = path.join(dest, "release-triple.zip");
  fs.writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));
  const unpacked = path.join(dest, "unpacked");
  fs.mkdirSync(unpacked, { recursive: true });
  unzip(zipPath, unpacked);
  return findTripleDir(unpacked);
}
