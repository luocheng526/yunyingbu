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

/** Static page/test files can go live without killing the Node process. */
export function filesNeedProcessRestart(files) {
  const list = Array.isArray(files) ? files.filter(Boolean).map((rel) => String(rel).replaceAll("\\", "/")) : [];
  if (!list.length) {
    return true;
  }
  return list.some((rel) => {
    const top = rel.replace(/^\/+/, "").split("/")[0];
    return top === "src" || rel === "package.json" || rel === "package-lock.json";
  });
}

/** Ticket asked to restart, and the file list actually needs a new Node process. */
export function ticketNeedsProcessRestart(item, noDoc = false) {
  if (!item?.restart) {
    return false;
  }
  return filesNeedProcessRestart(noDoc ? [] : item.files || []);
}

/** Only the releases module may restart mengkai. Other modules must not call this. */
export async function restartMengkaiService() {
  try {
    await execFileAsync("/usr/bin/sudo", ["-n", "/usr/bin/systemctl", "restart", "mengkai.service"]);
  } catch (err) {
    if (isSystemdUnavailable(err)) {
      return { skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" };
    }
    throw err;
  }
  return { skipped: false };
}
