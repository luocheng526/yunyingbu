import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { NOOP_APPLY_ERROR } from "./charter.js";
import { smokeLoadLive, srcJsFiles } from "./smoke.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const ALLOWED_TOP = new Set(["public", "src", "test", "package.json", "package-lock.json"]);

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
  const explicit = String(env.MENGKAI_SOURCE_DIR || "").trim();
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (!fs.existsSync(resolved)) {
      throw Object.assign(new Error(`MENGKAI_SOURCE_DIR 不存在: ${resolved}`), {
        stderr: `MENGKAI_SOURCE_DIR 不存在: ${resolved}`
      });
    }
    return resolved;
  }
  const candidates = [repoRoot, process.cwd()].filter(Boolean);
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (
      fs.existsSync(path.join(resolved, "public", "releases.html")) ||
      fs.existsSync(path.join(resolved, "src", "modules", "releases"))
    ) {
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

export function applyReceiptPath(snapshotDir) {
  return snapshotDir ? path.join(snapshotDir, "apply-receipt.json") : "";
}

export function writeApplyReceipt(snapshotDir, payload = {}) {
  if (!snapshotDir) {
    return "";
  }
  fs.mkdirSync(snapshotDir, { recursive: true });
  const file = applyReceiptPath(snapshotDir);
  fs.writeFileSync(file, `${JSON.stringify({ ok: true, ...payload, at: new Date().toISOString() })}\n`);
  return file;
}

export function hasApplyReceipt(snapshotDir) {
  return Boolean(snapshotDir && fs.existsSync(applyReceiptPath(snapshotDir)));
}

export function rolledBackMarkerPath(snapshotDir) {
  return snapshotDir ? path.join(snapshotDir, "rolled-back.json") : "";
}

export function markSnapshotRolledBack(snapshotDir) {
  if (!snapshotDir) {
    return "";
  }
  fs.mkdirSync(snapshotDir, { recursive: true });
  const file = rolledBackMarkerPath(snapshotDir);
  fs.writeFileSync(file, `${JSON.stringify({ ok: true, at: new Date().toISOString() })}\n`);
  return file;
}

export function resolveTicketSnapshotDir(item, stateDir) {
  if (item?.snapshotDir && fs.existsSync(item.snapshotDir)) {
    return item.snapshotDir;
  }
  const id = String(item?.id || "").trim();
  const root = String(stateDir || "").trim();
  if (!id || !root) {
    return item?.snapshotDir || "";
  }
  const guessed = path.join(root, "snapshots", id);
  return fs.existsSync(guessed) ? guessed : item?.snapshotDir || "";
}

export function attachRollbackMeta(item, stateDir) {
  if (!item) {
    return item;
  }
  item.snapshotDir = resolveTicketSnapshotDir(item, stateDir);
  item.rolledBack = Boolean(item.rolledBack) || Boolean(
    item.snapshotDir && fs.existsSync(rolledBackMarkerPath(item.snapshotDir))
  );
  return item;
}

function sameEntry(left, right) {
  if (!fs.existsSync(left) || !fs.existsSync(right)) {
    return false;
  }
  const a = fs.statSync(left);
  const b = fs.statSync(right);
  if (a.isDirectory() && b.isDirectory()) {
    const names = new Set([...fs.readdirSync(left), ...fs.readdirSync(right)]);
    return [...names].every((name) => sameEntry(path.join(left, name), path.join(right, name)));
  }
  if (a.isFile() && b.isFile()) {
    return fs.readFileSync(left).equals(fs.readFileSync(right));
  }
  return false;
}

export function listMissingSourceFiles(files, source) {
  const root = source || sourceRoot();
  return (files || [])
    .map((rel) => {
      try {
        return assertSafeRel(rel);
      } catch {
        return String(rel || "");
      }
    })
    .filter((rel) => rel && !fs.existsSync(path.join(root, rel)));
}

export function listedFilesUnchanged(source, live, files) {
  const list = (files || []).map(assertSafeRel);
  if (!list.length) {
    return false;
  }
  return list.every((rel) => sameEntry(path.join(source, rel), path.join(live, rel)));
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
  if (path.resolve(live) === "/opt/mengkai" && !String(env.MENGKAI_SOURCE_DIR || "").trim() && !options.sourceRoot) {
    throw Object.assign(new Error("生产环境必须设置 MENGKAI_SOURCE_DIR，禁止猜源目录"), {
      stderr: "生产环境必须设置 MENGKAI_SOURCE_DIR，禁止猜源目录"
    });
  }
  const list = Array.isArray(files) ? files.filter(Boolean).map(assertSafeRel) : [];
  const notes = [`本机落地 live=${live} source=${source}`];

  let pulled = { pulled: false, stdout: "" };
  if (shouldPull(source, env)) {
    pulled = await pullSource(source);
    notes.push(String(pulled.stdout || pulled.stderr || "").trim() || (pulled.pulled ? "git pull --ff-only 完成" : "跳过 pull"));
  } else {
    notes.push(
      "未对 Cloud 工作区执行 git pull。源目录若不是 git 仓库，请在交单里带 contents 或 ref，闸门才会把 GitHub 字节写入源目录。"
    );
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

  const missing = listMissingSourceFiles(list, source);
  if (missing.length) {
    throw Object.assign(new Error(`源目录不存在: ${missing.join("、")}`), {
      code: "ENOENT",
      stderr: `源目录不存在: ${missing.join("、")}`
    });
  }
  if (list.length && listedFilesUnchanged(source, live, list)) {
    throw Object.assign(new Error(NOOP_APPLY_ERROR), { stderr: NOOP_APPLY_ERROR });
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

  if (list.length && !listedFilesUnchanged(source, live, list)) {
    throw Object.assign(new Error("落地后线上文件与源目录不一致"), {
      stderr: "落地后线上文件与源目录不一致"
    });
  }
  if (srcJsFiles(list).length) {
    try {
      const smoke = await smokeLoadLive(live, list);
      notes.push(
        smoke.skipped
          ? "无 src JS，跳过重启前试载"
          : `重启前试载通过 ${smoke.imported.length} 个模块`
      );
    } catch (err) {
      if (options.snapshotDir) {
        restoreSnapshot(options.snapshotDir, live, snapRel);
        notes.push("试载失败，已按快照收回线上文件");
      }
      const detail = String(err?.stderr || err?.message || err).trim();
      throw Object.assign(err instanceof Error ? err : new Error(detail), {
        stderr: detail,
        stdout: `${notes.join("\n")}\n${detail}`
      });
    }
  }
  if (options.snapshotDir) {
    writeApplyReceipt(options.snapshotDir, { files: list, live, source });
    notes.push(`落地回执 ${applyReceiptPath(options.snapshotDir)}`);
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
