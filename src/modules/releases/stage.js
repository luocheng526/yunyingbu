import fs from "node:fs";
import path from "node:path";
import { NOOP_APPLY_ERROR } from "./charter.js";
import { assertSafeRel, listedFilesUnchanged, liveRoot, sourceRoot } from "./push.js";
import { resolveGithubToken } from "./pipeline/github-artifact.js";

export const DEFAULT_GITHUB_REPO = "luocheng526/yunyingbu";
const MAX_FILE_BYTES = 1_500_000;
const REF_OK = /^[A-Za-z0-9._/+\-]{1,200}$/;
const REPO_OK = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function parseGitRef(body = {}) {
  return String(body.ref || body.gitRef || body.sha || body.branch || "").trim();
}

export function parseRepository(body = {}, env = process.env) {
  const raw = String(body.repository || env.MENGKAI_GITHUB_REPO || DEFAULT_GITHUB_REPO).trim();
  if (!REPO_OK.test(raw)) {
    throw Object.assign(new Error("repository 只允许 owner/repo"), { status: 400 });
  }
  return raw;
}

export function normalizeContents(input, files) {
  if (input == null || input === "") {
    return {};
  }
  const allowed = new Set((files || []).map(assertSafeRel));
  const raw = Array.isArray(input)
    ? Object.fromEntries(
        input.map((row) => [row?.path || row?.file, row?.content ?? row?.text])
      )
    : input;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw Object.assign(new Error("contents 须是路径到正文的对象"), { status: 400 });
  }
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const rel = assertSafeRel(key);
    if (!allowed.has(rel)) {
      throw Object.assign(new Error(`contents 含未交单路径: ${rel}`), { status: 400 });
    }
    let buf;
    if (value && typeof value === "object" && value.content != null) {
      const enc = String(value.encoding || "utf8").toLowerCase();
      buf = Buffer.from(String(value.content), enc === "base64" ? "base64" : "utf8");
    } else if (typeof value === "string") {
      buf = Buffer.from(value);
    } else {
      throw Object.assign(new Error(`contents ${rel} 须是字符串`), { status: 400 });
    }
    if (buf.length > MAX_FILE_BYTES) {
      throw Object.assign(new Error(`contents ${rel} 超过 ${MAX_FILE_BYTES} 字节`), { status: 400 });
    }
    out[rel] = buf;
  }
  return out;
}

function writeBuffer(source, rel, buf) {
  const dest = path.join(source, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

export async function fetchGithubFile(rel, options = {}) {
  const ref = String(options.ref || "").trim();
  if (!REF_OK.test(ref)) {
    throw Object.assign(new Error("ref 只允许提交号或分支名"), { status: 400 });
  }
  const repository = parseRepository({ repository: options.repository }, options.env);
  const token = options.token || resolveGithubToken(options.env || process.env);
  const fetchImpl = options.fetchImpl || fetch;
  const headers = {
    Accept: "application/vnd.github.raw",
    "User-Agent": "mengkai-release-gate"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const url = `https://api.github.com/repos/${repository}/contents/${rel}?ref=${encodeURIComponent(ref)}`;
  const res = await fetchImpl(url, { headers });
  if (!res.ok) {
    throw Object.assign(
      new Error(
        `GitHub 读不到 ${rel}@${ref}（${res.status}）。闸门不读 Cloud 工作区。请改带 contents，或先把文件写进源目录。`
      ),
      { status: 400, code: res.status }
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_FILE_BYTES) {
    throw Object.assign(new Error(`GitHub 文件 ${rel} 超过 ${MAX_FILE_BYTES} 字节`), { status: 400 });
  }
  return buf;
}

export async function stageTicketSources(files, options = {}) {
  const list = (files || []).map(assertSafeRel);
  const source = options.sourceRoot || sourceRoot(options.env);
  const contents = normalizeContents(options.contents, list);
  const ref = String(options.ref || "").trim();
  if (ref && !REF_OK.test(ref)) {
    throw Object.assign(new Error("ref 只允许提交号或分支名"), { status: 400 });
  }
  const notes = [];
  const written = [];
  for (const rel of list) {
    if (Object.prototype.hasOwnProperty.call(contents, rel)) {
      writeBuffer(source, rel, contents[rel]);
      written.push(rel);
      notes.push(`staged contents ${rel}`);
      continue;
    }
    if (ref) {
      const buf = await fetchGithubFile(rel, { ...options, ref });
      writeBuffer(source, rel, buf);
      written.push(rel);
      notes.push(`staged git ${rel}@${ref}`);
    }
  }
  return { written, notes, source, ref };
}

export function unchangedCreateError() {
  return NOOP_APPLY_ERROR;
}

export function shouldRejectUnchangedAtCreate(source, live) {
  return path.resolve(source) !== path.resolve(live);
}

export function sourceMatchesLive(files, source, live) {
  const list = files || [];
  if (!list.length) {
    return false;
  }
  return listedFilesUnchanged(source, live, list);
}

export function resolveStageRoots(options = {}) {
  const env = options.env || process.env;
  return {
    source: options.sourceRoot || sourceRoot(env),
    live: options.liveRoot || liveRoot(env)
  };
}
