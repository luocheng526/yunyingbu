import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../../app.js";
import { resetStoreForTests } from "../profile/auth.js";
import { resetPptCoursesForTests } from "./ppt-store.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const js = await readFile(new URL("../../../public/shared/modules/academy.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../../public/academy.css", import.meta.url), "utf8");

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
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  await writeFile(join(dir, "image1.png"), png);
  await writeFile(
    py,
    `
import zipfile, os
root = os.path.dirname(__file__)
pptx = os.path.join(root, "ops.pptx")
slide = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>选品节奏</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>'''
slide2 = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>投放复盘</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>'''
rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>'''
with zipfile.ZipFile(pptx, "w") as zf:
    zf.writestr("ppt/slides/slide1.xml", slide)
    zf.writestr("ppt/slides/slide2.xml", slide2)
    zf.writestr("ppt/slides/_rels/slide2.xml.rels", rels)
    zf.write(os.path.join(root, "image1.png"), "ppt/media/image1.png")
`
  );
  execFileSync("python3", [py], { timeout: 10000 });
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
  assert.match(js, /postForm\("\/api\/academy\/courses"/);
  assert.doesNotMatch(js, /source\.pptx/);
  assert.doesNotMatch(js, /第 1 步/);
  assert.doesNotMatch(js, /第 2 步/);
  assert.doesNotMatch(js, /第 3 步/);
  assert.doesNotMatch(js, /第 4 步/);
  assert.doesNotMatch(js, /academy-plan/);
  assert.match(css, /\.academy-wm/);
  assert.match(css, /max-width:\s*none/);
  assert.match(css, /\.academy-work\.has-viewer/);
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
  const page1 = await (
    await fetch(`${base}/api/academy/courses/${id}/pages/1`, {
      headers: { cookie, Accept: "application/json" }
    })
  ).json();
  assert.ok(page1.page.texts.includes("选品节奏"));
  const page2 = await (
    await fetch(`${base}/api/academy/courses/${id}/pages/2`, {
      headers: { cookie, Accept: "application/json" }
    })
  ).json();
  assert.ok(page2.page.texts.includes("投放复盘"));
  assert.equal(page2.page.hasMedia, true);
  const mediaUrl = page2.page.images[0].url;
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
