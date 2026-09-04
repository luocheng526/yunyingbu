import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function isSystemdUnavailable(err) {
  const msg = String(err?.stderr || err?.message || err);
  return (
    err?.code === "ENOENT" ||
    msg.includes("not been booted with systemd") ||
    msg.includes("Failed to connect to bus")
  );
}

/** Only the releases module may restart mengkai. Other modules must not call this. */
export async function restartMengkaiService() {
  try {
    await execFileAsync("systemctl", ["restart", "mengkai.service"]);
  } catch (err) {
    if (isSystemdUnavailable(err)) {
      return { skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" };
    }
    throw err;
  }
  return { skipped: false };
}
