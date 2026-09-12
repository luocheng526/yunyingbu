import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";
import { resetHandbookLogsForTests } from "../src/modules/academy/log-store.js";
import { DATA_DIR, resetPptCoursesForTests } from "../src/modules/academy/ppt-store.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const js = await readFile(new URL("../public/shared/modules/academy.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/academy.css", import.meta.url), "utf8");

before(async () => {
  resetStoreForTests();
  await resetPptCoursesForTests();
});

after(async () => {
  await resetPptCoursesForTests();
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

async function makePptx() {
  const dir = await mkdtemp(join(tmpdir(), "xm-pptx-"));
  const path = join(dir, "ops.pptx");
  const py = join(dir, "make.py");
  await writeFile(
    py,
    `
from pptx import Presentation
from pptx.util import Inches
prs = Presentation()
blank = prs.slide_layouts[6]
s1 = prs.slides.add_slide(blank)
t1 = s1.shapes.add_textbox(Inches(0.8), Inches(1.2), Inches(8), Inches(1.2))
t1.text_frame.text = "选品节奏"
s2 = prs.slides.add_slide(blank)
t2 = s2.shapes.add_textbox(Inches(0.8), Inches(1.2), Inches(8), Inches(1.2))
t2.text_frame.text = "投放复盘"
prs.save(${JSON.stringify(path)})
`
  );
  execFileSync("python3", [py], { timeout: 15000 });
  const buf = await readFile(path);
  await rm(dir, { recursive: true, force: true });
  return buf;
}

function multipart(fields, file) {
  const boundary = "----XmPptBound7e72";
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );
  }
  chunks.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`
  );
  const head = Buffer.from(chunks.join(""), "utf8");
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    body: Buffer.concat([head, file.buffer, tail]),
    type: `multipart/form-data; boundary=${boundary}`
  };
}

test("academy.js enables upload, watermark, and blocks original download", () => {
  assert.match(js, /XmModules\["\/academy\/courses"\]/);
  assert.match(js, /academy-wm/);
  assert.match(js, /watermarkText/);
  assert.match(js, /不提供原件下载/);
  assert.match(js, /postCourseFile/);
  assert.match(js, /\/api\/academy\/courses\/chunk/);
  assert.match(js, /文件上传/);
  assert.match(js, /courseTitleFromFile/);
  assert.match(js, /选文件后自动填写/);
  assert.doesNotMatch(js, /name="title" required/);
  assert.match(js, /academy-view-upload/);
  assert.match(js, /academy-thumbs/);
  assert.match(js, /academy-course-pane/);
  assert.match(js, /课件展示/);
  assert.match(js, /emptyViewer/);
  assert.match(js, /paintThumbs/);
  assert.match(js, /正在打开课件，生成幻灯片/);
  assert.match(js, /重新导入 PPTX/);
  assert.match(js, /academy-fs/);
  assert.match(js, /Escape/);
  assert.match(js, /openPreview/);
  assert.match(js, /application\/octet-stream/);
  assert.match(js, /credentials: "include"/);
  assert.doesNotMatch(js, /source\.pptx/);
  assert.doesNotMatch(js, /第 1 步/);
  assert.doesNotMatch(js, /第 2 步/);
  assert.doesNotMatch(js, /第 3 步/);
  assert.doesNotMatch(js, /第 4 步/);
  assert.doesNotMatch(js, /academy-plan/);
  assert.match(css, /\.academy-wm/);
  assert.match(css, /\.academy-slide-img/);
  assert.match(css, /\.academy-fs/);
  assert.match(css, /max-width:\s*none/);
  assert.match(css, /\.academy-console\.is-logs/);
  assert.match(css, /\.academy-course-pane/);
  assert.doesNotMatch(js, /has-viewer/);
});

test("plan is live; old ppt is rejected", async () => {
  const cookie = await loginCookie();
  const headers = { cookie, Accept: "application/json" };
  const plan = await (await fetch(`${base}/api/academy/plan`, { headers })).json();
  assert.equal(plan.ready, true);
  const listed = await (await fetch(`${base}/api/academy/courses`, { headers })).json();
  assert.equal(listed.download, false);
  assert.equal(listed.watermark, true);
  assert.deepEqual(listed.accept, [".pptx"]);
  const bad = multipart(
    { title: "旧课件", category: "选品与商品", published: "true" },
    { filename: "ops.ppt", buffer: Buffer.from("not-a-zip") }
  );
  const res = await fetch(`${base}/api/academy/courses`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": bad.type },
    body: bad.body
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /pptx/);
});

test("upload pptx, turn pages, never serve original", async () => {
  const cookie = await loginCookie();
  await resetPptCoursesForTests();
  const buf = await makePptx();
  const pack = multipart(
    { title: "选品节奏课", category: "选品与商品", published: "true" },
    { filename: "ops.pptx", buffer: buf }
  );
  const createdRes = await fetch(`${base}/api/academy/courses`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": pack.type },
    body: pack.body
  });
  assert.equal(createdRes.status, 201);
  const created = await createdRes.json();
  assert.equal(created.ok, true);
  assert.equal(created.download, false);
  assert.equal(created.course.pageCount, 2);
  const id = created.course.id;
  const listed = await (
    await fetch(`${base}/api/academy/courses/${id}`, {
      headers: { cookie, Accept: "application/json" }
    })
  ).json();
  assert.equal(listed.pages.length, 2);
  assert.equal(Array.isArray(listed.pages), true);
  assert.equal(listed.course.pages.length, 2);
  assert.equal(listed.renderError, "");
  assert.match(listed.pages[0].slide.url, /slide-1\.png/);
  const page1 = await (
    await fetch(`${base}/api/academy/courses/${id}/pages/1`, {
      headers: { cookie, Accept: "application/json" }
    })
  ).json();
  assert.equal(page1.page.hasMedia, true);
  assert.match(page1.page.slide.url, /slide-1\.png/);
  const page2 = await (
    await fetch(`${base}/api/academy/courses/${id}/pages/2`, {
      headers: { cookie, Accept: "application/json" }
    })
  ).json();
  const mediaUrl = page2.page.slide.url;
  const img = await fetch(`${base}${mediaUrl}`, { headers: { cookie } });
  assert.equal(img.status, 200);
  assert.match(img.headers.get("content-type") || "", /image\/png/);
  assert.equal(img.headers.get("content-disposition"), "inline");
  const original = await fetch(`${base}/api/academy/courses/${id}/source.pptx`, {
    headers: { cookie, Accept: "application/json" }
  });
  assert.equal(original.status, 404);
  const originalJson = await original.json();
  assert.match(originalJson.error, /不提供原件下载/);
  const download = await fetch(`${base}/api/academy/courses/${id}/download`, {
    headers: { cookie, Accept: "application/json" }
  });
  assert.equal(download.status, 404);
});

test("GET course rebuilds slide images from source.pptx when pages.json is gone", async () => {
  const cookie = await loginCookie();
  await resetPptCoursesForTests();
  const buf = await makePptx();
  const pack = multipart(
    { title: "补渲染课", category: "选品与商品", published: "true" },
    { filename: "ops.pptx", buffer: buf }
  );
  const createdRes = await fetch(`${base}/api/academy/courses`, {
    method: "POST",
    headers: { cookie, Accept: "application/json", "Content-Type": pack.type },
    body: pack.body
  });
  assert.equal(createdRes.status, 201);
  const id = (await createdRes.json()).course.id;
  await rm(join(DATA_DIR, id, "pages.json"), { force: true });
  await rm(join(DATA_DIR, id, "media"), { recursive: true, force: true });
  const listed = await (
    await fetch(`${base}/api/academy/courses/${id}`, {
      headers: { cookie, Accept: "application/json" }
    })
  ).json();
  assert.equal(listed.ok, true);
  assert.equal(listed.renderError, "");
  assert.equal(listed.pages.length, 2);
  assert.match(listed.pages[0].slide.url, /slide-1\.png/);
  const img = await fetch(`${base}${listed.pages[0].slide.url}`, { headers: { cookie } });
  assert.equal(img.status, 200);
  assert.match(img.headers.get("content-type") || "", /image\/png/);
});

test("raw octet-stream pptx upload keeps session and rejects anonymous", async () => {
  const buf = await makePptx();
  const qs = new URLSearchParams({
    title: "精准转化课",
    category: "转化与页面",
    published: "1",
    filename: "商学转化.pptx"
  });
  const anon = await fetch(`${base}/api/academy/courses?${qs}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/octet-stream" },
    body: buf
  });
  assert.equal(anon.status, 401);
  const anonJson = await anon.json();
  assert.match(anonJson.error, /未登录/);
  const cookie = await loginCookie();
  await resetPptCoursesForTests();
  const createdRes = await fetch(`${base}/api/academy/courses?${qs}`, {
    method: "POST",
    headers: {
      cookie,
      Accept: "application/json",
      "Content-Type": "application/octet-stream"
    },
    body: buf
  });
  assert.equal(createdRes.status, 201);
  const created = await createdRes.json();
  assert.equal(created.ok, true);
  assert.equal(created.course.title, "精准转化课");
  assert.equal(created.course.originalName, "商学转化.pptx");
  assert.equal(created.course.pageCount, 2);
});

test("chunked pptx upload records 上传课件 in logs", async () => {
  const cookie = await loginCookie();
  await resetPptCoursesForTests();
  await resetHandbookLogsForTests();
  const buf = await makePptx();
  const mid = Math.ceil(buf.length / 2);
  const uploadId = "chunk-test-7e72";
  function qs(index) {
    return new URLSearchParams({
      uploadId,
      index: String(index),
      total: "2",
      size: String(buf.length),
      title: "分片课",
      category: "转化与页面",
      published: "1",
      filename: "split.pptx"
    });
  }
  const part1 = await fetch(`${base}/api/academy/courses/chunk?${qs(0)}`, {
    method: "POST",
    headers: {
      cookie,
      Accept: "application/json",
      "Content-Type": "application/octet-stream"
    },
    body: buf.subarray(0, mid)
  });
  assert.equal(part1.status, 200);
  assert.equal((await part1.json()).pending, true);
  const part2 = await fetch(`${base}/api/academy/courses/chunk?${qs(1)}`, {
    method: "POST",
    headers: {
      cookie,
      Accept: "application/json",
      "Content-Type": "application/octet-stream"
    },
    body: buf.subarray(mid)
  });
  assert.equal(part2.status, 201);
  const created = await part2.json();
  assert.equal(created.course.title, "分片课");
  const logs = await (
    await fetch(`${base}/api/academy/logs`, { headers: { cookie, Accept: "application/json" } })
  ).json();
  assert.ok(logs.items.some((item) => item.action === "上传课件" && item.sectionTitle === "分片课"));
});
