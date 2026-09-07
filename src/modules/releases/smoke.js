import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { SMOKE_FAIL_ERROR } from "./charter.js";

const execFileAsync = promisify(execFile);

/** Files that start the HTTP server on import. Syntax-check only. */
export const SMOKE_SKIP_EVAL = new Set(["src/server.js"]);

const RELATIVE_SPEC = /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g;

export function srcJsFiles(files) {
  return (Array.isArray(files) ? files : [])
    .map((rel) => String(rel || "").replaceAll("\\", "/").replace(/^\/+/, ""))
    .filter((rel) => rel.startsWith("src/") && rel.endsWith(".js"));
}

function walkJs(dir) {
  if (!dir || !fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJs(full));
    } else if (entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

function resolveSpecifier(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return path.normalize(base);
  }
  if (fs.existsSync(`${base}.js`)) {
    return path.normalize(`${base}.js`);
  }
  const indexJs = path.join(base, "index.js");
  if (fs.existsSync(indexJs)) {
    return path.normalize(indexJs);
  }
  return path.normalize(base.endsWith(".js") ? base : `${base}.js`);
}

function fileImportsAbs(fromFile, targetAbs) {
  let text = "";
  try {
    text = fs.readFileSync(fromFile, "utf8");
  } catch {
    return false;
  }
  const want = path.normalize(targetAbs);
  RELATIVE_SPEC.lastIndex = 0;
  let match = RELATIVE_SPEC.exec(text);
  while (match) {
    if (resolveSpecifier(fromFile, match[1]) === want) {
      return true;
    }
    match = RELATIVE_SPEC.exec(text);
  }
  return false;
}

/** Changed src/*.js plus other live src files that import them. */
export function collectSmokeImports(live, files) {
  const changed = srcJsFiles(files);
  if (!changed.length || !live) {
    return [];
  }
  const wanted = new Set(changed);
  const changedAbs = changed.map((rel) => path.normalize(path.join(live, rel)));
  for (const abs of walkJs(path.join(live, "src"))) {
    const rel = path.relative(live, abs).replaceAll("\\", "/");
    if (wanted.has(rel)) {
      continue;
    }
    if (changedAbs.some((target) => fileImportsAbs(abs, target))) {
      wanted.add(rel);
    }
  }
  return [...wanted];
}

function firstUsefulLine(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const prefer = lines.find((line) =>
    /does not provide an export|SyntaxError|Cannot find module|ERR_|试载失败/.test(line)
  );
  if (prefer) {
    return prefer;
  }
  return lines.find((line) => !line.startsWith("(node:") && !line.startsWith("file://") && !/^at\s/.test(line)) || "";
}

function smokeError(detail) {
  const stderr = `${SMOKE_FAIL_ERROR}\n${String(detail || "").trim()}`.trim();
  const hint = firstUsefulLine(detail);
  return Object.assign(new Error(hint ? `${SMOKE_FAIL_ERROR}${hint}` : SMOKE_FAIL_ERROR), {
    stderr,
    code: "SMOKE_IMPORT_ERROR"
  });
}

/** Always parse as ESM. `node --check file.js` is CJS unless package.json says type:module. */
export async function smokeCheckText(rel, source) {
  try {
    await execFileAsync(process.execPath, ["--input-type=module", "--check"], {
      timeout: 8000,
      maxBuffer: 1_000_000,
      input: Buffer.isBuffer(source) ? source : Buffer.from(String(source ?? ""))
    });
  } catch (err) {
    const detail = String(err.stderr || err.message || err);
    throw smokeError(`${rel}: ${firstUsefulLine(detail) || detail}`);
  }
}

async function checkSyntax(root, rel) {
  const file = path.join(root, rel);
  if (!file || !fs.existsSync(file)) {
    throw smokeError(`${rel} 不存在，无法做语法检查`);
  }
  await smokeCheckText(rel, fs.readFileSync(file));
}

export async function smokeCheckBuffers(buffers) {
  const rels = srcJsFiles(Object.keys(buffers || {}));
  for (const rel of rels) {
    const buf = buffers[rel];
    if (buf == null) {
      throw smokeError(`${rel} 没有正文，无法做语法检查`);
    }
    await smokeCheckText(rel, buf);
  }
  return { ok: true, checked: rels };
}

async function importModules(live, rels) {
  const script = `
import { pathToFileURL } from "node:url";
import path from "node:path";
const live = process.env.MENGKAI_SMOKE_LIVE;
const files = JSON.parse(process.env.MENGKAI_SMOKE_FILES || "[]");
for (const rel of files) {
  await import(pathToFileURL(path.join(live, rel)).href);
}
console.log("SMOKE_OK");
`;
  try {
    const result = await execFileAsync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: live,
      timeout: 15000,
      maxBuffer: 2_000_000,
      env: {
        ...process.env,
        MENGKAI_SMOKE_LIVE: live,
        MENGKAI_SMOKE_FILES: JSON.stringify(rels)
      }
    });
    if (!String(result.stdout || "").includes("SMOKE_OK")) {
      throw smokeError(result.stderr || "试载没有返回 SMOKE_OK");
    }
  } catch (err) {
    if (err.code === "SMOKE_IMPORT_ERROR") {
      throw err;
    }
    throw smokeError(err.stderr || err.message || err);
  }
}

/** Syntax-check staged src/*.js before the ticket may enter the queue. */
export async function smokeCheckSyntax(root, files) {
  const changed = srcJsFiles(files);
  if (!changed.length) {
    return { ok: true, skipped: true, checked: [] };
  }
  for (const rel of changed) {
    await checkSyntax(root, rel);
  }
  return { ok: true, skipped: false, checked: changed };
}

/** Load the new src graph in a child process before systemd restart. */
export async function smokeLoadLive(live, files) {
  const changed = srcJsFiles(files);
  if (!changed.length) {
    return { ok: true, skipped: true, imported: [] };
  }
  await smokeCheckSyntax(live, files);
  const imported = collectSmokeImports(live, files).filter((rel) => !SMOKE_SKIP_EVAL.has(rel));
  if (imported.length) {
    await importModules(live, imported);
  }
  return { ok: true, skipped: false, imported };
}
