import fs from "node:fs";
import path from "node:path";

export const FRAMEWORK_DIRS = [
  "src/db",
  "src/lib",
  "src/modules/home",
  "src/modules/data",
  "src/modules/han",
  "src/modules/shen",
  "src/modules/people",
  "src/modules/academy",
  "src/modules/agents",
  "src/modules/profile",
  "src/modules/notices",
  "src/modules/releases",
  "public/shared",
  "test"
];

export function resolveAppRoot(env = process.env, cwd = process.cwd()) {
  const fromEnv = String(env.MENGKAI_LIVE_ROOT || "").trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  if (fs.existsSync(path.join("/opt/mengkai", "src"))) {
    return "/opt/mengkai";
  }
  return path.resolve(cwd);
}

export function ensureFrameworkDirs(root, dirs = FRAMEWORK_DIRS) {
  const created = [];
  const skipped = [];
  const base = path.resolve(root);
  for (const rel of dirs) {
    const dest = path.join(base, rel);
    try {
      const existed = fs.existsSync(dest);
      fs.mkdirSync(dest, { recursive: true });
      if (!existed) {
        created.push(rel);
      }
    } catch (err) {
      skipped.push({ rel, error: err?.message || String(err) });
    }
  }
  return { root: base, created, skipped };
}

export function ensureFrameworkTrees(env = process.env, cwd = process.cwd()) {
  const roots = [resolveAppRoot(env, cwd)];
  const source = String(env.MENGKAI_SOURCE_DIR || "").trim();
  if (source) {
    const resolved = path.resolve(source);
    if (resolved !== roots[0]) {
      roots.push(resolved);
    }
  }
  return roots.map((root) => ensureFrameworkDirs(root));
}
