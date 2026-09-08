#!/usr/bin/env node
/**
 * Copy homepage overlay onto /opt/mengkai and surgically patch src/app.js.
 * Run on the ECS as root. Does not touch /opt/yunyingbu or nginx.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { patchAppSource } from "../src/modules/home/patch-app.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = process.env.MENGKAI_DIR || "/opt/mengkai";

const copies = [
  ["public/index.html", "public/index.html"],
  ["public/shared/nav.js", "public/shared/nav.js"],
  ["public/shared/layout.css", "public/shared/layout.css"],
  ["src/modules/home/nav-items.js", "src/modules/home/nav-items.js"],
  ["src/modules/home/router.js", "src/modules/home/router.js"],
  ["src/modules/home/pages.js", "src/modules/home/pages.js"],
  ["src/modules/home/attach.js", "src/modules/home/attach.js"],
  ["src/modules/home/patch-app.js", "src/modules/home/patch-app.js"]
];

function copyFile(relFrom, relTo) {
  const from = path.join(repoRoot, relFrom);
  const to = path.join(targetRoot, relTo);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  try {
    fs.chownSync(to, fs.statSync(targetRoot).uid, fs.statSync(targetRoot).gid);
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

for (const [from, to] of copies) {
  copyFile(from, to);
}
patchAppJs();

if (process.env.SKIP_RESTART === "1") {
  process.exit(0);
}

const restart = spawnSync("systemctl", ["restart", "mengkai.service"], { stdio: "inherit" });
process.exit(restart.status ?? 1);
