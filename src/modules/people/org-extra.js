import { listOrgStores } from "./org-board.js";

function clone(row) {
  return { ...row };
}

function seedValues() {
  return [
    { id: 1, person: "张文静", title: "群消息当日回完", note: "店群沟通不过夜", status: "践行中", demo: true },
    { id: 2, person: "王博", title: "日报当日交", note: "两店日报不过夜", status: "已完成", demo: true },
    { id: 3, person: "杨润泽", title: "带教复盘每周一次", note: "崔安琪 / 郭哲宁", status: "践行中", demo: true }
  ];
}

function seedNotices() {
  return [
    {
      id: 1,
      title: "本周店群日报时间",
      body: "每日 18:00 前提交店群日报，超时在群里说明。",
      status: "active",
      author: "组织中心",
      at: "2026-09-09 18:00",
      demo: true
    }
  ];
}

let values = seedValues();
let nextValueId = 4;
let notices = seedNotices();
let nextNoticeId = 2;

export function resetOrgExtra() {
  values = seedValues();
  nextValueId = 4;
  notices = seedNotices();
  nextNoticeId = 2;
}

export function listLeaderboard(actor) {
  const stores = listOrgStores({}, actor);
  const byOwner = new Map();
  const byTeam = new Map();
  for (const row of stores) {
    if (row.statusKey === "closed") {
      continue;
    }
    const owner = row.owner || "未指定";
    const team = row.team || row.chief || "未分组";
    const ownerRow = byOwner.get(owner) || { name: owner, stores: 0, operating: 0, idle: 0 };
    ownerRow.stores += 1;
    if (row.statusKey === "idle") {
      ownerRow.idle += 1;
    } else {
      ownerRow.operating += 1;
    }
    byOwner.set(owner, ownerRow);
    const teamRow = byTeam.get(team) || { name: team, stores: 0, people: new Set() };
    teamRow.stores += 1;
    teamRow.people.add(owner);
    byTeam.set(team, teamRow);
  }
  const people = [...byOwner.values()]
    .sort((a, b) => b.operating - a.operating || b.stores - a.stores)
    .map((row, index) => ({ rank: index + 1, name: row.name, stores: row.stores, operating: row.operating, idle: row.idle }));
  const teams = [...byTeam.values()]
    .sort((a, b) => b.stores - a.stores)
    .map((row, index) => ({
      rank: index + 1,
      name: row.name,
      stores: row.stores,
      people: row.people.size
    }));
  return { people, teams };
}

export function listValues() {
  return values.map(clone);
}

export function createValue(input) {
  const person = typeof input.person === "string" ? input.person.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";
  const status = typeof input.status === "string" && input.status.trim() ? input.status.trim() : "践行中";
  if (!person || !title) {
    return { ok: false, statusCode: 400, error: "人和践行事项为必填" };
  }
  const row = { id: nextValueId++, person, title, note, status, demo: false };
  values.unshift(row);
  return { ok: true, item: clone(row) };
}

export function listNotices(filter = {}) {
  const status = typeof filter.status === "string" ? filter.status.trim() : "";
  return notices
    .filter((row) => (status === "active" ? row.status === "active" : true))
    .map(clone);
}

export function noticeStats() {
  return {
    active: notices.filter((row) => row.status === "active").length,
    total: notices.length
  };
}

export function createNotice(input, actor) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!title || !body) {
    return { ok: false, statusCode: 400, error: "标题和正文为必填" };
  }
  const row = {
    id: nextNoticeId++,
    title,
    body,
    status: "active",
    author: actor || "组织中心",
    at: new Date().toISOString().slice(0, 16).replace("T", " "),
    demo: false
  };
  notices.unshift(row);
  return { ok: true, item: clone(row) };
}
