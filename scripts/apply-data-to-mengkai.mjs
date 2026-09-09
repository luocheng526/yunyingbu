#!/usr/bin/env node
/**
 * Copy data-center overlay onto /opt/mengkai and add app.use("/api/data", dataRouter).
 * Does not restart production. Publish only after 主脑 approves at /releases.
 * Does not touch /opt/yunyingbu, nginx, or other module directories.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchAppSource } from "../src/modules/data/patch-app.js";
import { DATA_OVERLAY_FILES, assertDataOnlyPaths } from "../src/modules/data/release-files.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = process.env.MENGKAI_DIR || "/opt/mengkai";

if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
  console.error(`MENGKAI_DIR not found: ${targetRoot}`);
  process.exit(1);
}

const appPath = path.join(targetRoot, "src/app.js");
if (!fs.existsSync(appPath)) {
  console.error(`missing ${appPath}; refusing to create a new tree`);
  process.exit(1);
}

const copies = DATA_OVERLAY_FILES.map((rel) => [rel, rel]);
assertDataOnlyPaths(
  copies.map(([, to]) => to),
  "apply overlay"
);

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

function ensureDataPageRoute(source) {
  if (!/return app;/.test(source)) {
    return source;
  }
  let next = source;
  const routes = [
    ['app.get("/data"', `app.get("/data", (_req, res) => {
    res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/data.html"));
  });`],
    ['app.get("/data/stores/live"', `app.get("/data/stores/live", (_req, res) => {
    res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/data-store-live.html"));
  });`],
    ['app.get("/data/stores/overview"', `app.get("/data/stores/overview", (_req, res) => {
    res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/data-store-overview.html"));
  });`],
    ['app.get("/data/goods/overview"', `app.get("/data/goods/overview", (_req, res) => {
    res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/data-goods-overview.html"));
  });`],
    ['app.get("/data/placeholder"', `app.get("/data/placeholder", (_req, res) => {
    res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/data/placeholder/index.html"));
  });`],
    ['app.get("/data/overview"', `app.get("/data/overview", (_req, res) => {
    res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/data/overview/index.html"));
  });`]
  ];
  for (const [needle, block] of routes) {
    if (!next.includes(needle)) {
      next = next.replace(/return app;/, `${block}\n  return app;`);
    }
  }
  return next;
}

for (const [from, to] of copies) {
  copyFile(from, to);
}

const original = fs.readFileSync(appPath, "utf8");
let next = patchAppSource(original);
next = ensureDataPageRoute(next);
if (next !== original) {
  fs.writeFileSync(appPath, next);
}

console.log("data overlay copied; not restarting production. Submit a release ticket for 主脑 review.");
