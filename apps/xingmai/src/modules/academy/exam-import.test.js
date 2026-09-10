import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../../app.js";
import { resetStoreForTests } from "../profile/auth.js";
import { resetExamPapersForTests } from "./exam-store.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const js = await readFile(new URL("../../../public/shared/modules/academy.js", import.meta.url), "utf8");

before(async () => {
  resetStoreForTests();
  await resetExamPapersForTests();
});

after(async () => {
  await resetExamPapersForTests();
  await new Promise((resolve) => server.close(resolve));
});

async function loginCookie() {
  resetStoreForTests();
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "罗成", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

async function makeJsonPaper() {
  const dir = await mkdtemp(join(tmpdir(), "xm-exam-"));
  const path = join(dir, "newbie.json");
  await writeFile(
    path,
    JSON.stringify({
      questions: [
        {
          stem: "搜索自然流量主要看哪个入口",
          options: ["搜索框和搜索页", "客服会话", "售后工单", "仓库拣货"],
          answer: "A"
        },
        {
          stem: "标题前几字优先放什么",
          options: ["核心卖点", "客服电话", "仓库地址", "退货政策"],
          answer: "A"
        }
      ]
    })
  );
  const buf = await readFile(path);
  await rm(dir, { recursive: true, force: true });
  return buf;
}

function multipart(fields, file) {
  const boundary = "----XmExamBound7e72";
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  chunks.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: application/json\r\n\r\n`
  );
  return {
    body: Buffer.concat([Buffer.from(chunks.join(""), "utf8"), file.buffer, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    type: `multipart/form-data; boundary=${boundary}`
  };
}

test("academy.js has exam import and countdown", () => {
  assert.match(js, /\/api\/academy\/exams\/papers/);
  assert.match(js, /academy-exam-upload/);
  assert.match(js, /开始考试/);
  assert.match(js, /academy-exam-template\.csv/);
  assert.match(js, /academy-exam-detail/);
  assert.match(js, /academy-exam-back/);
  assert.doesNotMatch(js, /点上面一档/);
  assert.doesNotMatch(js, /选晋升档，导入考试文档出卷/);
  assert.doesNotMatch(js, /第 1 步/);
  assert.doesNotMatch(js, /第 2 步/);
  assert.doesNotMatch(js, /academy-plan/);
});

test("python reader parses json exam paper", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xm-exam-read-"));
  const src = join(dir, "paper.json");
  await writeFile(
    src,
    JSON.stringify({
      questions: [{ stem: "测款节奏看什么", options: ["转化和退货", "客服语气"], answer: "A" }]
    })
  );
  execFileSync("python3", [new URL("./read-exam.py", import.meta.url).pathname, src, dir], { timeout: 10000 });
  const parsed = JSON.parse(await readFile(join(dir, "questions.json"), "utf8"));
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].answer, "A");
  await rm(dir, { recursive: true, force: true });
});

test("import exam document, hide answers, grade, block original", async () => {
  const cookie = await loginCookie();
  await resetExamPapersForTests();
  const headers = { cookie, Accept: "application/json" };
  const plan = await (await fetch(`${base}/api/academy/plan`, { headers })).json();
  assert.equal(plan.ready, true);
  const buf = await makeJsonPaper();
  const pack = multipart({ trackId: "newbie" }, { filename: "newbie.json", buffer: buf });
  const createdRes = await fetch(`${base}/api/academy/exams/papers`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": pack.type },
    body: pack.body
  });
  assert.equal(createdRes.status, 201);
  const created = await createdRes.json();
  assert.equal(created.paper.ready, true);
  assert.equal(created.paper.questionCount, 2);
  assert.equal(created.paper.questions[0].answer, undefined);
  const paper = await (
    await fetch(`${base}/api/academy/exams/tracks/newbie`, { headers })
  ).json();
  assert.equal(paper.paper.ready, true);
  assert.ok(paper.paper.questions[0].stem.includes("搜索自然流量"));
  assert.equal(paper.paper.questions[0].answer, undefined);
  const original = await fetch(`${base}/api/academy/exams/tracks/newbie/source.xlsx`, { headers });
  assert.equal(original.status, 404);
  const graded = await fetch(`${base}/api/academy/exams/tracks/newbie/submit`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ answers: { 1: "A", 2: "A" } })
  });
  assert.equal(graded.status, 200);
  const result = (await graded.json()).result;
  assert.equal(result.correct, 2);
  assert.equal(result.passed, true);
  const miss = await fetch(`${base}/api/academy/exams/tracks/newbie/submit`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ answers: { 1: "B", 2: "B" } })
  });
  const missed = (await miss.json()).result;
  assert.equal(missed.correct, 0);
  assert.equal(missed.passed, false);
});
