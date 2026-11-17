/* 工作任务：发布、执行、检查走同一条记录。 */
import { randomUUID } from "node:crypto";
import { dbMode, query } from "../profile/auth.js";
import { dingUserOf, sendTaskNotice } from "./dingtalk.js";
import { matchPerson, orgPeople } from "./store.js";

const tasks = new Map();
const fileBytes = new Map();
const tails = new Map();
let readyP = null;
let notify = defaultNotify;

const QUEUES = new Set(["published", "mine", "review"]);
const ACTIONS = {
  start: { from: ["待执行"], to: "进行中", who: "assignee", note: false, notice: "" },
  submit: { from: ["待执行", "进行中", "已退回"], to: "待检查", who: "assignee", note: true, notice: "reviewer" },
  approve: { from: ["待检查"], to: "已完成", who: "reviewer", note: false, notice: "" },
  return: { from: ["待检查"], to: "已退回", who: "reviewer", note: true, notice: "assignee" }
};
const ACTION_LABEL = {
  publish: "发布任务",
  start: "开始执行",
  submit: "提交检查",
  approve: "检查通过",
  return: "退回修改"
};

function fail(error, statusCode = 400) {
  return { ok: false, error, statusCode };
}

function shanghaiStamp(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function cleanId(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(text) ? text : "";
}

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

function clock(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) ? text.slice(0, 16) : "";
}

function lock(id, fn) {
  const prev = tails.get(id) || Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(id, run.then(() => {}, () => {}));
  return run;
}

async function defaultNotify(personId, title, text) {
  const userid = dingUserOf(personId);
  if (!userid) {
    return false;
  }
  try {
    return await sendTaskNotice(userid, title, text);
  } catch {
    return false;
  }
}

export function setTaskNotifier(fn) {
  notify = fn || defaultNotify;
}

export function resetTaskStore() {
  tasks.clear();
  fileBytes.clear();
  tails.clear();
  readyP = null;
  notify = defaultNotify;
}

async function setup() {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_task (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      body MEDIUMTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS work_report_task_file (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      task_id VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      mime VARCHAR(80) NOT NULL,
      bytes MEDIUMBLOB NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const [rows] = await query("SELECT id, body FROM work_report_task");
  tasks.clear();
  for (const row of rows) {
    try {
      const task = JSON.parse(row.body);
      if (task && task.id) {
        tasks.set(String(task.id), task);
      }
    } catch {
      /* 坏记录不进入列表。 */
    }
  }
}

async function ready() {
  if (!readyP) {
    readyP = setup().catch((err) => {
      readyP = null;
      throw err;
    });
  }
  return readyP;
}

async function peopleMap() {
  const list = await orgPeople();
  return new Map(list.filter((person) => person.status !== "离职").map((person) => [String(person.id), person]));
}

async function meOf(user) {
  const person = await matchPerson(user);
  if (!person || person.status === "离职") {
    return null;
  }
  return { id: String(person.id), name: person.name };
}

function view(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    criteria: task.criteria,
    publisher: task.publisher,
    assignee: task.assignee,
    reviewer: task.reviewer,
    start_at: task.start_at,
    due_at: task.due_at,
    status: task.status,
    revision: task.revision,
    files: (task.files || []).map((file) => ({ id: file.id, name: file.name })),
    events: (task.events || []).map((event) => ({
      id: event.id,
      action: event.action,
      actor: event.actor,
      at: event.at,
      note: event.note || "",
      files: (event.files || []).map((file) => ({ id: file.id, name: file.name }))
    }))
  };
}

function canSee(task, personId) {
  return task.publisher === personId || task.assignee === personId || task.reviewer === personId;
}

async function saveTask(task) {
  tasks.set(task.id, task);
  if (dbMode() !== "mysql") {
    return;
  }
  const body = JSON.stringify(task);
  await query(
    `INSERT INTO work_report_task (id, body) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE body = VALUES(body)`,
    [task.id, body]
  );
}

async function saveFile(file) {
  fileBytes.set(file.id, file.bytes);
  if (dbMode() !== "mysql") {
    return;
  }
  await query(
    `INSERT INTO work_report_task_file (id, task_id, name, mime, bytes) VALUES (?, ?, ?, ?, ?)`,
    [file.id, file.taskId, file.name, file.mime || "application/octet-stream", file.bytes]
  );
}

function takeFiles(input) {
  const list = Array.isArray(input?.files) ? input.files : [];
  if (list.length > 3) {
    return fail("最多上传 3 个附件，合计 3 MB");
  }
  const files = [];
  let total = 0;
  for (const item of list) {
    const name = clip(String(item?.name || "").split(/[/\\]/).pop(), 80);
    if (!name) {
      return fail("附件缺少文件名");
    }
    const bytes = Buffer.isBuffer(item.bytes)
      ? item.bytes
      : Buffer.from(String(item.data || ""), "base64");
    if (!bytes.length) {
      return fail("请移除空文件");
    }
    total += bytes.length;
    if (total > 3 * 1024 * 1024) {
      return fail("最多上传 3 个附件，合计 3 MB");
    }
    files.push({ name, mime: clip(item.mime, 80) || "application/octet-stream", bytes });
  }
  return { ok: true, files };
}

async function tell(personId, title, text) {
  try {
    await notify(personId, title, text);
  } catch {
    /* 通知失败不回滚任务。 */
  }
}

export async function taskContext(user) {
  await ready();
  const me = await meOf(user);
  const people = [...(await peopleMap()).values()]
    .map((person) => ({ id: String(person.id), name: person.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));
  return {
    ok: true,
    me: me ? me.id : "",
    today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()),
    people
  };
}

export async function listTasks(user, queue) {
  await ready();
  const me = await meOf(user);
  if (!me) {
    return fail("对不上组织中心的人", 403);
  }
  const kind = String(queue || "");
  if (!QUEUES.has(kind)) {
    return fail("任务列表不存在");
  }
  const rows = [...tasks.values()]
    .filter((task) => (kind === "published" ? task.publisher === me.id : kind === "mine" ? task.assignee === me.id : task.reviewer === me.id))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return { ok: true, me: me.id, rows: rows.map(view) };
}

export async function publishTask(user, input) {
  await ready();
  const me = await meOf(user);
  if (!me) {
    return fail("对不上组织中心的人", 403);
  }
  const id = cleanId(input?.id) || randomUUID();
  return lock(id, async () => {
    const existing = tasks.get(id);
    if (existing) {
      if (existing.publisher !== me.id) {
        return fail("这条任务不是你发布的", 403);
      }
      return { ok: true, task: view(existing), duplicate: true };
    }
    const title = clip(input?.title, 200);
    const description = clip(input?.description, 4000);
    const criteria = clip(input?.criteria, 2000);
    if (!title) {
      return fail("请填写任务标题");
    }
    const people = await peopleMap();
    const assignee = String(input?.assignee || "");
    const reviewer = String(input?.reviewer || "");
    if (!people.has(assignee) || !people.has(reviewer)) {
      return fail("请选择执行人和检查人");
    }
    if (assignee === reviewer) {
      return fail("检查人和执行人必须为不同人员");
    }
    const startAt = clock(input?.start_at);
    const dueAt = clock(input?.due_at);
    if (!startAt || !dueAt) {
      return fail("请填写计划开始和截止时间");
    }
    if (dueAt < startAt) {
      return fail("截止时间不能早于开始时间");
    }
    const packed = takeFiles(input);
    if (!packed.ok) {
      return packed;
    }
    const now = shanghaiStamp();
    const eventId = randomUUID();
    const files = packed.files.map((file) => ({ id: randomUUID(), name: file.name, bytes: file.bytes, mime: file.mime, taskId: id }));
    for (const file of files) {
      await saveFile(file);
    }
    const task = {
      id,
      title,
      description,
      criteria,
      publisher: me.id,
      assignee,
      reviewer,
      start_at: startAt,
      due_at: dueAt,
      status: "待执行",
      revision: 1,
      updated_at: now,
      files: files.map((file) => ({ id: file.id, name: file.name })),
      events: [
        {
          id: eventId,
          action: ACTION_LABEL.publish,
          actor: me.id,
          at: now,
          note: "",
          files: files.map((file) => ({ id: file.id, name: file.name }))
        }
      ]
    };
    await saveTask(task);
    await tell(assignee, "新的工作任务", `你有一条新任务：${title}。请在工作汇报里查看。`);
    return { ok: true, task: view(task) };
  });
}

export async function actTask(user, input) {
  await ready();
  const me = await meOf(user);
  if (!me) {
    return fail("对不上组织中心的人", 403);
  }
  const id = cleanId(input?.id);
  const spec = ACTIONS[String(input?.action || "")];
  if (!id || !spec) {
    return fail("不能做这个操作");
  }
  return lock(id, async () => {
    const task = tasks.get(id);
    if (!task || !canSee(task, me.id)) {
      return fail("没有这条任务", 404);
    }
    if (task[spec.who] !== me.id) {
      return fail(spec.who === "assignee" ? "只有执行人能操作" : "只有检查人能操作", 403);
    }
    const revision = Number(input?.revision);
    if (revision !== task.revision) {
      return fail("任务已经更新，请刷新后再操作");
    }
    if (!spec.from.includes(task.status)) {
      return fail("当前状态不能做这个操作");
    }
    const note = clip(input?.note, 2000);
    if (spec.note && !note) {
      return fail(spec.to === "已退回" ? "退回必须填写原因" : "请填写执行结果");
    }
    const packed = spec.to === "待检查" ? takeFiles(input) : { ok: true, files: [] };
    if (!packed.ok) {
      return packed;
    }
    const stored = [];
    for (const file of packed.files) {
      const row = { id: randomUUID(), name: file.name, bytes: file.bytes, mime: file.mime, taskId: id };
      await saveFile(row);
      stored.push({ id: row.id, name: row.name });
    }
    const now = shanghaiStamp();
    task.status = spec.to;
    task.revision += 1;
    task.updated_at = now;
    task.events.push({
      id: randomUUID(),
      action: ACTION_LABEL[input.action],
      actor: me.id,
      at: now,
      note,
      files: stored
    });
    await saveTask(task);
    if (spec.notice) {
      const target = task[spec.notice];
      const text =
        spec.notice === "reviewer"
          ? `任务「${task.title}」已提交检查。`
          : `任务「${task.title}」被退回。${note}`;
      await tell(target, spec.notice === "reviewer" ? "任务待检查" : "任务被退回", text);
    }
    return { ok: true, task: view(task) };
  });
}

export async function readTaskFile(user, fileId) {
  await ready();
  const me = await meOf(user);
  const id = cleanId(fileId);
  if (!me || !id) {
    return fail("没有这个附件", 404);
  }
  const task = [...tasks.values()].find((item) => canSee(item, me.id) && [...item.files, ...item.events.flatMap((event) => event.files)].some((file) => file.id === id));
  if (!task) {
    return fail("没有这个附件", 404);
  }
  const meta = [...task.files, ...task.events.flatMap((event) => event.files)].find((file) => file.id === id);
  let bytes = fileBytes.get(id);
  if (!bytes && dbMode() === "mysql") {
    const [rows] = await query("SELECT bytes FROM work_report_task_file WHERE id = ?", [id]);
    bytes = rows[0]?.bytes || null;
  }
  if (!bytes) {
    return fail("没有这个附件", 404);
  }
  return { ok: true, name: meta.name, data: Buffer.from(bytes).toString("base64") };
}
