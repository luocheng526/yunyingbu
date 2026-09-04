import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const scriptPath = path.join(repoRoot, "deploy/scripts/push-xingmai-to-ecs.sh");

export function pushScriptPath() {
  return scriptPath;
}

/** 只把发布文档里的文件推到 /opt/mengkai。禁止把这个函数交给其他模块调用。 */
export async function pushXingmaiToEcs(files) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) {
    throw new Error("缺少文件列表，拒绝 push");
  }
  const { stdout, stderr } = await execFileAsync(scriptPath, list, {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });
  return { stdout: stdout || "", stderr: stderr || "" };
}
