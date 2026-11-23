import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { weekDataDir, readWpsConfig } from "./week-storage.js";

const execute = promisify(execFile);
const archiveHash = "5672001cdf710012d1126555cbdcfdb5835b53ec109138dd2157f5b87f2b2172";
const archiveUrl = "https://wpsai.wpscdn.cn/skillhub/pro/v2.9.0/releases/kdocs-cli-2.9.0-linux-amd64.tar.gz";
export const managedWpsCli = () => path.join(weekDataDir(), "tools", "kdocs-cli-2.9.0");
let installing;
export async function prepareWpsRuntime() {
  if (process.platform !== "linux" || process.arch !== "x64" || process.env.HOME_WEEK_WPS_CLI || readWpsConfig().cli || fs.existsSync(managedWpsCli())) return;
  if (installing) return installing;
  installing = (async () => {
    try { await execute("kdocs-cli", ["version"], { timeout: 5000, maxBuffer: 2000 }); return; } catch { /* Install the pinned official build when PATH has no CLI. */ }
    const target = managedWpsCli(), folder = path.dirname(target);
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    const archive = path.join(folder, `${randomUUID()}.tar.gz`), temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const response = await fetch(archiveUrl, { redirect: "error", signal: globalThis.AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("WPS 官方连接工具下载失败");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== archiveHash) throw new Error("WPS 官方连接工具校验失败");
      fs.writeFileSync(archive, bytes, { mode: 0o600, flag: "wx" });
      // Extract only the named binary to stdout; the archive cannot write arbitrary paths.
      const { stdout } = await execute("tar", ["-xzOf", archive, "kdocs-cli"], { encoding: "buffer", timeout: 15000, maxBuffer: 64 * 1024 * 1024 });
      if (stdout.length < 4 || !stdout.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))) throw new Error("WPS 官方连接工具格式不正确");
      fs.writeFileSync(temporary, stdout, { mode: 0o700, flag: "wx" });
      await execute(temporary, ["version"], { timeout: 5000, maxBuffer: 2000 });
      fs.renameSync(temporary, target);
    } finally {
      for (const file of [archive, temporary]) if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  })();
  try { await installing; } finally { installing = null; }
}
