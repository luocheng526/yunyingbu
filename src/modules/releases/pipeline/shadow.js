import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { verifyArtifactDir } from "./artifact.js";

/** Phase-1 shadow install: extract to an isolated directory. Never writes deploy outbox. */
export function shadowInstall(artifactDir) {
  const verified = verifyArtifactDir(artifactDir);
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "rel-shadow-"));
  const result = spawnSync("tar", ["-xzf", verified.archivePath, "-C", dest], { encoding: "utf8" });
  if (result.status !== 0) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw new Error(result.stderr || "shadow 解包失败");
  }
  return {
    dest,
    releaseId: verified.manifest.release_id,
    mergeSha: verified.manifest.merge_sha,
    artifactSha256: verified.artifactSha256,
    networked: false,
    deployOutbox: false
  };
}
