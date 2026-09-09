import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";
import { resetAgentsStore } from "../src/modules/agents/store.js";
import { publicModels } from "../src/modules/agents/models.js";
import { runDesk } from "../src/modules/agents/desk.js";
import { resolveViewer, rosterSnapshot } from "../src/modules/agents/tools.js";
import { resetPeopleStore } from "../src/modules/people/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentsJs = readFileSync(join(root, "public/shared/modules/agents.js"), "utf8");
const agentsCss = readFileSync(join(root, "public/agents.css"), "utf8");
const agentsHtml = readFileSync(join(root, "public/agents.html"), "utf8");
const modelsJs = readFileSync(join(root, "src/modules/agents/models.js"), "utf8");
const routerJs = readFileSync(join(root, "src/modules/agents/router.js"), "utf8");

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

beforeEach(() => {
  resetStoreForTests();
  resetAgentsStore();
  resetPeopleStore();
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

test("会话页挂 XmModules /agents，颜色走主题变量", () => {
  assert.match(agentsJs, /XmModules\["\/agents"\]/);
  assert.match(agentsJs, /甄选智能体/);
  assert.match(agentsJs, /主脑问答台/);
  assert.match(agentsJs, /\/api\/agents\/chat/);
  assert.match(agentsJs, /\/api\/agents\/models/);
  assert.match(agentsJs, /\/api\/agents\/uploads/);
  assert.match(agentsJs, /\/api\/agents\/sessions/);
  assert.doesNotMatch(agentsJs, /xm-sider/);
  assert.doesNotMatch(agentsJs, /XM_AGENTS_API_KEY/);
  assert.match(agentsCss, /--xm-/);
  assert.match(agentsCss, /data-theme/);
  assert.match(agentsHtml, /甄选智能体/);
});

test("模型列表只有 modelId，不准带密钥", async () => {
  assert.doesNotMatch(modelsJs, /sk-|Bearer/);
  const cookie = await loginCookie();
  const res = await fetch(`${base}/api/agents/models`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.models.some((item) => item.id === "desk"));
  const blob = JSON.stringify(data);
  assert.doesNotMatch(blob, /apiKey|secret|XM_AGENTS_API_KEY/);
  publicModels().forEach((item) => {
    assert.equal("key" in item, false);
  });
  assert.doesNotMatch(routerJs, /res\.json\(\{[^}]*key/);
});

test("多轮对话走 /chat，会话留在本模块", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, "Content-Type": "application/json" };
  const first = await fetch(`${base}/api/agents/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ modelId: "desk", text: "张文静在职吗" })
  });
  assert.equal(first.status, 201);
  const one = await first.json();
  assert.equal(one.ok, true);
  assert.equal(one.session.modelId, "desk");
  assert.match(one.reply.text, /张文静/);
  assert.match(one.reply.text, /在职/);
  assert.ok(one.sources.includes("人员花名册只读"));

  const second = await fetch(`${base}/api/agents/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId: one.session.id, modelId: "desk", text: "我能看见哪些店" })
  });
  assert.equal(second.status, 201);
  const two = await second.json();
  assert.match(two.reply.text, /花名册没有「罗成」/);

  const opened = await (await fetch(`${base}/api/agents/sessions/${one.session.id}`, { headers: { cookie } })).json();
  assert.ok(opened.messages.length >= 5);
  const list = await (await fetch(`${base}/api/agents/sessions`, { headers: { cookie } })).json();
  assert.equal(list.sessions.length, 1);
});

test("无权的店拒绝，花名册在职可查", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, "Content-Type": "application/json" };
  const denied = await fetch(`${base}/api/agents/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "飒望居家旗舰店归哪些运营" })
  });
  const body = await denied.json();
  assert.match(body.reply.text, /无权|花名册没有你的名字/);

  const roster = await rosterSnapshot();
  const wang = roster.people.find((item) => item.name === "王博");
  assert.ok(wang.visibleShops.includes("飒望居家旗舰店"));
  const viewer = {
    username: "王博",
    displayName: "王博",
    person: wang,
    employed: true,
    shops: wang.visibleShops
  };
  const allowed = await runDesk({
    text: "飒望居家旗舰店归哪些运营",
    viewer,
    history: [],
    files: [],
    roster
  });
  assert.match(allowed.text, /王博/);
  assert.equal(allowed.refused, false);
});

test("没接口的数据和改价发版不编造", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, "Content-Type": "application/json" };
  const gap = await (await fetch(`${base}/api/agents/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "飒望居家旗舰店近30天成交多少" })
  })).json();
  assert.match(gap.reply.text, /还没有/);
  assert.ok(gap.gaps.some((item) => item.includes("店近30天")));

  const academy = await (await fetch(`${base}/api/agents/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId: gap.session.id, text: "商学院那门课怎么考核" })
  })).json();
  assert.match(academy.reply.text, /还没有/);

  const refuse = await (await fetch(`${base}/api/agents/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId: gap.session.id, text: "帮我改价并点通过发版" })
  })).json();
  assert.match(refuse.reply.text, /不做改价/);
});

test("上传只回文件 id，对话引用 id", async () => {
  const cookie = await loginCookie();
  const form = new FormData();
  form.append("file", new Blob(["花名册摘录"], { type: "text/plain" }), "note.txt");
  const uploaded = await fetch(`${base}/api/agents/uploads`, {
    method: "POST",
    headers: { cookie },
    body: form
  });
  assert.equal(uploaded.status, 201);
  const file = (await uploaded.json()).file;
  assert.ok(file.id);
  assert.equal(file.filename, "note.txt");
  assert.equal("content" in file, false);

  const chat = await fetch(`${base}/api/agents/chat`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "看一下我刚传的文件", fileIds: [file.id] })
  });
  assert.equal(chat.status, 201);
  const data = await chat.json();
  assert.ok(data.message.fileIds.includes(file.id));
  assert.match(data.reply.text, new RegExp("#" + file.id));
});

test("登录用户解析花名册店权", async () => {
  const viewer = await resolveViewer({ username: "罗成", displayName: "罗成" });
  assert.equal(viewer.person, null);
  assert.deepEqual(viewer.shops, []);
});
