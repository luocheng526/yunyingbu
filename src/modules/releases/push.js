import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const ALLOWED_TOP = new Set(["public", "src", "package.json", "package-lock.json"]);

export function liveRoot(env = process.env) {
  const fromEnv = String(env.MENGKAI_LIVE_ROOT || "").trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  if (fs.existsSync(path.join("/opt/mengkai", "src"))) {
    return "/opt/mengkai";
  }
  return process.cwd();
}

export function sourceRoot(env = process.env) {
  const candidates = [
    String(env.MENGKAI_SOURCE_DIR || "").trim(),
    "/opt/yunyingbu/apps/xingmai",
    "/opt/yunyingbu",
    path.join(repoRoot, "apps/xingmai"),
    repoRoot,
    process.cwd()
  ].filter(Boolean);
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (fs.existsSync(path.join(resolved, "src")) || fs.existsSync(path.join(resolved, "package.json"))) {
      return resolved;
    }
  }
  return repoRoot;
}

/** @deprecated 进程已在 ECS 上运行，不再依赖 Cloud 仓库里的 SSH 脚本。 */
export function xingmaiRoot() {
  return sourceRoot();
}

/** @deprecated 缺脚本不得再 ENOENT；本机落地走 Node 拷贝。 */
export function pushScriptPath() {
  return path.join(repoRoot, "deploy/scripts/push-xingmai-to-ecs.sh");
}

export function assertSafeRel(rel) {
  const normalized = String(rel || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(String(rel || ""))) {
    throw Object.assign(new Error(`拒绝推送路径: ${rel}`), { stderr: `拒绝推送路径: ${rel}` });
  }
  const top = normalized.split("/")[0];
  if (!ALLOWED_TOP.has(top)) {
    throw Object.assign(new Error(`拒绝推送路径: ${rel}`), { stderr: `拒绝推送路径: ${rel}` });
  }
  return normalized;
}

function shouldPull(source, env) {
  if (env.MENGKAI_SKIP_PULL === "1") {
    return false;
  }
  if (env.MENGKAI_GIT_PULL === "1") {
    return true;
  }
  return source === "/opt/mengkai" || source.startsWith("/opt/mengkai/") || source === "/opt/yunyingbu" || source.startsWith("/opt/yunyingbu/");
}

async function pullSource(dir) {
  if (!fs.existsSync(path.join(dir, ".git"))) {
    return { pulled: false, stdout: "源目录不是 git 仓库，跳过 pull" };
  }
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", dir, "pull", "--ff-only"], {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024
    });
    return { pulled: true, stdout: stdout || "", stderr: stderr || "" };
  } catch (err) {
    const stderr = String(err.stderr || err.message || err);
    throw Object.assign(new Error(`git pull 失败：${stderr}`), {
      code: err.code,
      stderr,
      stdout: String(err.stdout || "")
    });
  }
}

function copyRel(fromRoot, toRoot, rel) {
  const src = path.join(fromRoot, rel);
  const dest = path.join(toRoot, rel);
  if (!fs.existsSync(src)) {
    throw Object.assign(new Error(`源目录不存在: ${rel}（${src}）`), {
      code: "ENOENT",
      stderr: `源目录不存在: ${rel}（${src}）`
    });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

export function snapshotExisting(live, rels, dest) {
  if (!dest) {
    return { files: [] };
  }
  fs.mkdirSync(dest, { recursive: true });
  const saved = [];
  for (const rel of rels) {
    const src = path.join(live, rel);
    if (fs.existsSync(src)) {
      copyRel(live, dest, rel);
      saved.push(rel);
    }
  }
  fs.writeFileSync(path.join(dest, "manifest.json"), `${JSON.stringify({ files: saved, at: new Date().toISOString() })}\n`);
  return { files: saved };
}

export const FULL_TREE = ["public", "src", "package.json", "package-lock.json"];

export function pathsToSnapshot(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  return list.length ? list.map(assertSafeRel) : FULL_TREE.slice();
}

export function restoreSnapshot(snapshotDir, live, rels) {
  const dest = live || liveRoot();
  if (!snapshotDir || !fs.existsSync(snapshotDir)) {
    throw Object.assign(new Error("没有可回滚快照"), { stderr: `没有可回滚快照：${snapshotDir || ""}` });
  }
  let list = Array.isArray(rels) ? rels.filter(Boolean) : [];
  if (!list.length) {
    try {
      const man = JSON.parse(fs.readFileSync(path.join(snapshotDir, "manifest.json"), "utf8"));
      list = Array.isArray(man.files) ? man.files : [];
    } catch {
      list = [];
    }
  }
  if (!list.length) {
    list = FULL_TREE.slice();
  }
  const notes = [];
  for (const rel of list) {
    const src = path.join(snapshotDir, rel);
    if (!fs.existsSync(src)) {
      notes.push(`快照无 ${rel}，跳过`);
      continue;
    }
    copyRel(snapshotDir, dest, rel);
    notes.push(`restored ${rel}`);
  }
  if (!notes.some((line) => line.startsWith("restored "))) {
    throw Object.assign(new Error("快照是空的，拒绝回滚"), { stderr: "快照是空的，拒绝回滚" });
  }
  return { stdout: notes.join("\n"), stderr: "" };
}

function copyTree(fromRoot, toRoot) {
  for (const rel of FULL_TREE) {
    if (fs.existsSync(path.join(fromRoot, rel))) {
      copyRel(fromRoot, toRoot, rel);
    }
  }
}

/**
 * 进程已在 8.140.33.133 的 /opt/mengkai。
 * 不 spawn 缺失的 push-xingmai-to-ecs.sh，改为本机从源目录拷到 live（排除 node_modules）。
 */
export async function pushXingmaiToEcs(files, options = {}) {
  const env = options.env || process.env;
  const live = options.liveRoot || liveRoot(env);
  const source = options.sourceRoot || sourceRoot(env);
  const list = Array.isArray(files) ? files.filter(Boolean).map(assertSafeRel) : [];
  const notes = [`本机落地 live=${live} source=${source}`];

  let pulled = { pulled: false, stdout: "" };
  if (shouldPull(source, env)) {
    pulled = await pullSource(source);
    notes.push(String(pulled.stdout || pulled.stderr || "").trim() || (pulled.pulled ? "git pull --ff-only 完成" : "跳过 pull"));
  } else {
    notes.push("未对 Cloud 工作区执行 git pull");
  }

  if (path.resolve(source) === path.resolve(live) && !pulled.pulled && env.MENGKAI_ALLOW_SAME_TREE !== "1") {
    throw Object.assign(
      new Error("源目录与 live 相同且未 git pull。请设置 MENGKAI_SOURCE_DIR 指向已 clone 的 yunyingbu，或让 /opt/mengkai 成为可 ff-only pull 的 git 目录。"),
      {
        stderr:
          "源目录与 live 相同且未 git pull。禁止空转。MENGKAI_SOURCE_DIR 或 MENGKAI_GIT_PULL=1。"
      }
    );
  }

  const snapRel = pathsToSnapshot(list);
  if (options.snapshotDir) {
    const saved = snapshotExisting(live, snapRel, options.snapshotDir);
    notes.push(`升级前快照 ${saved.files.length} 个路径 -> ${options.snapshotDir}`);
  }

  if (!list.length) {
    copyTree(source, live);
    notes.push("全量同步 public/src/package.json（排除 node_modules，未走 SSH）");
  } else {
    for (const rel of list) {
      copyRel(source, live, rel);
      notes.push(`copied ${rel} -> ${path.join(live, rel)}`);
    }
  }

  return {
    stdout: `${notes.join("\n")}\n本机落地完成（未重启）`,
    stderr: "",
    cwd: live,
    fullSync: list.length === 0
  };
}

export function formatExecError(err) {
  const code = err?.code != null ? String(err.code) : "";
  const stderr = String(err?.stderr || "").trim();
  const stdout = String(err?.stdout || "").trim();
  return [
    `发版失败：${err?.message || err}`,
    code ? `code=${code}` : "",
    stderr ? `stderr: ${stderr}` : "",
    stdout ? `stdout: ${stdout}` : "",
    "已释放发布锁。"
  ]
    .filter(Boolean)
    .join(" ");
}
