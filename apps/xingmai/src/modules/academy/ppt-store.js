import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dbMode, query } from "../profile/auth.js";
const READ_PPTX_PY = "#!/usr/bin/env python3\nimport json\nimport os\nimport re\nimport shutil\nimport subprocess\nimport sys\nimport tempfile\nimport zipfile\nfrom xml.etree import ElementTree as ET\n\nA_NS = \"{http://schemas.openxmlformats.org/drawingml/2006/main}\"\nREL_NS = \"{http://schemas.openxmlformats.org/package/2006/relationships}\"\n\n\ndef slide_index(name):\n    hit = re.search(r\"slide(\\d+)\\.xml$\", name.replace(\"\\\\\", \"/\"))\n    return int(hit.group(1)) if hit else 0\n\n\ndef texts_of(xml):\n    root = ET.fromstring(xml)\n    lines = []\n    for node in root.iter(A_NS + \"t\"):\n        text = (node.text or \"\").strip()\n        if text:\n            lines.append(text)\n    return lines\n\n\ndef images_of(zf, slide_xml_name):\n    rel_name = slide_xml_name.replace(\"ppt/slides/\", \"ppt/slides/_rels/\") + \".rels\"\n    if rel_name not in zf.namelist():\n        return []\n    root = ET.fromstring(zf.read(rel_name))\n    names = []\n    for rel in root:\n        target = rel.attrib.get(\"Target\") or \"\"\n        mode = rel.attrib.get(\"TargetMode\") or \"\"\n        if mode.lower() == \"external\":\n            continue\n        if not re.search(r\"\\.(png|jpe?g|gif|webp)$\", target, re.I):\n            continue\n        path = target.replace(\"\\\\\", \"/\")\n        if path.startswith(\"../\"):\n            path = \"ppt/\" + path.replace(\"../\", \"\")\n        elif not path.startswith(\"ppt/\"):\n            path = \"ppt/slides/\" + path\n        names.append(path)\n    return names\n\n\ndef render_soffice(pptx_path, media_dir, count):\n    soffice = shutil.which(\"soffice\") or shutil.which(\"libreoffice\")\n    pdftoppm = shutil.which(\"pdftoppm\")\n    if not soffice or not pdftoppm:\n        return False\n    work = tempfile.mkdtemp(prefix=\"xm-ppt-\")\n    env = os.environ.copy()\n    env[\"HOME\"] = work\n    env[\"LANG\"] = env.get(\"LANG\") or \"C.UTF-8\"\n    try:\n        subprocess.check_call(\n            [soffice, \"--headless\", \"--norestore\", \"--convert-to\", \"pdf\", \"--outdir\", work, pptx_path],\n            timeout=150,\n            env=env,\n            stdout=subprocess.DEVNULL,\n            stderr=subprocess.STDOUT,\n        )\n        pdfs = [name for name in os.listdir(work) if name.lower().endswith(\".pdf\")]\n        if not pdfs:\n            return False\n        prefix = os.path.join(work, \"slide\")\n        subprocess.check_call(\n            [pdftoppm, \"-png\", \"-r\", \"120\", os.path.join(work, pdfs[0]), prefix],\n            timeout=150,\n            env=env,\n        )\n        files = sorted(\n            [name for name in os.listdir(work) if name.startswith(\"slide\") and name.endswith(\".png\")],\n            key=lambda n: int(re.search(r\"(\\d+)\", n).group(1) if re.search(r\"(\\d+)\", n) else 0),\n        )\n        if not files:\n            return False\n        for index, name in enumerate(files, start=1):\n            shutil.copyfile(os.path.join(work, name), os.path.join(media_dir, \"slide-%d.png\" % index))\n        return len(files) >= count\n    except Exception:\n        return False\n    finally:\n        shutil.rmtree(work, ignore_errors=True)\n\n\ndef render_fallback(pages, media_dir):\n    try:\n        from PIL import Image, ImageDraw, ImageFont\n    except Exception:\n        Image = None\n    W, H = 1280, 720\n    for page in pages:\n        name = \"slide-%d.png\" % page[\"index\"]\n        target = os.path.join(media_dir, name)\n        pasted = False\n        if Image is not None:\n            canvas = Image.new(\"RGB\", (W, H), (255, 255, 255))\n            for img_name in page.get(\"images\") or []:\n                src = os.path.join(media_dir, img_name)\n                if not os.path.isfile(src):\n                    continue\n                try:\n                    pic = Image.open(src).convert(\"RGB\")\n                    pic.thumbnail((W, H))\n                    x = max(0, (W - pic.size[0]) // 2)\n                    y = max(0, (H - pic.size[1]) // 2)\n                    canvas.paste(pic, (x, y))\n                    pasted = True\n                    break\n                except Exception:\n                    continue\n            if not pasted:\n                draw = ImageDraw.Draw(canvas)\n                font = ImageFont.load_default()\n                y = 40\n                for line in (page.get(\"texts\") or [\"\u8bfe\u4ef6\u9875 %d\" % page[\"index\"]])[:12]:\n                    draw.text((40, y), line, fill=(30, 30, 30), font=font)\n                    y += 28\n            canvas.save(target, \"PNG\")\n        elif not os.path.isfile(target):\n            with open(target, \"wb\") as fh:\n                fh.write(\n                    b\"\\x89PNG\\r\\n\\x1a\\n\\x00\\x00\\x00\\rIHDR\\x00\\x00\\x00\\x01\\x00\\x00\\x00\\x01\"\n                    b\"\\x08\\x06\\x00\\x00\\x00\\x1f\\x15\\xc4\\x89\\x00\\x00\\x00\\nIDATx\\x9cc\\x00\\x01\"\n                    b\"\\x00\\x00\\x05\\x00\\x01\\r\\n-\\xb4\\x00\\x00\\x00\\x00IEND\\xaeB`\\x82\"\n                )\n        page[\"slide\"] = name\n        page[\"images\"] = [name]\n\n\ndef extract(pptx_path, out_dir):\n    os.makedirs(out_dir, exist_ok=True)\n    media_dir = os.path.join(out_dir, \"media\")\n    os.makedirs(media_dir, exist_ok=True)\n    pages = []\n    with zipfile.ZipFile(pptx_path) as zf:\n        slides = sorted(\n            [name for name in zf.namelist() if re.search(r\"ppt/slides/slide\\d+\\.xml$\", name)],\n            key=slide_index,\n        )\n        if not slides:\n            raise SystemExit(\"PPTX \u91cc\u6ca1\u6709\u5e7b\u706f\u7247\")\n        used = {}\n        for index, name in enumerate(slides, start=1):\n            xml = zf.read(name)\n            images = []\n            for src in images_of(zf, name):\n                base = os.path.basename(src)\n                safe = re.sub(r\"[^A-Za-z0-9._-]\", \"_\", base) or \"img\"\n                key = \"%d-%s\" % (index, safe)\n                if key in used:\n                    continue\n                used[key] = True\n                if src in zf.namelist():\n                    target = os.path.join(media_dir, key)\n                    with zf.open(src) as src_fh, open(target, \"wb\") as dest_fh:\n                        shutil.copyfileobj(src_fh, dest_fh)\n                    images.append(key)\n            pages.append({\"index\": index, \"texts\": texts_of(xml), \"images\": images, \"slide\": \"\"})\n    if not render_soffice(pptx_path, media_dir, len(pages)):\n        render_fallback(pages, media_dir)\n    else:\n        for page in pages:\n            name = \"slide-%d.png\" % page[\"index\"]\n            page[\"slide\"] = name\n            page[\"images\"] = [name]\n    missing = [page for page in pages if not os.path.isfile(os.path.join(media_dir, page[\"slide\"]))]\n    if missing:\n        render_fallback(pages, media_dir)\n    with open(os.path.join(out_dir, \"pages.json\"), \"w\", encoding=\"utf-8\") as fh:\n        json.dump({\"pages\": pages}, fh, ensure_ascii=False)\n    print(json.dumps({\"ok\": True, \"pages\": len(pages)}))\n\n\nif __name__ == \"__main__\":\n    if len(sys.argv) != 3:\n        raise SystemExit(\"usage: read-pptx.py infile.pptx outdir\")\n    extract(sys.argv[1], sys.argv[2])\n";


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

export async function getPptCourse(id, { allowUnpublished = true, withPages = true } = {}) {
  const safe = safeCourseId(id);
  if (!safe) {
    return null;
  }
  const rows = await listPptCourses({ includeUnpublished: true });
  const hit = rows.find((item) => item.id === safe);
  if (!hit || (!hit.published && !allowUnpublished)) {
    return null;
  }
  if (!withPages) {
    return hit;
  }
  const rendered = await ensureSlideRenders(safe);
  const pages = await readPages(safe);
  return {
    ...hit,
    pageCount: pages.length || Number(hit.pageCount) || 0,
    pages: pages.map((page) => pagePayload(safe, page)),
    renderError: (rendered && rendered.error) || ""
  };
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
    return { error: "课件不存在" };
  }
  const dir = join(DATA_DIR, safe);
  const source = join(dir, "source.pptx");
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
    return { error: "" };
  }
  if (!(await fileExists(source))) {
    return { error: "课件页图不在服务器，请到「文件上传」重新导入 PPTX" };
  }
  try {
    await ensureReader();
    await execFileAsync("python3", [READER, source, dir], {
      timeout: 180000,
      env: { ...process.env, HOME: "/tmp", LANG: process.env.LANG || "C.UTF-8" }
    });
  } catch (err) {
    const detail = err && (err.stderr || err.message);
    return { error: String(detail || "无法生成幻灯片").trim().slice(0, 240) };
  }
  const after = await readPages(id);
  if (!after.length) {
    return { error: "没能生成幻灯片，请重新上传 PPTX" };
  }
  return { error: "" };
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
  return getPptCourse(id, { allowUnpublished: true, withPages: true });
}

export async function getPptPage(id, index) {
  const course = await getPptCourse(id, { allowUnpublished: true, withPages: false });
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
