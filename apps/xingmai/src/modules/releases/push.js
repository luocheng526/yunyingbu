import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function xingmaiRoot() {
  const nested = path.join(repoRoot, "apps/xingmai");
  if (fs.existsSync(nested)) {
    return nested;
  }
  return repoRoot;
}

export function pushScriptPath() {
  return path.join(repoRoot, "deploy/scripts/push-xingmai-to-ecs.sh");
}

/** files 为空表示前期无文档：全量同步 apps/xingmai（或本仓库根）。 */
export async function pushXingmaiToEcs(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  const cwd = xingmaiRoot();
  const scriptPath = pushScriptPath();
  const { stdout, stderr } = await execFileAsync(scriptPath, list, {
    cwd,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });
  return { stdout: stdout || "", stderr: stderr || "", cwd, fullSync: list.length === 0 };
}
