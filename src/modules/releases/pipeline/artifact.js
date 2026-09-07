import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ALLOWED_ROOTS, SCHEMA_VERSION } from "./constants.js";

export function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, Object.keys(value).sort ? undefined : null)}\n`;
}

function sortedStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(sortedStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function writeCanonicalJson(filePath, value) {
  const body = `${sortedStringify(value)}\n`;
  fs.writeFileSync(filePath, body, { flag: "wx" });
  return sha256Buffer(Buffer.from(body));
}

function isRejectedRel(rel) {
  if (!rel || rel.startsWith("/") || rel.includes("\\") || rel.includes("..")) {
    return true;
  }
  return !ALLOWED_ROOTS.some((root) => rel === root || rel.startsWith(`${root}/`));
}

export function listPayloadFiles(root) {
  const files = [];
  function walk(dir, relDir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`拒绝符号链接：${rel}`);
      }
      if (entry.isDirectory()) {
        if (rel === "node_modules" || rel === ".git" || rel === "test") {
          continue;
        }
        walk(full, rel);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`拒绝特殊文件：${rel}`);
      }
      if (isRejectedRel(rel)) {
        continue;
      }
      const st = fs.statSync(full);
      files.push({
        path: rel,
        size: st.size,
        mode: st.mode & 0o777,
        sha256: sha256File(full)
      });
    }
  }
  walk(root, "");
  files.sort((a, b) => a.path.localeCompare(b.path));
  const seen = new Set();
  for (const file of files) {
    const folded = file.path.toLowerCase();
    if (seen.has(folded)) {
      throw new Error(`路径大小写碰撞：${file.path}`);
    }
    seen.add(folded);
  }
  return files;
}

function runTar(args, cwd) {
  const result = spawnSync("tar", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "tar failed");
  }
  return result;
}

export function packArtifact({
  sourceRoot,
  outDir,
  identity
}) {
  fs.mkdirSync(outDir, { recursive: true });
  const files = listPayloadFiles(sourceRoot);
  const listFile = path.join(outDir, "members.txt");
  fs.writeFileSync(listFile, files.map((f) => f.path).join("\n") + (files.length ? "\n" : ""), { flag: "wx" });
  const archivePath = path.join(outDir, "artifact.tar.gz");
  runTar(
    [
      "--sort=name",
      "--mtime=UTC 1970-01-01",
      "--owner=0",
      "--group=0",
      "--numeric-owner",
      "--no-recursion",
      "-czf",
      archivePath,
      "-T",
      listFile
    ],
    sourceRoot
  );
  const payloadSha = sha256File(archivePath);
  const payloadBytes = fs.statSync(archivePath).size;
  const manifest = {
    schema_version: SCHEMA_VERSION,
    release_id: identity.releaseId,
    profile: identity.profile,
    version: identity.version,
    repository: identity.repository,
    branch: identity.branch,
    pr_number: identity.prNumber,
    source_sha: identity.sourceSha,
    merge_sha: identity.mergeSha,
    tree_sha: identity.treeSha,
    ci_workflow: identity.ciWorkflow,
    ci_run_id: identity.ciRunId,
    ci_run_attempt: identity.ciRunAttempt,
    payload_file_count: files.length,
    payload_total_bytes: files.reduce((sum, f) => sum + f.size, 0),
    payload_sha256: payloadSha,
    artifact_sha256: payloadSha,
    files,
    dependencies: [
      {
        name: "package-lock.json",
        path: "package-lock.json",
        version: identity.version,
        size: files.find((f) => f.path === "package-lock.json")?.size || 0,
        sha256: files.find((f) => f.path === "package-lock.json")?.sha256 || ""
      }
    ].filter((row) => row.sha256),
    migrations: []
  };
  const manifestPath = path.join(outDir, "artifact.manifest.json");
  const manifestSha = writeCanonicalJson(manifestPath, manifest);
  manifest.manifest_sha256 = manifestSha;
  fs.unlinkSync(manifestPath);
  writeCanonicalJson(manifestPath, manifest);
  const sidecar = path.join(outDir, "artifact.sha256");
  fs.writeFileSync(sidecar, `${payloadSha}  artifact.tar.gz\n`, { flag: "wx" });
  return verifyArtifactDir(outDir);
}

export function verifyArtifactDir(dir) {
  const archivePath = path.join(dir, "artifact.tar.gz");
  const manifestPath = path.join(dir, "artifact.manifest.json");
  const sidecarPath = path.join(dir, "artifact.sha256");
  for (const file of [archivePath, manifestPath, sidecarPath]) {
    if (!fs.existsSync(file)) {
      throw new Error(`缺少制品文件：${path.basename(file)}`);
    }
  }
  const archive = fs.readFileSync(archivePath);
  const actual = sha256Buffer(archive);
  const sidecar = fs.readFileSync(sidecarPath, "utf8").trim();
  const [digest, name] = sidecar.split(/\s+/);
  if (name !== "artifact.tar.gz" || digest !== actual) {
    throw new Error("artifact.sha256 与归档不一致");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.artifact_sha256 !== actual || manifest.payload_sha256 !== actual) {
    throw new Error("manifest 中的归档哈希不匹配");
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rel-verify-"));
  try {
    runTar(["-xzf", archivePath, "-C", tmp]);
    for (const file of manifest.files) {
      if (isRejectedRel(file.path)) {
        throw new Error(`manifest 含非法路径：${file.path}`);
      }
      const full = path.join(tmp, file.path);
      if (!fs.existsSync(full)) {
        throw new Error(`归档缺少 ${file.path}`);
      }
      if (sha256File(full) !== file.sha256) {
        throw new Error(`文件哈希不匹配：${file.path}`);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { manifest, archivePath, manifestPath, sidecarPath, artifactSha256: actual };
}
