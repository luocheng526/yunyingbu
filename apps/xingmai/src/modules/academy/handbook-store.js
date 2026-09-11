import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dbMode, query } from "../profile/auth.js";
import { handbookTree as seedTree } from "./framework.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data", "handbook");
const TREE_FILE = join(DATA_DIR, "tree.json");
const MEDIA_DIR = join(DATA_DIR, "media");
const IMAGE_EXT = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };

let memoryTree = null;
const memorySections = new Map();

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function safeSectionId(id) {
  const value = String(id || "");
  return /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value) ? value : "";
}

function cloneTree(nodes) {
  return (nodes || []).map((item) => ({
    id: item.id,
    title: item.title,
    children: cloneTree(item.children)
  }));
}

function walk(nodes, visit, parent = null) {
  for (const node of nodes || []) {
    visit(node, parent);
    walk(node.children, visit, node);
  }
}

function findNode(nodes, id) {
  let hit = null;
  walk(nodes, (node) => {
    if (node.id === id) {
      hit = node;
    }
  });
  return hit;
}

function slugTitle(title) {
  const base = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "branch";
  const ascii = base.replace(/[^\w-]/g, "") || "branch";
  return `${ascii}-${randomBytes(3).toString("hex")}`;
}

async function ensureTable() {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(`
    CREATE TABLE IF NOT EXISTS academy_handbook_sections (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      parent_id VARCHAR(64) NOT NULL DEFAULT '',
      title VARCHAR(160) NOT NULL,
      body MEDIUMTEXT NOT NULL,
      sort INT NOT NULL DEFAULT 0,
      updated_at VARCHAR(32) NOT NULL
    )
  `);
}

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(MEDIA_DIR, { recursive: true });
  await mkdir(join(DATA_DIR, "sections"), { recursive: true });
}

function defaultTree() {
  return cloneTree(seedTree());
}

async function loadTree() {
  if (dbMode() !== "mysql" && memoryTree) {
    return cloneTree(memoryTree);
  }
  await ensureDirs();
  try {
    const raw = await readFile(TREE_FILE, "utf8");
    const data = JSON.parse(raw);
    const tree = Array.isArray(data.tree) ? data.tree : defaultTree();
    if (dbMode() !== "mysql") {
      memoryTree = cloneTree(tree);
    }
    return cloneTree(tree);
  } catch {
    const tree = defaultTree();
    await saveTree(tree);
    return cloneTree(tree);
  }
}

async function saveTree(tree) {
  await ensureDirs();
  const next = cloneTree(tree);
  if (dbMode() !== "mysql") {
    memoryTree = cloneTree(next);
  }
  await writeFile(TREE_FILE, JSON.stringify({ tree: next }, null, 2));
  if (dbMode() === "mysql") {
    await ensureTable();
    const rows = [];
    function walkSave(nodes, parentId, sortBase) {
      nodes.forEach((node, index) => {
        rows.push({
          id: node.id,
          parentId: parentId || "",
          title: node.title,
          sort: sortBase + index
        });
        walkSave(node.children || [], node.id, (sortBase + index + 1) * 10);
      });
    }
    walkSave(next, "", 0);
    for (const row of rows) {
      await query(
        `INSERT INTO academy_handbook_sections (id, parent_id, title, body, sort, updated_at)
         VALUES (?, ?, ?, '', ?, ?)
         ON DUPLICATE KEY UPDATE parent_id = VALUES(parent_id), title = VALUES(title), sort = VALUES(sort)`,
        [row.id, row.parentId, row.title, row.sort, nowSql()]
      );
    }
  }
}

async function sectionPath(id) {
  return join(DATA_DIR, "sections", `${safeSectionId(id)}.json`);
}

async function readSection(id) {
  const safe = safeSectionId(id);
  if (!safe) {
    return null;
  }
  if (dbMode() !== "mysql" && memorySections.has(safe)) {
    return { ...memorySections.get(safe) };
  }
  try {
    const data = JSON.parse(await readFile(await sectionPath(safe), "utf8"));
    return {
      id: safe,
      title: String(data.title || ""),
      body: String(data.body || ""),
      images: Array.isArray(data.images) ? data.images : []
    };
  } catch {
    if (dbMode() === "mysql") {
      await ensureTable();
      const [rows] = await query("SELECT id, title, body FROM academy_handbook_sections WHERE id = ?", [safe]);
      if (rows[0]) {
        return { id: safe, title: rows[0].title, body: String(rows[0].body || ""), images: [] };
      }
    }
    return { id: safe, title: "", body: "", images: [] };
  }
}

async function writeSection(row) {
  const safe = safeSectionId(row.id);
  const payload = {
    id: safe,
    title: String(row.title || "").slice(0, 160),
    body: String(row.body || "").slice(0, 50000),
    images: Array.isArray(row.images) ? row.images : []
  };
  await ensureDirs();
  await writeFile(await sectionPath(safe), JSON.stringify(payload, null, 2));
  if (dbMode() !== "mysql") {
    memorySections.set(safe, { ...payload });
  } else {
    await ensureTable();
    await query(
      `INSERT INTO academy_handbook_sections (id, parent_id, title, body, sort, updated_at)
       VALUES (?, '', ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), updated_at = VALUES(updated_at)`,
      [safe, payload.title, payload.body, nowSql()]
    );
  }
  return payload;
}

export async function getHandbookTree() {
  const tree = await loadTree();
  const decorate = async (nodes) => {
    const out = [];
    for (const node of nodes) {
      const section = await readSection(node.id);
      out.push({
        id: node.id,
        title: node.title,
        hasBody: Boolean(section && section.body),
        children: await decorate(node.children || [])
      });
    }
    return out;
  };
  return decorate(tree);
}

export async function getHandbookSection(id) {
  const tree = await loadTree();
  const node = findNode(tree, safeSectionId(id));
  if (!node) {
    return null;
  }
  const section = (await readSection(node.id)) || { body: "", images: [] };
  return {
    id: node.id,
    title: node.title,
    body: section.body || "",
    images: (section.images || []).map((name) => ({
      name,
      url: `/api/academy/handbook/media/${encodeURIComponent(name)}`
    }))
  };
}

export async function saveHandbookSection(id, { title, body, move, beforeId, parentId } = {}) {
  if (move === true || move === "true") {
    await moveHandbookNode({ id, beforeId, parentId });
    const section = await getHandbookSection(id);
    if (!section) {
      throw bad("没有这一节", 404);
    }
    return section;
  }
  const tree = await loadTree();
  const node = findNode(tree, safeSectionId(id));
  if (!node) {
    const error = new Error("没有这一节");
    error.statusCode = 404;
    throw error;
  }
  if (title != null) {
    const name = String(title).trim();
    if (!name) {
      const error = new Error("请填写章节标题");
      error.statusCode = 400;
      throw error;
    }
    node.title = name.slice(0, 160);
    await saveTree(tree);
  }
  const prev = (await readSection(node.id)) || { images: [] };
  const saved = await writeSection({
    id: node.id,
    title: node.title,
    body: body == null ? prev.body : String(body),
    images: prev.images
  });
  return getHandbookSection(node.id);
}

export async function addHandbookBranch({ parentId, title }) {
  const name = String(title || "").trim();
  if (!name) {
    const error = new Error("请填写分支标题");
    error.statusCode = 400;
    throw error;
  }
  const tree = await loadTree();
  const pid = safeSectionId(parentId);
  let id = slugTitle(name);
  while (findNode(tree, id)) {
    id = slugTitle(name);
  }
  const node = { id, title: name.slice(0, 160), children: [] };
  if (!pid) {
    tree.push(node);
  } else {
    const parent = findNode(tree, pid);
    if (!parent) {
      const error = new Error("请先点左侧一节，再加下级分支");
      error.statusCode = 400;
      throw error;
    }
    parent.children = parent.children || [];
    parent.children.push(node);
  }
  await saveTree(tree);
  await writeSection({ id, title: name.slice(0, 160), body: "", images: [] });
  return getHandbookSection(id);
}

function imageExt(filename, type) {
  const name = String(filename || "").toLowerCase();
  const hit = Object.keys(IMAGE_EXT).find((ext) => name.endsWith(ext));
  if (hit) {
    return hit;
  }
  if (String(type || "").includes("png")) {
    return ".png";
  }
  if (String(type || "").includes("jpeg") || String(type || "").includes("jpg")) {
    return ".jpg";
  }
  if (String(type || "").includes("gif")) {
    return ".gif";
  }
  if (String(type || "").includes("webp")) {
    return ".webp";
  }
  return "";
}

export function handbookMediaType(name) {
  const n = String(name || "").toLowerCase();
  for (const [ext, type] of Object.entries(IMAGE_EXT)) {
    if (n.endsWith(ext)) {
      return type;
    }
  }
  return "application/octet-stream";
}

function findParent(nodes, id) {
  let parent = null;
  let found = false;
  function walkFind(list, p) {
    for (const node of list || []) {
      if (found) {
        return;
      }
      if (node.id === id) {
        parent = p;
        found = true;
        return;
      }
      walkFind(node.children, node);
    }
  }
  walkFind(nodes, null);
  return found ? parent : undefined;
}

function isDescendant(node, id) {
  let hit = false;
  walk(node.children || [], (child) => {
    if (child.id === id) {
      hit = true;
    }
  });
  return hit;
}

function takeNode(nodes, id) {
  for (let i = 0; i < (nodes || []).length; i += 1) {
    if (nodes[i].id === id) {
      return nodes.splice(i, 1)[0];
    }
    const got = takeNode(nodes[i].children || [], id);
    if (got) {
      return got;
    }
  }
  return null;
}

function bad(message, code) {
  const error = new Error(message);
  error.statusCode = code;
  return error;
}

export async function moveHandbookNode({ id, beforeId, parentId }) {
  const tree = await loadTree();
  const sid = safeSectionId(id);
  if (!sid) {
    throw bad("请选择要移动的菜单", 400);
  }
  const moving = findNode(tree, sid);
  if (!moving) {
    throw bad("没有这一节", 404);
  }
  const before = safeSectionId(beforeId);
  if (before === sid) {
    return getHandbookTree();
  }
  let destParent = null;
  let destList = tree;
  if (before) {
    if (!findNode(tree, before)) {
      throw bad("放不下这个位置", 400);
    }
    destParent = findParent(tree, before);
    destList = destParent ? destParent.children : tree;
  } else if (safeSectionId(parentId)) {
    destParent = findNode(tree, safeSectionId(parentId));
    if (!destParent) {
      throw bad("没有这一节", 404);
    }
    destList = destParent.children || (destParent.children = []);
  }
  if (destParent && (destParent.id === sid || isDescendant(moving, destParent.id))) {
    throw bad("不能拖进自己的下级", 400);
  }
  const taken = takeNode(tree, sid);
  if (!taken) {
    throw bad("没有这一节", 404);
  }
  let index = destList.length;
  if (before) {
    const at = destList.findIndex((node) => node.id === before);
    index = at < 0 ? destList.length : at;
  }
  destList.splice(index, 0, taken);
  await saveTree(tree);
  return getHandbookTree();
}

export async function addHandbookImage(sectionId, file) {
  const section = await getHandbookSection(sectionId);
  if (!section) {
    const error = new Error("没有这一节");
    error.statusCode = 404;
    throw error;
  }
  if (!file || !file.buffer || !file.filename) {
    const error = new Error("请选择图片");
    error.statusCode = 400;
    throw error;
  }
  if (file.buffer.length > 5 * 1024 * 1024) {
    const error = new Error("图片太大，最多 5MB");
    error.statusCode = 413;
    throw error;
  }
  const ext = imageExt(file.filename, file.type);
  if (!ext) {
    const error = new Error("图片请用 png / jpg / gif / webp");
    error.statusCode = 400;
    throw error;
  }
  const name = `${section.id}-${randomBytes(4).toString("hex")}${ext}`;
  await ensureDirs();
  await writeFile(join(MEDIA_DIR, name), file.buffer);
  const prev = (await readSection(section.id)) || { images: [], body: section.body };
  const images = [...(prev.images || []), name];
  const mark = `![图](/api/academy/handbook/media/${name})`;
  const body = `${String(prev.body || "").trim()}\n${mark}`.trim();
  await writeSection({ id: section.id, title: section.title, body, images });
  return getHandbookSection(section.id);
}

export async function readHandbookMedia(name) {
  const safe = String(name || "").replace(/[^A-Za-z0-9._-]/g, "");
  if (!safe || safe !== name) {
    const error = new Error("图片不存在");
    error.statusCode = 404;
    throw error;
  }
  try {
    return await readFile(join(MEDIA_DIR, safe));
  } catch {
    const error = new Error("图片不存在");
    error.statusCode = 404;
    throw error;
  }
}

export async function resetHandbookForTests() {
  memoryTree = null;
  memorySections.clear();
  await rm(DATA_DIR, { recursive: true, force: true });
  await ensureDirs();
}

export { DATA_DIR };
