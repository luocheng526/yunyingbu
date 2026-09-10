import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dbMode, query } from "../profile/auth.js";
import { getExamTrack, listExamTracks, seatsUserCanGrade, examGraderSeats } from "./framework.js";

const execFileAsync = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data", "exams");
const READER = join(ROOT, "read-exam.py");
const ACCEPT = [".xlsx", ".csv", ".json", ".docx", ".txt"];

let memory = new Map();
let attempts = [];

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

function publicQuestion(item, { includeAnswers = false } = {}) {
  const type = item.type || (item.options && item.options.length >= 2 ? "choice" : "qa");
  const out = {
    index: item.index,
    stem: item.stem,
    type,
    grade: item.grade || (type === "qa" ? "dual" : "auto"),
    points: Number(item.points) || 0,
    options: type === "choice" || type === "multi" ? (item.options || []).map((opt) => ({ key: opt.key, text: opt.text })) : []
  };
  if (includeAnswers) {
    out.answer = item.answer || "";
    out.answers = item.answers || [];
  }
  return out;
}

function publicPaper(row, { includeAnswers = false } = {}) {
  const questions = Array.isArray(row.questions) ? row.questions : [];
  const types = { choice: 0, fill: 0, qa: 0, multi: 0 };
  for (const item of questions) {
    const type = item.type || "choice";
    types[type] = (types[type] || 0) + 1;
  }
  return {
    ready: questions.length > 0,
    trackId: row.trackId,
    questionCount: questions.length,
    originalName: row.originalName,
    createdAt: row.createdAt,
    download: false,
    types,
    dual: questions.some((item) => (item.grade || item.type) === "dual" || item.type === "qa"),
    questions: questions.map((item) => publicQuestion(item, { includeAnswers }))
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
    await execFileAsync("python3", [READER, join(dir, sourceName), dir], { timeout: 60000 });
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

function answerMap(answers) {
  return Array.isArray(answers)
    ? Object.fromEntries(answers.map((item, i) => [String(i + 1), item]))
    : answers && typeof answers === "object"
      ? answers
      : {};
}

function normFill(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[。．.]$/g, "")
    .toLowerCase();
}

function autoMark(item, picked) {
  const type = item.type || "choice";
  const raw = String(picked == null ? "" : picked).trim();
  if (type === "qa") {
    return { ok: false, auto: false, earned: 0, picked: raw };
  }
  if (type === "fill") {
    const got = normFill(raw);
    const keys = (item.answers || []).concat(item.answer || "").map(normFill).filter(Boolean);
    const ok = Boolean(got) && keys.some((key) => got === key || key.includes(got) || got.includes(key));
    return { ok, auto: true, earned: ok ? Number(item.points) || 0 : 0, picked: raw };
  }
  const letter = raw.toUpperCase();
  const ok = letter === String(item.answer || "").toUpperCase();
  return { ok, auto: true, earned: ok ? Number(item.points) || 0 : 0, picked: letter };
}

function publicAttempt(row, { includeAnswers = false } = {}) {
  return {
    id: row.id,
    trackId: row.trackId,
    username: row.username,
    displayName: row.displayName,
    status: row.status,
    submittedAt: row.createdAt,
    autoScore: row.autoScore,
    dualScore: row.dualScore,
    score: row.score,
    passScore: row.passScore,
    passed: row.passed,
    pendingSeats: row.pendingSeats,
    grades: row.grades,
    detail: (row.detail || []).map((item) => {
      const out = {
        index: item.index,
        stem: item.stem,
        type: item.type,
        grade: item.grade,
        points: item.points,
        picked: item.picked,
        ok: item.ok,
        earned: item.earned
      };
      if (includeAnswers) {
        out.answer = item.answer;
      }
      return out;
    })
  };
}

async function persistAttempts() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, "attempts.json"), JSON.stringify({ items: attempts }, null, 2));
}

async function loadAttempts() {
  if (attempts.length) {
    return;
  }
  try {
    const raw = await readFile(join(DATA_DIR, "attempts.json"), "utf8");
    const data = JSON.parse(raw);
    attempts = Array.isArray(data.items) ? data.items : [];
  } catch {
    attempts = [];
  }
}

function finalizeAttempt(row) {
  const seats = examGraderSeats(row.trackId);
  const dualQs = (row.detail || []).filter((item) => item.grade === "dual");
  const pending = seats.filter((seat) => !row.grades[seat]);
  row.pendingSeats = pending;
  if (dualQs.length && pending.length) {
    row.status = "grading";
    row.score = row.autoScore;
    row.passed = false;
    row.dualScore = null;
    return row;
  }
  let dual = 0;
  if (dualQs.length) {
    for (const item of dualQs) {
      const marks = seats.map((seat) => Number((row.grades[seat].scores || {})[item.index] || 0));
      dual += marks.reduce((a, b) => a + b, 0) / marks.length;
    }
  }
  row.dualScore = Math.round(dual);
  row.score = Math.round(row.autoScore + dual);
  row.passed = row.score >= Number(row.passScore || 80);
  row.status = "done";
  row.pendingSeats = [];
  return row;
}

export async function submitExamPaper(trackId, answers, user) {
  const packed = await getExamPaper(trackId, { includeAnswers: true });
  if (!trackId || !packed || !packed.paper.ready) {
    const error = new Error("这一档还没有考试文档");
    error.statusCode = 400;
    throw error;
  }
  await loadAttempts();
  const map = answerMap(answers);
  const questions = packed.paper.questions;
  let autoScore = 0;
  let autoCorrect = 0;
  const detail = questions.map((item) => {
    const marked = autoMark(item, map[item.index] || map[String(item.index)] || "");
    if (marked.auto && marked.ok) {
      autoCorrect += 1;
    }
    if (marked.auto) {
      autoScore += marked.earned;
    }
    return {
      index: item.index,
      stem: item.stem,
      type: item.type,
      grade: item.grade,
      points: item.points,
      picked: marked.picked,
      answer: item.answer || "",
      ok: marked.ok,
      earned: marked.earned
    };
  });
  const needDual = questions.some((item) => item.grade === "dual");
  const row = {
    id: randomUUID(),
    trackId: packed.track.id,
    username: String(user && user.username || ""),
    displayName: String((user && (user.displayName || user.username)) || ""),
    createdAt: nowSql(),
    autoScore: Math.round(autoScore),
    autoCorrect,
    passScore: Number(packed.track.passScore) || 80,
    grades: {},
    detail,
    dualScore: null,
    score: Math.round(autoScore),
    passed: false,
    status: needDual ? "grading" : "done",
    pendingSeats: needDual ? examGraderSeats(packed.track) : []
  };
  if (!needDual) {
    row.passed = row.score >= row.passScore;
    row.pendingSeats = [];
  }
  attempts.unshift(row);
  attempts = attempts.slice(0, 400);
  await persistAttempts();
  return {
    track: packed.track,
    attempt: publicAttempt(row, { includeAnswers: false }),
    total: questions.length,
    correct: autoCorrect,
    score: row.score,
    passScore: row.passScore,
    passed: row.passed,
    status: row.status,
    pendingSeats: row.pendingSeats,
    detail: publicAttempt(row, { includeAnswers: false }).detail
  };
}

export async function gradeExamPaper(trackId, answers, user) {
  return submitExamPaper(trackId, answers, user);
}

export async function listExamAttempts(user, { trackId = "" } = {}) {
  await loadAttempts();
  const seats = trackId ? await seatsUserCanGrade(user, trackId) : [];
  const own = String(user && user.username || "");
  return attempts
    .filter((row) => {
      if (trackId && row.trackId !== trackId) {
        return false;
      }
      if (row.username === own) {
        return true;
      }
      if (trackId) {
        return seats.length > 0;
      }
      return false;
    })
    .map((row) => publicAttempt(row, { includeAnswers: row.username !== own }));
}

export async function gradeExamAttempt(attemptId, { user, seat, scores, comment }) {
  await loadAttempts();
  const row = attempts.find((item) => item.id === String(attemptId || ""));
  if (!row) {
    const error = new Error("没有这份答卷");
    error.statusCode = 404;
    throw error;
  }
  const allowed = await seatsUserCanGrade(user, row.trackId);
  const want = String(seat || allowed[0] || "");
  if (!allowed.includes(want)) {
    const error = new Error("这一档要由" + examGraderSeats(row.trackId).join("、") + "共同打分");
    error.statusCode = 403;
    throw error;
  }
  if (row.grades[want]) {
    const error = new Error(want + "已经打过这卷");
    error.statusCode = 400;
    throw error;
  }
  const dualQs = (row.detail || []).filter((item) => item.grade === "dual");
  const map = answerMap(scores);
  const cleaned = {};
  for (const item of dualQs) {
    const n = Number(map[item.index] || map[String(item.index)] || 0);
    if (!Number.isFinite(n) || n < 0 || n > Number(item.points) + 0.001) {
      const error = new Error("第 " + item.index + " 题分数要在 0-" + item.points + " 之间");
      error.statusCode = 400;
      throw error;
    }
    cleaned[item.index] = Math.round(n * 100) / 100;
  }
  row.grades[want] = {
    seat: want,
    by: String(user && (user.displayName || user.username) || ""),
    comment: String(comment || "").slice(0, 400),
    at: nowSql(),
    scores: cleaned
  };
  finalizeAttempt(row);
  await persistAttempts();
  return {
    attempt: publicAttempt(row, { includeAnswers: true }),
    track: getExamTrack(row.trackId)
  };
}

export async function resetExamPapersForTests() {
  memory = new Map();
  attempts = [];
  await rm(DATA_DIR, { recursive: true, force: true });
  await mkdir(DATA_DIR, { recursive: true });
}

export { DATA_DIR };
