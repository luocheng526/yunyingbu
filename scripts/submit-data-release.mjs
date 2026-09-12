#!/usr/bin/env node
/**
 * Submit a data-center release ticket with overlay files only.
 * Never includes src/app.js or other modules. Never restarts production.
 * Logs in with the production admin account from docs/agents/00-prod-admin.md
 * (or RELEASE_ADMIN_* env). Never puts the password in ticket fields or logs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_OVERLAY_FILES, assertDataOnlyPaths } from "../src/modules/data/release-files.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminDocPath = path.join(repoRoot, "docs/agents/00-prod-admin.md");

function cell(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|\\n]+)\\s*\\|`));
  return match ? match[1].trim() : "";
}

function loadAdmin() {
  const markdown = fs.existsSync(adminDocPath) ? fs.readFileSync(adminDocPath, "utf8") : "";
  const username = process.env.RELEASE_ADMIN_USER || cell(markdown, "用户名") || "罗成";
  const password = process.env.RELEASE_ADMIN_PASSWORD || cell(markdown, "密码");
  const applicant = process.env.RELEASE_APPLICANT || cell(markdown, "申请人") || "罗成运营部主脑";
  if (!password) {
    throw new Error("缺少管理员密码：先读 docs/agents/00-prod-admin.md，或设置 RELEASE_ADMIN_PASSWORD");
  }
  return { username, password, applicant };
}

function assertTicketHasNoSecret(payload, secret) {
  const publicFields = {
    applicant: payload.applicant,
    source: payload.source,
    module: payload.module,
    summary: payload.summary,
    acceptance: payload.acceptance,
    version: payload.version || "",
    files: payload.files
  };
  if (secret && JSON.stringify(publicFields).includes(secret)) {
    throw new Error("单据标题或公开字段禁止包含登录密码");
  }
}

function cookieFromResponse(res) {
  const list =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);
  return list
    .map((entry) => String(entry).split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function loginForReleasesUrl(releasesUrl, admin) {
  if (process.env.RELEASE_NO_LOGIN === "1") {
    return "";
  }
  const origin = new URL(releasesUrl).origin;
  const loginUrl = new URL("/api/auth/login", origin).href;
  let res;
  try {
    res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: admin.username, password: admin.password })
    });
  } catch (err) {
    if (origin.includes("xingmaierp.cc")) {
      throw new Error(`线上登录失败：${err.message}`);
    }
    return "";
  }
  if (res.status === 404) {
    return "";
  }
  const cookie = cookieFromResponse(res);
  if (!res.ok || !cookie) {
    const hint = res.status === 401 ? "用户名或密码错误（不要用演示账号）" : `HTTP ${res.status}`;
    throw new Error(`线上交单需先用管理员号登录：${hint}`);
  }
  return cookie;
}

const admin = loadAdmin();
const endpoints = (process.env.RELEASES_API || "http://127.0.0.1:3000/api/releases,http://zx.xingmaierp.cc/api/releases")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const extraFiles = (process.env.RELEASE_FILES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const listed =
  extraFiles.length && process.env.RELEASE_ONLY === "1"
    ? extraFiles
    : [...DATA_OVERLAY_FILES, ...extraFiles];
const files = assertDataOnlyPaths(listed, "交单 files");
const contents = {};
for (const rel of files) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`missing ${rel}`);
  }
  contents[rel] = fs.readFileSync(abs, "utf8");
}

const payload = {
  applicant: admin.applicant,
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

assertTicketHasNoSecret(payload, admin.password);

async function submit(url) {
  const cookie = await loginForReleasesUrl(url, admin);
  const headers = { "Content-Type": "application/json" };
  if (cookie) {
    headers.Cookie = cookie;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { url, status: res.status, text, json, loggedIn: Boolean(cookie) };
}

const errors = [];
for (const url of endpoints) {
  try {
    const result = await submit(url);
    if (result.status === 201 || result.status === 200) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            submitted: true,
            url: result.url,
            status: result.status,
            json: result.json,
            loggedIn: result.loggedIn,
            applicant: payload.applicant,
            payload: { ...payload, contents: Object.keys(contents) }
          },
          null,
          2
        )
      );
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
      next: "请用管理员号登录「版本发布中心」提交审核单。真正发布只能等主脑审核通过后点击发布。"
    },
    null,
    2
  )
);
process.exit(1);
