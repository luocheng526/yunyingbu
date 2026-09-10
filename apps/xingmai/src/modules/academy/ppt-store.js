import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dbMode, query } from "../profile/auth.js";
import { READ_PPTX_PY } from "./read-pptx-script.js";

const execFileAsync = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data", "courses");
const READER = join(ROOT, "read-pptx.py");
const CATEGORIES = ["选品与商品", "流量与投放", "转化与页面", "数据与复盘", "大促节奏"];

async function ensureReader() {
  await writeFile(READER, READ_PPTX_PY);
}

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

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

async function ensureSlideRenders(id) {
  const safe = safeCourseId(id);
  if (!safe) {
    return;
  }
  const dir = join(DATA_DIR, safe);
  const source = join(dir, "source.pptx");
  if (!(await fileExists(source))) {
    return;
  }
  const pages = await readPages(id);
  let need = !pages.length;
  for (const page of pages) {
    const name = page.slide || `slide-${page.index}.png`;
    if (!String(name).startsWith("slide-") || !(await fileExists(join(dir, "media", name)))) {
      need = true;
      break;
    }
  }
  if (!need) {
    return;
  }
  try {
    await ensureReader();
    await execFileAsync("python3", [READER, source, dir], {
      timeout: 180000,
      env: { ...process.env, HOME: "/tmp", LANG: process.env.LANG || "C.UTF-8" }
    });
  } catch {
    /* keep existing pages.json */
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
  const slideName = page.slide || ((page.images || [])[0] || "");
  const slide = slideName
    ? {
        name: slideName,
        url: `/api/academy/courses/${id}/pages/${page.index}/media/${encodeURIComponent(slideName)}`
      }
    : null;
  return {
    index: page.index,
    slide,
    hasMedia: Boolean(slide)
  };
}

export async function listPptPages(id) {
  const course = await getPptCourse(id, { allowUnpublished: true });
  if (!course) {
    return null;
  }
  await ensureSlideRenders(id);
  const pages = await readPages(id);
  return {
    ...course,
    pageCount: pages.length,
    pages: pages.map((page) => pagePayload(id, page))
  };
}

export async function getPptPage(id, index) {
  const course = await getPptCourse(id, { allowUnpublished: true });
  if (!course) {
    return null;
  }
  await ensureSlideRenders(id);
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
  await ensureSlideRenders(id);
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
    await ensureReader();
    await execFileAsync("python3", [READER, source, dir], {
      timeout: 180000,
      env: { ...process.env, HOME: "/tmp", LANG: process.env.LANG || "C.UTF-8" }
    });
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

const CHUNK_MAX = 128 * 1024;
const TOTAL_MAX = 80 * 1024 * 1024;
const uploads = new Map();

function safeUploadId(id) {
  const value = String(id || "");
  return /^[a-z0-9-]{8,80}$/i.test(value) ? value : "";
}

export async function receivePptChunk({
  uploadId,
  index,
  total,
  size,
  title,
  category,
  published,
  filename,
  buffer,
  createdBy
}) {
  const id = safeUploadId(uploadId);
  if (!id) {
    const error = new Error("上传会话无效");
    error.statusCode = 400;
    throw error;
  }
  const i = Number(index);
  const n = Number(total);
  const bytes = Number(size) || 0;
  if (!Number.isInteger(i) || !Number.isInteger(n) || i < 0 || n < 1 || i >= n) {
    const error = new Error("分片参数不对");
    error.statusCode = 400;
    throw error;
  }
  if (n > 640 || bytes > TOTAL_MAX) {
    const error = new Error("文件太大，最多 80MB");
    error.statusCode = 413;
    throw error;
  }
  if (!buffer || buffer.length === 0 || buffer.length > CHUNK_MAX) {
    const error = new Error("分片过大");
    error.statusCode = 413;
    throw error;
  }
  let session = uploads.get(id);
  if (!session) {
    session = {
      title,
      category,
      published,
      filename,
      size: bytes,
      total: n,
      createdBy,
      parts: new Array(n)
    };
    uploads.set(id, session);
  }
  session.parts[i] = Buffer.from(buffer);
  const got = session.parts.filter(Boolean).length;
  if (got < n) {
    return { pending: true, received: got, total: n };
  }
  const assembled = Buffer.concat(session.parts);
  uploads.delete(id);
  if (session.size && assembled.length !== session.size) {
    const error = new Error("文件不完整，请重新上传");
    error.statusCode = 400;
    throw error;
  }
  const course = await createPptCourse({
    title: session.title,
    category: session.category,
    published: session.published,
    file: { filename: session.filename || "course.pptx", buffer: assembled },
    createdBy: session.createdBy
  });
  return { pending: false, course };
}

export async function resetPptCoursesForTests() {
  memory = [];
  uploads.clear();
  await rm(DATA_DIR, { recursive: true, force: true });
  await mkdir(DATA_DIR, { recursive: true });
}

export { DATA_DIR };
