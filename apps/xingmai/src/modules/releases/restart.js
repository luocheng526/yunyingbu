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
  // systemd-run schedules the restart outside this service. Waiting on
  // `systemctl restart` from inside the service deadlocks: systemd waits
  // for this process to exit, and this process waits for systemctl.
  try {
    await execFileAsync(
      "/usr/bin/sudo",
      ["-n", "/usr/bin/systemd-run", "--on-active=2s", "--timer-property=AccuracySec=1s", "/usr/bin/systemctl", "restart", "mengkai.service"],
      { timeout: 8000 }
    );
    return { skipped: false, scheduled: true };
  } catch (err) {
    if (isSystemdUnavailable(err)) {
      return { skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" };
    }
  }
  try {
    await execFileAsync("/usr/bin/sudo", ["-n", "/usr/bin/systemctl", "restart", "--no-block", "mengkai.service"], { timeout: 8000 });
    return { skipped: false, scheduled: true };
  } catch (err) {
    if (isSystemdUnavailable(err)) {
      return { skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" };
    }
    throw err;
  }
}
