import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";
import { CATALOG, resetAgentsStore } from "../src/modules/agents/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentsJs = readFileSync(join(root, "public/shared/modules/agents.js"), "utf8");
const agentsCss = readFileSync(join(root, "public/agents.css"), "utf8");
const agentsHtml = readFileSync(join(root, "public/agents.html"), "utf8");

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

beforeEach(() => {
  resetStoreForTests();
  resetAgentsStore();
});
after(() => server.close());

async function loginCookie() {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

test("工作台脚本挂 XmModules /agents，颜色走主题变量", () => {
  assert.match(agentsJs, /XmModules\["\/agents"\]/);
  assert.match(agentsJs, /甄选智能体/);
  assert.match(agentsJs, /智能体入口/);
  assert.doesNotMatch(agentsJs, /xm-sider/);
  assert.match(agentsCss, /--xm-/);
  assert.match(agentsCss, /data-theme/);
  assert.match(agentsHtml, /甄选智能体/);
  assert.doesNotMatch(agentsHtml, /e50e/);
});

test("目录和空对话列表可从 stub 根路径读到", async () => {
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/agents`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.module, "甄选智能体");
  assert.equal(data.message, "工作台已就绪");
  assert.equal(data.agents.length, CATALOG.length);
  assert.ok(data.agents.some((item) => item.id === "pick" && item.name === "选品助手"));
  assert.deepEqual(data.threads, []);
});

test("开对话并发送后记录还在，不写别人的表", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, "Content-Type": "application/json" };
  const created = await fetch(`${base}/api/agents/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({ agentId: "release" })
  });
  assert.equal(created.status, 201);
  const first = await created.json();
  assert.equal(first.ok, true);
  assert.equal(first.thread.agentId, "release");
  assert.equal(first.thread.agentName, "交单助手");
  assert.equal(first.messages[0].role, "assistant");
  assert.match(first.messages[0].text, /0\.1\.N/);

  const sent = await fetch(`${base}/api/agents/threads/${first.thread.id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "版本号怎么领" })
  });
  assert.equal(sent.status, 201);
  const chat = await sent.json();
  assert.equal(chat.message.role, "user");
  assert.equal(chat.message.text, "版本号怎么领");
  assert.equal(chat.reply.role, "assistant");
  assert.match(chat.reply.text, /releases\/next/);
  assert.match(chat.thread.title, /版本号/);

  const opened = await (await fetch(`${base}/api/agents/threads/${first.thread.id}`, { headers: { cookie } })).json();
  assert.equal(opened.messages.length, 3);
  assert.equal(opened.messages[1].text, "版本号怎么领");

  const list = await (await fetch(`${base}/api/agents`, { headers: { cookie } })).json();
  assert.equal(list.threads.length, 1);
  assert.equal(list.threads[0].agentId, "release");
});

test("空内容和未知智能体要 400", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, "Content-Type": "application/json" };
  const badAgent = await fetch(`${base}/api/agents/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({ agentId: "ghost" })
  });
  assert.equal(badAgent.status, 400);
  const created = await fetch(`${base}/api/agents/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify({ agentId: "data" })
  });
  const thread = (await created.json()).thread;
  const empty = await fetch(`${base}/api/agents/threads/${thread.id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "   " })
  });
  assert.equal(empty.status, 400);
  const missing = await fetch(`${base}/api/agents/threads/999/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "hi" })
  });
  assert.equal(missing.status, 404);
});
