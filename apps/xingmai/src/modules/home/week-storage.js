import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function weekDataDir() {
  return process.env.HOME_WEEK_DATA_DIR || path.join(process.env.MENGKAI_LIVE_ROOT || process.cwd(), "data", "home-week");
}
export function wpsConfigPath() { return process.env.HOME_WEEK_WPS_CONFIG || path.join(weekDataDir(), "wps-config.json"); }
export function wpsStorePath() { return process.env.HOME_WEEK_WPS_STORE || path.join(weekDataDir(), "wps-store.json"); }
export function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
export function readWpsConfig() {
  if (!fs.existsSync(wpsConfigPath())) return { accountLabel: "", sources: [], expectedTeams: ["han", "shen"] };
  return JSON.parse(fs.readFileSync(wpsConfigPath(), "utf8"));
}
export function wpsEnabled() { return Boolean(process.env.HOME_WEEK_WPS_STORE || fs.existsSync(wpsConfigPath())); }
export function cliPath() {
  const managed = path.join(weekDataDir(), "tools", "kdocs-cli-2.9.0");
  return process.env.HOME_WEEK_WPS_CLI || readWpsConfig().cli || (fs.existsSync(managed) ? managed : "kdocs-cli");
}
