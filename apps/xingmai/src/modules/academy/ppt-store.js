import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dbMode, query } from "../profile/auth.js";

const execFileAsync = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data", "courses");
const READER = join(ROOT, "read-pptx.py");
const CATEGORIES = ["选品与商品", "流量与投放", "转化与页面", "数据与复盘", "大促节奏"];

let memory = [];

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function publicCourse(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    published: Boolean(row.published),
    pageCount: Number(row.pageCount) || 0,
    originalName: row.originalName,
    createdAt: row.createdAt,
    download: false,
    watermark: true
  };
}

async function ensureCoursesTable() {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(`
    CREATE TABLE IF NOT EXISTS academy_ppt_courses (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      category VARCHAR(64) NOT NULL,
      published TINYINT NOT NULL DEFAULT 1,
      page_count INT NOT NULL DEFAULT 0,
      original_name VARCHAR(255) NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      created_at VARCHAR(32) NOT NULL
    )
  `);
}

function safeCourseId(id) {
  const value = String(id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return "";
  }
  return value;
}

async function courseDir(id) {
  const safe = safeCourseId(id);
  if (!safe) {
    const error = new Error("课件不存在");
    error.statusCode = 404;
    throw error;
  }
  const dir = join(DATA_DIR, safe);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function courseCategories() {
  return CATEGORIES.slice();
}

export async function listPptCourses({ includeUnpublished = true } = {}) {
  if (dbMode() === "mysql") {
    await ensureCoursesTable();
    const [rows] = await query(
      "SELECT id, title, category, published, page_count, original_name, created_at FROM academy_ppt_courses ORDER BY created_at DESC"
    );
    return rows
      .map((row) =>
        publicCourse({
          id: row.id,
          title: row.title,
          category: row.category,
          published: row.published,
          pageCount: row.page_count,
          originalName: row.original_name,
          createdAt: row.created_at
        })
      )
      .filter((item) => includeUnpublished || item.published);
  }
  return memory
    .map((item) => publicCourse(item))
    .filter((item) => includeUnpublished || item.published);
}

export async function getPptCourse(id, { allowUnpublished = true } = {}) {
  const safe = safeCourseId(id);
  if (!safe) {
    return null;
  }
  const rows = await listPptCourses({ includeUnpublished: true });
  const hit = rows.find((item) => item.id === safe);
  if (!hit || (!hit.published && !allowUnpublished)) {
    return null;
  }
  return hit;
}

async function readPages(id) {
  const safe = safeCourseId(id);
  if (!safe) {
    return [];
  }
  const file = join(DATA_DIR, safe, "pages.json");
  try {
    const raw = await readFile(file, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.pages) ? data.pages : [];
  } catch {
    return [];
  }
}

function mediaType(name) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".png")) {
    return "image/png";
  }
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (n.endsWith(".gif")) {
    return "image/gif";
  }
  if (n.endsWith(".webp")) {
    return "image/webp";
  }
  return "application/octet-stream";
}

function pagePayload(id, page) {
  const images = (page.images || []).map((name) => ({
    name,
    url: `/api/academy/courses/${id}/pages/${page.index}/media/${encodeURIComponent(name)}`
  }));
  return {
    index: page.index,
    texts: Array.isArray(page.texts) ? page.texts : [],
    images,
    hasMedia: images.length > 0
  };
}

export async function getPptPage(id, index) {
  const course = await getPptCourse(id, { allowUnpublished: true });
  if (!course) {
    return null;
  }
  const pages = await readPages(id);
  const page = pages.find((item) => Number(item.index) === Number(index));
  if (!page) {
    return null;
  }
  return {
    ...course,
    pageCount: pages.length,
    page: pagePayload(id, page)
  };
}

export { mediaType };

export async function readPptMedia(id, name) {
  const courseId = safeCourseId(id);
  const safe = String(name || "").replace(/[^A-Za-z0-9._-]/g, "");
  if (!courseId || !safe || safe !== name) {
    const error = new Error("媒体不存在");
    error.statusCode = 404;
    throw error;
  }
  const file = join(DATA_DIR, courseId, "media", safe);
  try {
    return await readFile(file);
  } catch {
    const error = new Error("媒体不存在");
    error.statusCode = 404;
    throw error;
  }
}

function isPptx(filename, buffer) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".ppt") && !name.endsWith(".pptx")) {
    return false;
  }
  return name.endsWith(".pptx") && buffer && buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

export async function createPptCourse({ title, category, published = true, file, createdBy }) {
  const name = String(title || "").trim();
  const cat = String(category || "").trim();
  if (!name) {
    const error = new Error("请填写课件标题");
    error.statusCode = 400;
    throw error;
  }
  if (!CATEGORIES.includes(cat)) {
    const error = new Error("请选择运营分类");
    error.statusCode = 400;
    throw error;
  }
  if (!file || !file.buffer || !file.filename) {
    const error = new Error("请上传 PPTX 文件");
    error.statusCode = 400;
    throw error;
  }
  if (!isPptx(file.filename, file.buffer)) {
    const error = new Error("请另存为 .pptx 再上传（不支持旧版 .ppt）");
    error.statusCode = 400;
    throw error;
  }
  const id = randomUUID();
  const dir = await courseDir(id);
  const source = join(dir, "source.pptx");
  await writeFile(source, file.buffer);
  try {
    await execFileAsync("python3", [READER, source, dir], { timeout: 20000 });
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    const error = new Error(err.stderr ? String(err.stderr).trim() : "无法解析 PPTX");
    error.statusCode = 400;
    throw error;
  }
  const pages = await readPages(id);
  const row = {
    id,
    title: name,
    category: cat,
    published: published !== false && published !== "false" && published !== "0",
    pageCount: pages.length,
    originalName: String(file.filename).slice(0, 180),
    createdBy: String(createdBy || ""),
    createdAt: nowSql(),
    hash: createHash("sha256").update(file.buffer).digest("hex").slice(0, 16)
  };
  if (dbMode() === "mysql") {
    await ensureCoursesTable();
    await query(
      `INSERT INTO academy_ppt_courses
        (id, title, category, published, page_count, original_name, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.category,
        row.published ? 1 : 0,
        row.pageCount,
        row.originalName,
        row.createdBy,
        row.createdAt
      ]
    );
  } else {
    memory.unshift(row);
  }
  return publicCourse(row);
}

export async function resetPptCoursesForTests() {
  memory = [];
  await rm(DATA_DIR, { recursive: true, force: true });
  await mkdir(DATA_DIR, { recursive: true });
}

export { DATA_DIR };
