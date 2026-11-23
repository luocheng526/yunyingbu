/* 工作任务：发布、执行、检查走同一条记录。 */
import { randomUUID } from "node:crypto";
import { dbMode, query, getPool } from "../profile/auth.js";
import { access, canAssign, taskVisible, canEditTask, allowedReviewers, taskScope } from './center-access.js';
import { fault, copy, writeRecord, stamp } from './center-db.js';
import { dingUserOf, sendTaskNotice, workLink } from "./dingtalk.js";
import { matchPerson, orgPeople } from "./store.js";
import { parseRichContent, bindRichFiles, richPlainText } from "./rich-content.js";

const tasks = new Map();
const fileBytes = new Map();
const tails = new Map();
let readyP = null;
let notify = defaultNotify;

const QUEUES = new Set(["published", "mine", "review", "all", "team"]);
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
  if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(text)) return '';
  const parsed = new Date(text + '+08:00');
  return Number.isNaN(parsed.getTime()) || new Date(parsed.getTime()+8*3600000).toISOString().slice(0,16)!==text ? '' : text;
}

function lock(id, fn) {
  const prev = tails.get(id) || Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(id, run.then(() => {}, () => {}));
  return run;
}

async function defaultNotify(personId, title, text, url) {
  const userid = dingUserOf(personId);
  if (!userid) {
    return false;
  }
  const person = (await peopleMap()).get(String(personId));
  try {
    return await sendTaskNotice(userid, title, text, url, "去处理", person ? taskPersonName(person) : "");
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
  return copy(task);
}
async function saveTask(task, files = [], expected = 0) {
  if (dbMode() === 'mysql') {
    const conn = await (await getPool()).getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT body FROM work_report_task WHERE id = ? FOR UPDATE', [task.id]);
      const old = rows.length ? JSON.parse(rows[0].body) : null;
      if ((old?.revision || 0) !== expected) fault('任务已经更新，请刷新后操作', 409);
      for (const file of files) await conn.query('INSERT INTO work_report_task_file (id,task_id,name,mime,bytes) VALUES (?,?,?,?,?)', [file.id, task.id, file.name, file.mime, file.bytes]);
      await conn.query('INSERT INTO work_report_task (id,body) VALUES (?,?) ON DUPLICATE KEY UPDATE body=VALUES(body)', [task.id, JSON.stringify(task)]);
      await conn.commit();
    } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
  } else if ((tasks.get(task.id)?.revision || 0) !== expected) fault('任务已经更新，请刷新后操作', 409);
  for (const file of files) fileBytes.set(file.id, file.bytes);
  tasks.set(task.id, copy(task));
}
export async function visibleTasks(user) {
  await ready(); const ctx = await access(user);
  if (dbMode() === 'mysql') {
    const [rows] = await query('SELECT body FROM work_report_task');
    tasks.clear(); for (const row of rows) { const task = JSON.parse(row.body); tasks.set(task.id, task); }
  }
  return { ctx, rows: [...tasks.values()].map(t => taskScope(t, ctx)).filter(t => taskVisible(ctx, t)).map(view) };
}
export function exportTasks() { return { tasks: [...tasks.values()].map(copy), files: [...fileBytes.entries()].map(([id, bytes]) => [id, bytes.toString('base64')]) }; }
export function importTasks(data) { tasks.clear(); fileBytes.clear(); for (const task of data?.tasks || []) tasks.set(task.id, copy(task)); for (const [id, bytes] of data?.files || []) fileBytes.set(id, Buffer.from(bytes,'base64')); }


function takeFiles(input) {
  const list = Array.isArray(input?.files) ? input.files : [];
  if (list.length > 3) {
    return fail("最多上传 3 个附件，合计 3 MB");
  }
  const files = [];
  let total = 0;
  for (const item of list) {
    const name = clip(String(item?.name || "").split(/[/\\]/).pop(), 80);
    if (!/\.(png|jpe?g|webp|gif|bmp|pdf|txt|csv|xlsx?|docx?|pptx?|zip)$/i.test(name)) return fail('附件支持图片、PDF、Office 文档、文本和 ZIP');
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

async function tell(personId, title, text, url) {
  try {
    await writeRecord('notice', randomUUID(), { personId, title, text, url, createdAt: stamp(), readAt: null });
    await notify(personId, title, text, url);
  } catch {
    /* 通知失败不回滚任务。 */
  }
}

function dueText(value) {
  return String(value || "").slice(0, 16).replace("T", " ");
}

function taskPersonName(person) {
  const username = String(person.username || "").trim().toLowerCase();
  if (username === "罗成" || username === "luocheng") {
    return "罗成";
  }
  return person.name;
}

export async function taskContext(user) {
  await ready(); const ctx = await access(user);
  return { ok:true, me:ctx.me.id, role:ctx.me.role, today:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),
    people:ctx.active.filter(p => canAssign(ctx,p) || p.id === ctx.me.id).map(p=>({id:p.id,name:p.name,role:p.role,teamId:p.teamId,teamName:p.teamName,supervisorId:p.supervisorId})),
    reviewers:ctx.active.filter(p=>ctx.manager ? p.role==='主管'||p.id===ctx.me.id : p.id===ctx.me.id).map(p=>({id:p.id,name:p.name})), canPublish:ctx.active.some(p=>canAssign(ctx,p)) };
}
export async function listTasks(user, queue) {
  if (!QUEUES.has(String(queue||''))) return fail('任务列表不存在');
  const {ctx,rows} = await visibleTasks(user);
  return {ok:true, me:ctx.me.id, rows:rows.filter(t => queue==='published' ? t.publisher===ctx.me.id : queue==='mine' ? t.assignee===ctx.me.id || (t.collaborators||[]).includes(ctx.me.id) : queue==='review' ? t.reviewer===ctx.me.id : true).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))};
}

export async function publishTask(user, input) {
  await ready();
  const ctx = await access(user); const me = ctx.me;
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
    const reviewer = String(input?.reviewer || me.id);
    if (assignee === reviewer) return fail('检查人和执行人必须为不同人员');
    const target = ctx.byId.get(assignee);
    if (!canAssign(ctx,target)) return fail('没有向此员工分派任务的权限',403);
    if (!allowedReviewers(ctx,target).some(p=>p.id===reviewer)) return fail('验收人不在授权范围内',403);
    const parentId = String(input?.parent_id || '');
    const parent = parentId ? tasks.get(parentId) : null;
    if (parentId && (!parent || !taskVisible(ctx,parent) || (!ctx.manager && parent.assignee!==me.id))) return fail('无权拆分此任务',403);
    if (parent && ['已完成','已取消','待检查'].includes(parent.status)) return fail('父任务当前状态不能拆分');
    const collaborators = [...new Set(Array.isArray(input?.collaborators) ? input.collaborators.map(String) : [])].filter(id=>id!==assignee);
    if (collaborators.some(id=>!canAssign(ctx,ctx.byId.get(id)))) return fail('协作人不在可分派范围内',403);
    const shopId = String(input?.shop_id || '');
    if (shopId && !ctx.bundle.shops.some(s=>String(s.id)===shopId && (target.visibleShops||[]).includes(s.name))) return fail('店铺不在负责人的职责范围内');
    const category = ctx.config.categories.includes(input?.category) ? input.category : ctx.config.categories[0];
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
    let descriptionDoc;
    let criteriaDoc;
    try {
      descriptionDoc = parseRichContent(input?.description_doc, packed.files, 4000);
      criteriaDoc = parseRichContent(input?.criteria_doc, packed.files, 2000);
    } catch (err) {
      return fail(err.message);
    }
    const now = shanghaiStamp();
    const eventId = randomUUID();
    const files = packed.files.map((file) => ({ id: randomUUID(), name: file.name, bytes: file.bytes, mime: file.mime, taskId: id }));

    const task = {
      id,
      title,
      description: richPlainText(descriptionDoc, description),
      criteria: richPlainText(criteriaDoc, criteria),
      description_doc: bindRichFiles(descriptionDoc, files),
      criteria_doc: bindRichFiles(criteriaDoc, files),
      publisher: me.id,
      created_at: now,
      team_id: target.teamId, team_name: target.teamName, supervisor_id: target.supervisorId,
      publisher_role: me.role, source: me.role + '发布', parent_id: parentId, collaborators,
      assignee_name: target.name, publisher_name: me.name, reviewer_name: ctx.byId.get(reviewer)?.name || '',
      shop_id: shopId, shop_name: ctx.bundle.shops.find(s=>String(s.id)===shopId)?.name || '',
      category, priority: ['紧急','高','普通','低'].includes(input?.priority) ? input.priority : '普通',
      original_due_at: dueAt, progress: 0, returned: false, return_count: 0, blocked: false, delayed: false,
      assignee,
      reviewer,
      start_at: startAt,
      due_at: dueAt,
      status: "待执行",
      revision: 1,
      updated_at: now,
      files: files.map((file) => ({ id: file.id, name: file.name, mime: file.mime })),
      events: [
        {
          id: eventId,
          action: ACTION_LABEL.publish,
          actor: me.id,
          actor_name: me.name,
          at: now,
          note: "",
          files: files.map((file) => ({ id: file.id, name: file.name }))
        }
      ]
    };
    await saveTask(task, files, 0);
    await tell(assignee, "新的工作任务", `我的任务「${title}」，截止 ${dueText(dueAt)}。`, workLink("taskMine", id));
    return { ok: true, task: view(task) };
  });
}

export async function actTask(user, input) {
  const {ctx} = await visibleTasks(user); const me = ctx.me;
  const id=cleanId(input?.id); if(!id) return fail('任务编号无效');
  return lock(id, async()=>{
    const original=tasks.get(id); if(!original || !taskVisible(ctx,original)) return fail('没有这条任务',404);
    const task=copy(original); const revision=Number(input?.revision);
    if(revision!==task.revision) return fail('任务已经更新，请刷新后再操作',409);
    const action=String(input?.action||''); const note=clip(input?.note,2000); const now=shanghaiStamp();
    const terminal=['已完成','已取消'].includes(task.status); const editor=canEditTask(ctx,task);
    const actor=task.assignee===me.id; const reviewer=task.reviewer===me.id;
    const changed={}; let stored=[]; let notice='';
    const requireNote=()=>{if(!note) fault('请填写说明或原因');};
    if(action==='start') {
      if(!actor || !['待执行','已退回'].includes(task.status)) return fail('当前状态不能开始执行',403);
      task.status='进行中'; task.started_at ||= now;
    } else if(action==='progress') {
      if(!actor || terminal || task.status==='待检查') return fail('无权更新此任务进度',403);
      requireNote(); const progress=Number(input?.progress);
      if(!Number.isFinite(progress)||progress<0||progress>100) return fail('进度应在 0～100 之间');
      changed.progress={before:task.progress||0,after:progress}; task.progress=progress; task.blocked=Boolean(input?.blocked); task.status='进行中';
    } else if(action==='submit') {
      if(!actor || !['待执行','进行中','已退回'].includes(task.status)) return fail('无权提交此任务',403);
      requireNote();
      if([...tasks.values()].some(t=>t.parent_id===id&&!['已完成','已取消'].includes(t.status))) return fail('请先完成所有子任务的验收');
      const packed=takeFiles(input); if(!packed.ok)return packed;
      if(ctx.config.requiredAttachmentCategories.includes(task.category)&&!packed.files.length) return fail('此类任务提交成果时必须附带文件');
      stored=packed.files.map(f=>({...f,id:randomUUID(),taskId:id}));
      const links=Array.isArray(input?.links)?input.links:[];
      if(links.some(link=>!/^https?:\/\//i.test(String(link)))) return fail('成果链接必须使用 http 或 https');
      changed.links=links.map(link=>String(link).slice(0,1000));
      task.status='待检查'; task.first_submitted_at ||= now; task.submitted_at=now; task.progress=100; task.blocked=false; task.returned=false; notice=task.reviewer;
    } else if(action==='approve' || action==='return') {
      if(!reviewer || task.status!=='待检查') return fail('只有指定验收人可以处理待验收任务',403);
      if(action==='return') {requireNote();task.status='进行中';task.returned=true;task.return_count=(task.return_count||0)+1;notice=task.assignee;}
      else {task.status='已完成';task.completed_at=now;task.accepted_submission_at=task.submitted_at||'';task.returned=false;}
    } else if(action==='edit') {
      if(!editor || terminal) return fail('无权修改此任务',403); requireNote();
      for(const key of ['title','description','criteria','due_at','reviewer','assignee','priority']) {
        if(!Object.hasOwn(input,key))continue; const value=clip(input[key],key==='description'?4000:2000);
        if(value===String(task[key]||''))continue;
        if(key==='title'&&!value) return fail('标题不能为空');
        if(key==='due_at'&&(!clock(value)||clock(value)<task.start_at))return fail('截止时间不合法');
        if(key==='assignee'&&!canAssign(ctx,ctx.byId.get(value)))return fail('负责人不在授权范围内',403);
        if(key==='priority'&&!['紧急','高','普通','低'].includes(value))return fail('优先级不合法');
        changed[key]={before:task[key]||'',after:value}; task[key]=value;
      }
      if(task.assignee===task.reviewer)return fail('执行人与验收人不能相同');
      if((changed.assignee||changed.reviewer)&&!allowedReviewers(ctx,ctx.byId.get(task.assignee)).some(p=>p.id===task.reviewer))return fail('请为调整后的负责人选择授权范围内的验收人',403);
      // Text edits replace the current text while retaining original rich content in the audit trail.
      for(const key of ['description','criteria']) if(changed[key]) {
        changed[key].beforeDoc=copy(task[key+'_doc']||null);
        const images=(task[key+'_doc']||[]).filter(n=>n.type==='image');
        task[key+'_doc']=[{type:'text',text:task[key]},...images];
      }
      if(changed.assignee){task.assignee_name=ctx.byId.get(task.assignee)?.name||'';task.status='待执行';task.progress=0;}
      if(changed.reviewer)task.reviewer_name=ctx.byId.get(task.reviewer)?.name||'';
      task.original_due_at ||= original.due_at; task.delayed=task.due_at>task.original_due_at;
    } else if(action==='cancel') {
      if(!editor || terminal)return fail('无权取消此任务',403); requireNote();
      if([...tasks.values()].some(t=>t.parent_id===id&&!['已完成','已取消'].includes(t.status)))return fail('请先处理未完成子任务');
      task.status='已取消';task.cancelled_at=now;
    } else if(action==='review') {
      if(!ctx.manager || task.status!=='已完成')return fail('只有经理可以复核已完成任务',403);requireNote();task.manager_review={actor:me.id,at:now,note};
    } else if(action==='confirmTeam') {
      if(!ctx.manager || task.team_id)return fail('只有经理可以确认历史任务归属',403);requireNote();
      const lead=ctx.byId.get(String(input.supervisor_id));if(lead?.role!=='主管')return fail('请选择主管');
      changed.team_id={before:'',after:lead.teamId};task.team_id=lead.teamId;task.team_name=lead.teamName;task.supervisor_id=lead.id;
    } else return fail('不支持此操作');
    const labels={start:'开始执行',progress:'更新进度',submit:'提交检查',approve:'检查通过',return:'退回修改',edit:'修改任务',cancel:'取消任务',review:'经理复核',confirmTeam:'确认历史归属'};
    task.revision++;task.updated_at=now;
    task.events.push({id:randomUUID(),action:labels[action],actor:me.id,actor_name:me.name,at:now,note,changes:changed,files:stored.map(f=>({id:f.id,name:f.name,mime:f.mime}))});
    await saveTask(task,stored,revision);
    if(notice) await tell(notice,action==='submit'?'任务待检查':'任务被退回',task.title+' '+note+' 截止 '+dueText(task.due_at),workLink(action==='submit'?'taskReview':'taskMine',id));
    return {ok:true,task:view(task)};
  });
}

export async function taskCounts(user) {
  await ready();
  const me = await meOf(user);
  if (!me) {
    return { mine: 0, review: 0 };
  }
  let mine = 0;
  let review = 0;
  for (const task of tasks.values()) {
    if (task.assignee === me.id && ["待执行", "进行中", "已退回"].includes(task.status)) {
      mine += 1;
    }
    if (task.reviewer === me.id && task.status === "待检查") {
      review += 1;
    }
  }
  return { mine, review };
}

export async function readTaskFile(user, fileId) {
  await ready();
  const me = await meOf(user);
  const id = cleanId(fileId);
  if (!me || !id) {
    return fail("没有这个附件", 404);
  }
  const ctx = await access(user);
  const task = [...tasks.values()].find((item) => taskVisible(ctx, item) && [...item.files, ...item.events.flatMap((event) => event.files)].some((file) => file.id === id));
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
  return { ok: true, name: meta.name, mime: meta.mime || "application/octet-stream", data: Buffer.from(bytes).toString("base64") };
}
