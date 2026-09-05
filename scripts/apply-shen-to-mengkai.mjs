#!/usr/bin/env node
/**
 * Copy 沈子晗 overlay onto /opt/mengkai and surgically patch src/app.js.
 * Run on the ECS as root. Does not touch /opt/yunyingbu, nginx, or other modules.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { patchAppSource } from "../src/modules/shen/patch-app.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = process.env.MENGKAI_DIR || "/opt/mengkai";

const copies = [
  ["public/shen.html", "public/shen.html"],
  ["src/modules/shen/store.js", "src/modules/shen/store.js"],
  ["src/modules/shen/router.js", "src/modules/shen/router.js"],
  ["src/modules/shen/patch-app.js", "src/modules/shen/patch-app.js"]
];

function copyFile(relFrom, relTo) {
  const from = path.join(repoRoot, relFrom);
  const to = path.join(targetRoot, relTo);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  try {
    const st = fs.statSync(targetRoot);
    fs.chownSync(to, st.uid, st.gid);
  } catch {
    // best-effort when not root
  }
}

function patchAppJs() {
  const appPath = path.join(targetRoot, "src/app.js");
  const original = fs.readFileSync(appPath, "utf8");
  const next = patchAppSource(original);
  if (next !== original) {
    fs.writeFileSync(appPath, next);
  }
}

if (!fs.existsSync(targetRoot)) {
  console.error(`目标目录不存在: ${targetRoot}`);
  process.exit(1);
}

for (const [from, to] of copies) {
  copyFile(from, to);
}

const shenHtml = path.join(targetRoot, "public/shen.html");
const shenIndex = path.join(targetRoot, "public/shen/index.html");
fs.mkdirSync(path.dirname(shenIndex), { recursive: true });
fs.copyFileSync(shenHtml, shenIndex);

patchAppJs();

if (process.env.SKIP_RESTART === "1") {
  process.exit(0);
}

const restart = spawnSync("systemctl", ["restart", "mengkai.service"], { stdio: "inherit" });
process.exit(restart.status ?? 1);
