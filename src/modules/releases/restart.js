import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Only the releases module may restart mengkai. Other modules must not call this. */
export async function restartMengkaiService() {
  await execFileAsync("systemctl", ["restart", "mengkai.service"]);
}
