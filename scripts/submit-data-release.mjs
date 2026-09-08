#!/usr/bin/env node
/**
 * Submit a data-center release ticket with overlay files only.
 * Never includes src/app.js or other modules. Never restarts production.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_OVERLAY_FILES, assertDataOnlyPaths } from "../src/modules/data/release-files.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const endpoints = (process.env.RELEASES_API || "http://127.0.0.1:3000/api/releases,http://zx.xingmaierp.cc/api/releases")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const extraFiles = (process.env.RELEASE_FILES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const files = assertDataOnlyPaths([...DATA_OVERLAY_FILES, ...extraFiles], "交单 files");
const contents = {};
for (const rel of files) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`missing ${rel}`);
  }
  contents[rel] = fs.readFileSync(abs, "utf8");
}

const payload = {
  applicant: process.env.RELEASE_APPLICANT || "数据中心看板",
  source: process.env.RELEASE_SOURCE || "数据中心看板",
  module: process.env.RELEASE_MODULE || "数据中心",
  summary:
    process.env.RELEASE_SUMMARY ||
    "数据中心看板：仅覆盖 public/data* 与 src/modules/data/*，不提交 src/app.js。",
  files,
  contents,
  acceptance:
    process.env.RELEASE_ACCEPTANCE ||
    "打开 /data 可见本板块；/api/health、/api/releases、/login 仍可用。",
  restart: process.env.RELEASE_RESTART === "1"
};

if (process.env.RELEASE_VERSION) {
  payload.version = process.env.RELEASE_VERSION;
}

async function submit(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { url, status: res.status, text, json };
}

const errors = [];
for (const url of endpoints) {
  try {
    const result = await submit(url);
    if (result.status === 201 || result.status === 200) {
      console.log(JSON.stringify({ ok: true, submitted: true, ...result, payload: { ...payload, contents: Object.keys(contents) } }, null, 2));
      process.exit(0);
    }
    errors.push({ url, status: result.status, body: result.json || result.text.slice(0, 300) });
  } catch (err) {
    errors.push({ url, error: err.message });
  }
}

console.log(
  JSON.stringify(
    {
      ok: false,
      submitted: false,
      files,
      errors,
      next: "请到「版本发布中心」提交审核单。真正发布只能等主脑审核通过后点击发布。"
    },
    null,
    2
  )
);
process.exit(1);
