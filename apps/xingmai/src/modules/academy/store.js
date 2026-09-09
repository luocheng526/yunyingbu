import { dbMode, query } from "../profile/auth.js";
import { getDoc, listCatalog, listDocs, listLessonIds, searchDocs } from "./catalog.js";
import {
  getExamTrack,
  handbookTree,
  listCourses,
  listExamTracks,
  plan
} from "./framework.js";

const memoryProgress = new Map();

function progressKey(username, lessonId) {
  return `${username}::${lessonId}`;
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function ensureTable() {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(`
    CREATE TABLE IF NOT EXISTS academy_progress (
      username VARCHAR(64) NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      course_id VARCHAR(64) NOT NULL,
      done TINYINT NOT NULL DEFAULT 1,
      updated_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (username, lesson_id)
    )
  `);
}

export function catalog() {
  return listCatalog();
}

export function docs(filters) {
  return listDocs(filters);
}

export function doc(id, options) {
  return getDoc(id, options);
}

export function search(query, options) {
  return searchDocs(query, options);
}

export function frameworkPlan() {
  return plan();
}

export function courses() {
  return listCourses();
}

export function examTracks() {
  return listExamTracks();
}

export function examTrack(id) {
  return getExamTrack(id);
}

export function handbook() {
  return handbookTree();
}

export async function listProgress(username) {
  const who = String(username || "").trim();
  if (!who) {
    return [];
  }
  if (dbMode() === "mysql") {
    await ensureTable();
    const [rows] = await query(
      "SELECT course_id, lesson_id, done, updated_at FROM academy_progress WHERE username = ? ORDER BY updated_at ASC",
      [who]
    );
    return rows.map((row) => ({
      courseId: row.course_id,
      lessonId: row.lesson_id,
      docId: row.lesson_id,
      done: Boolean(Number(row.done)),
      updatedAt: row.updated_at
    }));
  }
  const out = [];
  for (const [key, value] of memoryProgress) {
    if (key.startsWith(`${who}::`)) {
      out.push({ ...value });
    }
  }
  return out;
}

export async function setProgress(username, body = {}) {
  const who = String(username || "").trim();
  const lesson = String(body.docId || body.lessonId || "").trim();
  const known = listLessonIds().find((item) => item.lessonId === lesson);
  const course = String(body.courseId || body.categoryId || known?.courseId || "").trim();
  if (!who) {
    const error = new Error("未登录");
    error.statusCode = 401;
    throw error;
  }
  if (!known) {
    const error = new Error("课件不存在或未发布");
    error.statusCode = 404;
    throw error;
  }
  const row = {
    courseId: course || known.courseId,
    lessonId: lesson,
    docId: lesson,
    done: body.done !== false && body.done !== "false",
    updatedAt: nowSql()
  };
  if (dbMode() === "mysql") {
    await ensureTable();
    if (!row.done) {
      await query("DELETE FROM academy_progress WHERE username = ? AND lesson_id = ?", [who, lesson]);
      return row;
    }
    await query(
      `INSERT INTO academy_progress (username, lesson_id, course_id, done, updated_at)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE done = 1, course_id = VALUES(course_id), updated_at = VALUES(updated_at)`,
      [who, lesson, row.courseId, row.updatedAt]
    );
    return row;
  }
  const key = progressKey(who, lesson);
  if (!row.done) {
    memoryProgress.delete(key);
    return row;
  }
  memoryProgress.set(key, row);
  return row;
}

export function resetProgressForTests() {
  memoryProgress.clear();
}
