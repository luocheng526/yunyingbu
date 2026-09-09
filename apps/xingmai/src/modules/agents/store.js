import { dbMode, query } from "../profile/auth.js";

export const CATALOG = [
  {
    id: "pick",
    name: "选品助手",
    title: "选品与排期",
    summary: "沈子晗线的选品、达人排期和商品成长。",
    hint: "问排期、爆款或成长阶段。",
    greeting: "我是选品助手。可以一起看选品方向、达人排期和商品成长，不会改沈子晗中心的表。"
  },
  {
    id: "data",
    name: "数据解读",
    title: "看板指标",
    summary: "解读数据中心看板里的订单、待办和发布次数。",
    hint: "问今日订单、待处理或发布次数。",
    greeting: "我是数据解读。看板数字来自库内种子，带演示标记，不是外部业务库。"
  },
  {
    id: "academy",
    name: "培训问答",
    title: "运营培训",
    summary: "对接甄选商学院的运营培训知识点。",
    hint: "问新人上手、流程或岗位要点。",
    greeting: "我是培训问答。完整课程目录在甄选商学院，这里先答运营培训常见问题。"
  },
  {
    id: "roster",
    name: "店权助手",
    title: "花名册与管辖",
    summary: "人员管理的身份、店群和管辖规则。",
    hint: "问一人多店、离职收权或对账。",
    greeting: "我是店权助手。一人多店用多条管辖；离职当天收权。花名册在人员管理，不写进本模块的表。"
  },
  {
    id: "release",
    name: "交单助手",
    title: "发版纪律",
    summary: "版本号、排队和闸门怎么交单。",
    hint: "问版本号、队首或谁能点通过。",
    greeting: "我是交单助手。全站一条号 0.1.N，先 GET /api/releases/next；闸门只过队首，不要自己发版。"
  }
];

const AGENT_IDS = new Set(CATALOG.map((item) => item.id));
const MAX_TEXT = 2000;
const MAX_TITLE = 40;

let threads = [];
let messages = [];
let nextThreadId = 1;
let nextMessageId = 1;
let schemaReady = false;

function nowStamp() {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function findAgent(agentId) {
  return CATALOG.find((item) => item.id === agentId) || null;
}

function cloneAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    title: agent.title,
    summary: agent.summary,
    hint: agent.hint
  };
}

function cloneThread(thread, preview) {
  const agent = findAgent(thread.agentId);
  return {
    id: Number(thread.id),
    agentId: thread.agentId,
    agentName: agent ? agent.name : thread.agentId,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    preview: preview || ""
  };
}

function cloneMessage(message) {
  return {
    id: Number(message.id),
    threadId: Number(message.threadId),
    role: message.role,
    text: message.text,
    createdAt: message.createdAt
  };
}

function previewOf(threadId, rows) {
  const last = rows.filter((row) => Number(row.threadId) === Number(threadId)).at(-1);
  if (!last || !last.text) {
    return "";
  }
  const text = String(last.text).replace(/\s+/g, " ").trim();
  return text.length > 80 ? text.slice(0, 80) + "…" : text;
}

function titleFromText(agent, text) {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return agent.name + " · 新对话";
  }
  return trimmed.length > MAX_TITLE ? trimmed.slice(0, MAX_TITLE) + "…" : trimmed;
}

function replyFor(agent, text) {
  const q = String(text || "").toLowerCase();
  if (agent.id === "pick") {
    if (/排期|达人/.test(q)) {
      return "排期先看沈子晗运营中心的选品中心。这里只记对话，不会改那边的任务或简报。";
    }
    if (/成长|测款|测图/.test(q)) {
      return "商品成长在沈子晗「商品成长」页跟。本助手只帮你把问题和结论记在这条对话里。";
    }
    if (/爆款|选品|新品/.test(q)) {
      return "选品可以按转化、退货和达人匹配三件事过一遍。具体店和品仍以沈子晗中心页面为准。";
    }
    return "可以问排期、爆款或成长阶段。要改任务或简报，请去沈子晗运营中心。";
  }
  if (agent.id === "data") {
    if (/订单/.test(q)) {
      return "今日订单在数据中心看板第一张卡。数字是库内种子，带演示标记。";
    }
    if (/待办|待处理/.test(q)) {
      return "待处理也在数据中心看板。本对话只解释口径，不改数据中心的表。";
    }
    if (/发布/.test(q)) {
      return "本周发布次数看数据中心看板。真正排队和通过在版本发布中心。";
    }
    return "看板有今日订单、待处理、在职人数和本周发布次数。要点一张卡，直接说名字。";
  }
  if (agent.id === "academy") {
    if (/新[人手]|入职|上手/.test(q)) {
      return "新人先走甄选商学院的目录，再回各中心看自己的页面。培训不要塞进沈/韩的「培训系统」子菜单。";
    }
    if (/流程|岗位|考核/.test(q)) {
      return "岗位流程和考核要点放在甄选商学院。这里记下你的问题，完整课件还是去商学院页。";
    }
    return "运营培训知识在甄选商学院。这里可以先记问题，不会写进沈/韩的库表。";
  }
  if (agent.id === "roster") {
    if (/离职/.test(q)) {
      return "离职当天收权。人员管理的对账能看出「在职无店权」和「店权还挂在离职人员」。";
    }
    if (/店群|一人多店|管辖/.test(q)) {
      return "一人多店用多条管辖，不要把多店塞进一个字段。店和店群在人员管理维护。";
    }
    if (/花名册|工号|上级/.test(q)) {
      return "身份名册在人员管理：姓名、工号、部门、上级、岗位、所属中心。本模块不写人员表。";
    }
    return "可以问离职收权、一人多店或花名册。改人和店请去人员管理。";
  }
  if (agent.id === "release") {
    if (/版本|0\.1|next/.test(q)) {
      return "版本号全站一条：0.1.N-说明。交单前 GET /api/releases/next，只把 -next 换成说明，禁止自领旁支号。";
    }
    if (/通过|队首|排队/.test(q)) {
      return "入队按提交时间。闸门只允许通过第 1 位，点一单发一单。禁止上移下移。";
    }
    if (/申请人|主脑|模块/.test(q)) {
      return "申请人填 罗成运营部主脑。模块名填自己的中文名，甄选智能体交单不要改壳，也不要交 src/app.js。";
    }
    return "交单：GET /api/releases/next → POST /api/releases。files 相对 apps/xingmai，contents 是路径→正文。";
  }
  return "已记下。这条对话只存在甄选智能体自己的表里。";
}

export function resetAgentsStore() {
  threads = [];
  messages = [];
  nextThreadId = 1;
  nextMessageId = 1;
  schemaReady = false;
}

export async function ensureAgentsSchema() {
  if (dbMode() !== "mysql" || schemaReady) {
    return;
  }
  await query(
    "CREATE TABLE IF NOT EXISTS agents_threads (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, agent_id VARCHAR(32) NOT NULL, title VARCHAR(128) NOT NULL, created_at VARCHAR(32) NOT NULL, updated_at VARCHAR(32) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await query(
    "CREATE TABLE IF NOT EXISTS agents_messages (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, thread_id INT NOT NULL, role VARCHAR(16) NOT NULL, text TEXT NOT NULL, created_at VARCHAR(32) NOT NULL, KEY thread_id (thread_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  schemaReady = true;
}

function threadFromRow(row) {
  return {
    id: Number(row.id),
    agentId: row.agent_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function messageFromRow(row) {
  return {
    id: Number(row.id),
    threadId: Number(row.thread_id),
    role: row.role,
    text: row.text,
    createdAt: row.created_at
  };
}

async function loadMysqlThreads() {
  const [rows] = await query(
    "SELECT id, agent_id, title, created_at, updated_at FROM agents_threads ORDER BY updated_at DESC, id DESC"
  );
  return rows.map(threadFromRow);
}

async function loadMysqlMessages(threadId) {
  const [rows] = await query(
    "SELECT id, thread_id, role, text, created_at FROM agents_messages WHERE thread_id = ? ORDER BY id ASC",
    [threadId]
  );
  return rows.map(messageFromRow);
}

async function loadMysqlAllMessages() {
  const [rows] = await query(
    "SELECT id, thread_id, role, text, created_at FROM agents_messages ORDER BY id ASC"
  );
  return rows.map(messageFromRow);
}

export function listCatalog() {
  return CATALOG.map(cloneAgent);
}

export async function listThreads() {
  await ensureAgentsSchema();
  if (dbMode() === "mysql") {
    const rows = await loadMysqlThreads();
    const all = await loadMysqlAllMessages();
    return rows.map((thread) => cloneThread(thread, previewOf(thread.id, all)));
  }
  return threads
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || b.id - a.id)
    .map((thread) => cloneThread(thread, previewOf(thread.id, messages)));
}

export async function getThread(id) {
  await ensureAgentsSchema();
  const threadId = Number(id);
  if (!Number.isInteger(threadId) || threadId < 1) {
    throw fail(400, "对话不存在");
  }
  if (dbMode() === "mysql") {
    const [rows] = await query(
      "SELECT id, agent_id, title, created_at, updated_at FROM agents_threads WHERE id = ?",
      [threadId]
    );
    if (!rows.length) {
      throw fail(404, "对话不存在");
    }
    const thread = threadFromRow(rows[0]);
    const msgs = await loadMysqlMessages(threadId);
    return { thread: cloneThread(thread, previewOf(threadId, msgs)), messages: msgs.map(cloneMessage) };
  }
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) {
    throw fail(404, "对话不存在");
  }
  const msgs = messages.filter((item) => item.threadId === threadId);
  return { thread: cloneThread(thread, previewOf(threadId, msgs)), messages: msgs.map(cloneMessage) };
}

async function insertMessage(threadId, role, text, createdAt) {
  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO agents_messages (thread_id, role, text, created_at) VALUES (?, ?, ?, ?)",
      [threadId, role, text, createdAt]
    );
    return {
      id: Number(result.insertId),
      threadId,
      role,
      text,
      createdAt
    };
  }
  const message = {
    id: nextMessageId,
    threadId,
    role,
    text,
    createdAt
  };
  nextMessageId += 1;
  messages.push(message);
  return { ...message };
}

export async function createThread(agentId) {
  const agent = findAgent(String(agentId || "").trim());
  if (!agent || !AGENT_IDS.has(agent.id)) {
    throw fail(400, "请选择智能体");
  }
  await ensureAgentsSchema();
  const stamp = nowStamp();
  const title = agent.name + " · 新对话";
  let thread;
  if (dbMode() === "mysql") {
    const [result] = await query(
      "INSERT INTO agents_threads (agent_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [agent.id, title, stamp, stamp]
    );
    thread = {
      id: Number(result.insertId),
      agentId: agent.id,
      title,
      createdAt: stamp,
      updatedAt: stamp
    };
  } else {
    thread = {
      id: nextThreadId,
      agentId: agent.id,
      title,
      createdAt: stamp,
      updatedAt: stamp
    };
    nextThreadId += 1;
    threads.push(thread);
  }
  const greeting = await insertMessage(thread.id, "assistant", agent.greeting, stamp);
  return {
    thread: cloneThread(thread, greeting.text),
    messages: [cloneMessage(greeting)]
  };
}

export async function addMessage(threadId, text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    throw fail(400, "请输入内容");
  }
  if (trimmed.length > MAX_TEXT) {
    throw fail(400, "内容过长");
  }
  const current = await getThread(threadId);
  const agent = findAgent(current.thread.agentId);
  if (!agent) {
    throw fail(400, "智能体不存在");
  }
  await ensureAgentsSchema();
  const stamp = nowStamp();
  const userMessage = await insertMessage(current.thread.id, "user", trimmed, stamp);
  const replyText = replyFor(agent, trimmed);
  const replyStamp = nowStamp();
  const reply = await insertMessage(current.thread.id, "assistant", replyText, replyStamp);
  const nextTitle =
    current.messages.some((item) => item.role === "user") ? current.thread.title : titleFromText(agent, trimmed);
  if (dbMode() === "mysql") {
    await query("UPDATE agents_threads SET title = ?, updated_at = ? WHERE id = ?", [
      nextTitle,
      replyStamp,
      current.thread.id
    ]);
  } else {
    const thread = threads.find((item) => item.id === current.thread.id);
    if (thread) {
      thread.title = nextTitle;
      thread.updatedAt = replyStamp;
    }
  }
  return {
    thread: {
      ...current.thread,
      title: nextTitle,
      updatedAt: replyStamp,
      preview: replyText
    },
    message: cloneMessage(userMessage),
    reply: cloneMessage(reply)
  };
}
