import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";

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

export async function readMengkaiUnitState() {
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/systemctl",
      ["show", "mengkai.service", "-p", "MainPID", "-p", "ActiveState", "-p", "ActiveEnterTimestamp", "-p", "SubState", "--no-page"],
      { timeout: 5000 }
    );
    const rows = {};
    String(stdout || "")
      .split("\n")
      .forEach(function (line) {
        const index = line.indexOf("=");
        if (index > 0) {
          rows[line.slice(0, index)] = line.slice(index + 1).trim();
        }
      });
    return {
      mainPid: Number(rows.MainPID || 0) || 0,
      activeState: String(rows.ActiveState || ""),
      subState: String(rows.SubState || ""),
      activeEnterTimestamp: String(rows.ActiveEnterTimestamp || "")
    };
  } catch (err) {
    if (isSystemdUnavailable(err)) {
      return { mainPid: 0, activeState: "unavailable", subState: "", activeEnterTimestamp: "", unavailable: true };
    }
    throw err;
  }
}

export function readDeployedRestartFingerprint() {
  const candidates = [
    "/opt/mengkai/src/modules/releases/restart.js",
    new URL("./restart.js", import.meta.url).pathname
  ];
  for (let index = 0; index < candidates.length; index += 1) {
    const path = candidates[index];
    try {
      if (!existsSync(path)) {
        continue;
      }
      const text = readFileSync(path, "utf8");
      return {
        path: path,
        bytes: Buffer.byteLength(text),
        hasExactArgv: /\/usr\/bin\/systemctl",\s*"restart",\s*"mengkai\.service"/.test(text),
        hasVerify: text.includes("verifyMengkaiRestart"),
        snippet: text.slice(0, 80)
      };
    } catch {
      /* try next */
    }
  }
  return { path: "", bytes: 0, hasExactArgv: false, hasVerify: false, snippet: "" };
}

export async function probeMengkaiHealth(origin) {
  const base = String(origin || process.env.HOME_INTERNAL_ORIGIN || "http://127.0.0.1:" + (process.env.PORT || 3000)).replace(
    /\/$/,
    ""
  );
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, 4000);
  try {
    const response = await fetch(base + "/api/health", { signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 120) };
    }
    return { ok: response.ok, status: response.status, body: body };
  } catch (err) {
    return { ok: false, status: 0, error: String(err && err.message ? err.message : err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Confirm a restart actually produced a new process. Call after the service is
 * expected to be back — never treat "dispatch" alone as success.
 */
export async function verifyMengkaiRestart(before, options = {}) {
  const prior = before || {};
  const origin = options.origin;
  const deadline = Date.now() + (Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 20000);
  let last = await readMengkaiUnitState();
  let health = null;
  while (Date.now() < deadline) {
    last = await readMengkaiUnitState();
    health = await probeMengkaiHealth(origin);
    const pidChanged = prior.mainPid > 0 && last.mainPid > 0 && last.mainPid !== prior.mainPid;
    const startedLater =
      prior.activeEnterTimestamp &&
      last.activeEnterTimestamp &&
      last.activeEnterTimestamp !== prior.activeEnterTimestamp;
    const active = last.activeState === "active";
    if (active && health && health.ok && (pidChanged || startedLater || !prior.mainPid)) {
      const code = readDeployedRestartFingerprint();
      return {
        ok: true,
        status: "verified",
        before: prior,
        after: last,
        health: health,
        code: code
      };
    }
    await new Promise(function (resolve) {
      setTimeout(resolve, 1000);
    });
  }
  const code = readDeployedRestartFingerprint();
  return {
    ok: false,
    status: "unverified",
    before: prior,
    after: last,
    health: health,
    code: code,
    error: "重启后未在时限内看到新 PID/启动时间与 /api/health 同时就绪"
  };
}

function spawnExactRestart() {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let child;
    try {
      // Exact sudoers argv only. detached≠escape cgroup; caller must verify after.
      child = spawn("/usr/bin/sudo", ["-n", "/usr/bin/systemctl", "restart", "mengkai.service"], {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"]
      });
    } catch (err) {
      reject(err);
      return;
    }
    let settled = false;
    function finish(error, result) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(quickFail);
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
      child.stderr.on("data", function (chunk) {
        chunks.push(Buffer.from(chunk));
      });
    }
    child.on("error", function (err) {
      finish(err);
    });
    child.on("exit", function (code, signal) {
      const stderr = Buffer.concat(chunks).toString("utf8");
      if (code === 0) {
        finish(null, { exitCode: 0, signal: signal || "", stderr: stderr });
        return;
      }
      if (/password is required/i.test(stderr)) {
        finish(
          Object.assign(new Error("Command failed: /usr/bin/sudo -n /usr/bin/systemctl restart mengkai.service\n" + stderr), {
            code: code || 1,
            stderr: stderr
          })
        );
        return;
      }
      // Honest failure/unknown — do not upgrade non-zero into scheduled success.
      finish(
        Object.assign(
          new Error(
            "systemctl restart 未成功退出 (code=" +
              String(code) +
              " signal=" +
              String(signal || "") +
              "): " +
              stderr.slice(0, 240)
          ),
          { code: code || 1, signal: signal || "", stderr: stderr }
        )
      );
    });
    // Only wait long enough to catch immediate sudo rejection. Do not claim success on timeout —
    // Type=notify may kill us before systemctl exits; status stays dispatched_unverified.
    const quickFail = setTimeout(function () {
      const stderr = Buffer.concat(chunks).toString("utf8");
      if (/password is required/i.test(stderr)) {
        finish(
          Object.assign(new Error("Command failed: /usr/bin/sudo -n /usr/bin/systemctl restart mengkai.service\n" + stderr), {
            code: 1,
            stderr: stderr
          })
        );
        return;
      }
      finish(null, { exitCode: null, signal: "", stderr: stderr, pending: true });
    }, 800);
  });
}

/**
 * Only the releases module may restart mengkai. Other modules must not call this.
 *
 * Production sudoers matches the exact argv:
 *   /usr/bin/sudo -n /usr/bin/systemctl restart mengkai.service
 * Do not add --no-block / systemd-run (breaks NOPASSWD exact-match).
 *
 * Returns dispatched_unverified until verifyMengkaiRestart confirms new PID + health.
 */
export async function restartMengkaiService(options = {}) {
  let before;
  try {
    before = await readMengkaiUnitState();
  } catch (err) {
    if (isSystemdUnavailable(err)) {
      return { skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" };
    }
    throw err;
  }
  if (before.unavailable) {
    return { skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" };
  }

  let spawned;
  try {
    spawned = await spawnExactRestart();
  } catch (err) {
    if (isSystemdUnavailable(err)) {
      return { skipped: true, reason: "当前环境没有 systemd/mengkai.service，已跳过重启；代码已在本进程生效。" };
    }
    throw err;
  }

  const result = {
    skipped: false,
    scheduled: true,
    verified: false,
    status: "dispatched_unverified",
    before: before,
    spawn: spawned,
    reason: "已派发 systemctl restart mengkai.service，尚未用新 PID/健康检查确认"
  };

  if (options.verify === true) {
    // Only useful when this process survives (e.g. called from outside the unit).
    const verified = await verifyMengkaiRestart(before, options);
    return Object.assign(result, {
      verified: verified.ok,
      status: verified.status,
      verify: verified,
      reason: verified.ok
        ? "已验证新 PID/启动时间与 /api/health"
        : verified.error || result.reason
    });
  }

  return result;
}
