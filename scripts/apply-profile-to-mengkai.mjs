#!/usr/bin/env node
/**
 * Overlay personal-center files onto /opt/mengkai and add only
 * app.use("/api/profile", profileRouter). Restarts mengkai.service.
 * Does not touch /opt/yunyingbu or nginx.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { patchAppSource } from "../src/modules/profile/patch-app.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = process.env.MENGKAI_DIR || "/opt/mengkai";

const copies = [
  ["public/me.html", "public/me.html"],
  ["src/modules/profile/password.js", "src/modules/profile/password.js"],
  ["src/modules/profile/store.js", "src/modules/profile/store.js"],
  ["src/modules/profile/session.js", "src/modules/profile/session.js"],
  ["src/modules/profile/profile-router.js", "src/modules/profile/profile-router.js"],
  ["src/modules/profile/patch-app.js", "src/modules/profile/patch-app.js"]
];

function copyFile(relFrom, relTo) {
  const from = path.join(repoRoot, relFrom);
  const to = path.join(targetRoot, relTo);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
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
