import { spawn } from "node:child_process";

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

/**
 * Only the releases module may restart mengkai. Other modules must not call this.
 *
 * Production sudoers matches the exact argv:
 *   /usr/bin/sudo -n /usr/bin/systemctl restart mengkai.service
 * Extra flags (timer helpers / no-block) broke NOPASSWD exact-match and
 * failed with "sudo: a password is required" (rel-1361/1362/1365).
 * Do not widen sudoers — keep this argv exact.
 *
 * Spawn detached and do not await stop/start: waiting inside Type=notify
 * deadlocks. Detach so the child outlives this process when systemd stops us.
 */
export async function restartMengkaiService() {
  return await new Promise((resolve, reject) => {
    let settled = false;
    const chunks = [];
    let child;
    try {
      child = spawn("/usr/bin/sudo", ["-n", "/usr/bin/systemctl", "restart", "mengkai.service"], {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"]
      });
    } catch (err) {
      if (isSystemdUnavailable(err)) {
        resolve({ skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" });
        return;
      }
      reject(err);
      return;
    }

    function done(result, error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        if (child.stderr) {
          child.stderr.removeAllListeners("data");
        }
      } catch {
        /* ignore */
      }
      try {
        child.unref();
      } catch {
        /* ignore */
      }
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
    }

    child.on("error", (err) => {
      if (isSystemdUnavailable(err)) {
        done({ skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" });
        return;
      }
      done(null, err);
    });

    child.on("exit", (code, signal) => {
      const stderr = Buffer.concat(chunks).toString("utf8");
      if (code === 0) {
        done({ skipped: false, scheduled: true });
        return;
      }
      if (/password is required/i.test(stderr)) {
        done(
          null,
          Object.assign(new Error("Command failed: /usr/bin/sudo -n /usr/bin/systemctl restart mengkai.service\n" + stderr), {
            code: code || 1,
            stderr
          })
        );
        return;
      }
      if (isSystemdUnavailable({ message: stderr, code })) {
        done({ skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" });
        return;
      }
      // Non-zero often means this unit was already stopping while systemctl ran —
      // the restart was still accepted. Treat as scheduled unless sudo rejected us.
      if (signal || code) {
        done({ skipped: false, scheduled: true, note: stderr.slice(0, 200) });
        return;
      }
      done({ skipped: false, scheduled: true });
    });

    // Do not wait for the full restart; after 1.5s assume systemd accepted the job.
    const timer = setTimeout(() => {
      done({ skipped: false, scheduled: true });
    }, 1500);
  });
}
