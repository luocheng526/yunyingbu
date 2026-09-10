import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dbMode, query } from "../profile/auth.js";
import { getExamTrack, listExamTracks } from "./framework.js";

const execFileAsync = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data", "exams");
const READER = join(ROOT, "read-exam.py");
const ACCEPT = [".xlsx", ".csv", ".json", ".docx", ".txt"];

let memory = new Map();

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function examAccept() {
  return ACCEPT.slice();
}

function safeTrackId(id) {
  const value = String(id || "");
  return listExamTracks().some((item) => item.id === value) ? value : "";
}

function publicPaper(row, { includeAnswers = false } = {}) {
  const questions = Array.isArray(row.questions) ? row.questions : [];
  return {
    ready: questions.length > 0,
    trackId: row.trackId,
    questionCount: questions.length,
    originalName: row.originalName,
    createdAt: row.createdAt,
    download: false,
    questions: questions.map((item) => {
      const out = {
        index: item.index,
        stem: item.stem,
        options: (item.options || []).map((opt) => ({ key: opt.key, text: opt.text }))
      };
      if (includeAnswers) {
        out.answer = item.answer;
      }
      return out;
    })
  };
}

async function ensureTable() {
  if (dbMode() !== "mysql") {
    return;
  }
  await query(`
    CREATE TABLE IF NOT EXISTS academy_exam_papers (
      track_id VARCHAR(64) NOT NULL PRIMARY KEY,
      question_count INT NOT NULL DEFAULT 0,
      original_name VARCHAR(255) NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      created_at VARCHAR(32) NOT NULL
    )
  `);
}

async function paperDir(trackId) {
  const safe = safeTrackId(trackId);
  if (!safe) {
    const error = new Error("没有这一档考试");
    error.statusCode = 404;
    throw error;
  }
  const dir = join(DATA_DIR, safe);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function readQuestions(trackId) {
  const safe = safeTrackId(trackId);
  if (!safe) {
    return [];
  }
  try {
    const raw = await readFile(join(DATA_DIR, safe, "questions.json"), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.questions) ? data.questions : [];
  } catch {
    return [];
  }
}

export async function listExamPapers() {
  if (dbMode() === "mysql") {
    await ensureTable();
    const [rows] = await query(
      "SELECT track_id, question_count, original_name, created_at FROM academy_exam_papers"
    );
    const out = {};
    for (const row of rows) {
      out[row.track_id] = {
        trackId: row.track_id,
        questionCount: Number(row.question_count) || 0,
        originalName: row.original_name,
        createdAt: row.created_at
      };
    }
    return out;
  }
  const out = {};
  for (const [id, row] of memory) {
    out[id] = {
      trackId: id,
      questionCount: (row.questions || []).length,
      originalName: row.originalName,
      createdAt: row.createdAt
    };
  }
  return out;
}

export async function getExamPaper(trackId, { includeAnswers = false } = {}) {
  const track = getExamTrack(trackId);
  if (!track) {
    return null;
  }
  const questions = await readQuestions(track.id);
  const papers = await listExamPapers();
  const meta = papers[track.id] || {};
  return {
    track,
    paper: publicPaper(
      {
        trackId: track.id,
        questions,
        originalName: meta.originalName || "",
        createdAt: rowTime(meta)
      },
      { includeAnswers }
    )
  };
}

function rowTime(meta) {
  return meta.createdAt || "";
}

function allowedName(filename) {
  const name = String(filename || "").toLowerCase();
  return ACCEPT.some((ext) => name.endsWith(ext));
}

function looksZip(buffer) {
  return buffer && buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

export async function importExamPaper({ trackId, file, createdBy }) {
  const track = getExamTrack(trackId);
  if (!track) {
    const error = new Error("请先选择晋升档");
    error.statusCode = 400;
    throw error;
  }
  if (!file || !file.buffer || !file.filename) {
    const error = new Error("请上传考试文档");
    error.statusCode = 400;
    throw error;
  }
  const name = String(file.filename || "");
  if (!allowedName(name)) {
    const error = new Error("请上传 .xlsx / .csv / .json / .docx / .txt");
    error.statusCode = 400;
    throw error;
  }
  const ext = extname(name).toLowerCase();
  if ((ext === ".xlsx" || ext === ".docx") && !looksZip(file.buffer)) {
    const error = new Error("文档损坏，请另存后再传");
    error.statusCode = 400;
    throw error;
  }
  const dir = await paperDir(track.id);
  const sourceName = `source${ext}`;
  await writeFile(join(dir, sourceName), file.buffer);
  try {
    await execFileAsync("python3", [READER, join(dir, sourceName), dir], { timeout: 20000 });
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    const error = new Error(err.stderr ? String(err.stderr).trim() : "无法解析考试文档");
    error.statusCode = 400;
    throw error;
  }
  const questions = await readQuestions(track.id);
  if (!questions.length) {
    await rm(dir, { recursive: true, force: true });
    const error = new Error("文档里没有题目");
    error.statusCode = 400;
    throw error;
  }
  const row = {
    trackId: track.id,
    questions,
    originalName: name.slice(0, 180),
    createdBy: String(createdBy || ""),
    createdAt: nowSql()
  };
  if (dbMode() === "mysql") {
    await ensureTable();
    await query(
      `INSERT INTO academy_exam_papers (track_id, question_count, original_name, created_by, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE question_count = VALUES(question_count), original_name = VALUES(original_name),
         created_by = VALUES(created_by), created_at = VALUES(created_at)`,
      [row.trackId, questions.length, row.originalName, row.createdBy, row.createdAt]
    );
  } else {
    memory.set(track.id, row);
  }
  return {
    track,
    paper: publicPaper(row, { includeAnswers: false })
  };
}

export async function gradeExamPaper(trackId, answers) {
  const packed = await getExamPaper(trackId, { includeAnswers: true });
  if (!trackId || !packed || !packed.paper.ready) {
    const error = new Error("这一档还没有考试文档");
    error.statusCode = 400;
    throw error;
  }
  const map = Array.isArray(answers)
    ? Object.fromEntries(answers.map((item, i) => [String(i + 1), item]))
    : answers && typeof answers === "object"
      ? answers
      : {};
  const questions = packed.paper.questions;
  let correct = 0;
  const detail = questions.map((item) => {
    const picked = String(map[item.index] || map[String(item.index)] || "").trim().toUpperCase();
    const ok = picked === String(item.answer || "").toUpperCase();
    if (ok) {
      correct += 1;
    }
    return {
      index: item.index,
      stem: item.stem,
      picked,
      answer: item.answer,
      ok
    };
  });
  const total = questions.length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  const passScore = Number(packed.track.passScore) || 80;
  return {
    track: packed.track,
    total,
    correct,
    score,
    passScore,
    passed: score >= passScore,
    detail
  };
}

export async function resetExamPapersForTests() {
  memory = new Map();
  await rm(DATA_DIR, { recursive: true, force: true });
  await mkdir(DATA_DIR, { recursive: true });
}

export { DATA_DIR };
