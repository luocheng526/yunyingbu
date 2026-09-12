import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

let authMod = null;
async function academyAuth() {
  if (!authMod) {
    authMod = await import("../profile/auth.js");
  }
  return authMod;
}
async function dbMode() {
  const auth = await academyAuth();
  return auth.dbMode();
}
async function query(sql, params) {
  const auth = await academyAuth();
  return auth.query(sql, params);
}

const READ_PPTX_PY = [
  "#!/usr/bin/env python3",
  "import json",
  "import os",
  "import re",
  "import shutil",
  "import subprocess",
  "import sys",
  "import tempfile",
  "import zipfile",
  "from xml.etree import ElementTree as ET",
  "",
  "A_NS = \"{http://schemas.openxmlformats.org/drawingml/2006/main}\"",
  "REL_NS = \"{http://schemas.openxmlformats.org/package/2006/relationships}\"",
  "",
  "",
  "def slide_index(name):",
  "    hit = re.search(r\"slide(\\d+)\\.xml$\", name.replace(\"\\\\\", \"/\"))",
  "    return int(hit.group(1)) if hit else 0",
  "",
  "",
  "def texts_of(xml):",
  "    root = ET.fromstring(xml)",
  "    lines = []",
  "    for node in root.iter(A_NS + \"t\"):",
  "        text = (node.text or \"\").strip()",
  "        if text:",
  "            lines.append(text)",
  "    return lines",
  "",
  "",
  "def images_of(zf, slide_xml_name):",
  "    rel_name = slide_xml_name.replace(\"ppt/slides/\", \"ppt/slides/_rels/\") + \".rels\"",
  "    if rel_name not in zf.namelist():",
  "        return []",
  "    root = ET.fromstring(zf.read(rel_name))",
  "    names = []",
  "    for rel in root:",
  "        target = rel.attrib.get(\"Target\") or \"\"",
  "        mode = rel.attrib.get(\"TargetMode\") or \"\"",
  "        if mode.lower() == \"external\":",
  "            continue",
  "        if not re.search(r\"\\.(png|jpe?g|gif|webp)$\", target, re.I):",
  "            continue",
  "        path = target.replace(\"\\\\\", \"/\")",
  "        if path.startswith(\"../\"):",
  "            path = \"ppt/\" + path.replace(\"../\", \"\")",
  "        elif not path.startswith(\"ppt/\"):",
  "            path = \"ppt/slides/\" + path",
  "        names.append(path)",
  "    return names",
  "",
  "",
  "def render_soffice(pptx_path, media_dir, count):",
  "    soffice = shutil.which(\"soffice\") or shutil.which(\"libreoffice\")",
  "    pdftoppm = shutil.which(\"pdftoppm\")",
  "    if not soffice or not pdftoppm:",
  "        return False",
  "    work = tempfile.mkdtemp(prefix=\"xm-ppt-\")",
  "    env = os.environ.copy()",
  "    env[\"HOME\"] = work",
  "    env[\"LANG\"] = env.get(\"LANG\") or \"C.UTF-8\"",
  "    try:",
  "        subprocess.check_call(",
  "            [soffice, \"--headless\", \"--norestore\", \"--convert-to\", \"pdf\", \"--outdir\", work, pptx_path],",
  "            timeout=150,",
  "            env=env,",
  "            stdout=subprocess.DEVNULL,",
  "            stderr=subprocess.STDOUT,",
  "        )",
  "        pdfs = [name for name in os.listdir(work) if name.lower().endswith(\".pdf\")]",
  "        if not pdfs:",
  "            return False",
  "        prefix = os.path.join(work, \"slide\")",
  "        subprocess.check_call(",
  "            [pdftoppm, \"-png\", \"-r\", \"120\", os.path.join(work, pdfs[0]), prefix],",
  "            timeout=150,",
  "            env=env,",
  "        )",
  "        files = sorted(",
  "            [name for name in os.listdir(work) if name.startswith(\"slide\") and name.endswith(\".png\")],",
  "            key=lambda n: int(re.search(r\"(\\d+)\", n).group(1) if re.search(r\"(\\d+)\", n) else 0),",
  "        )",
  "        if not files:",
  "            return False",
  "        for index, name in enumerate(files, start=1):",
  "            shutil.copyfile(os.path.join(work, name), os.path.join(media_dir, \"slide-%d.png\" % index))",
  "        return len(files) >= count",
  "    except Exception:",
  "        return False",
  "    finally:",
  "        shutil.rmtree(work, ignore_errors=True)",
  "",
  "",
  "def render_fallback(pages, media_dir):",
  "    try:",
  "        from PIL import Image, ImageDraw, ImageFont",
  "    except Exception:",
  "        Image = None",
  "    W, H = 1280, 720",
  "    for page in pages:",
  "        name = \"slide-%d.png\" % page[\"index\"]",
  "        target = os.path.join(media_dir, name)",
  "        pasted = False",
  "        if Image is not None:",
  "            canvas = Image.new(\"RGB\", (W, H), (255, 255, 255))",
  "            for img_name in page.get(\"images\") or []:",
  "                src = os.path.join(media_dir, img_name)",
  "                if not os.path.isfile(src):",
  "                    continue",
  "                try:",
  "                    pic = Image.open(src).convert(\"RGB\")",
  "                    pic.thumbnail((W, H))",
  "                    x = max(0, (W - pic.size[0]) // 2)",
  "                    y = max(0, (H - pic.size[1]) // 2)",
  "                    canvas.paste(pic, (x, y))",
  "                    pasted = True",
  "                    break",
  "                except Exception:",
  "                    continue",
  "            if not pasted:",
  "                draw = ImageDraw.Draw(canvas)",
  "                font = ImageFont.load_default()",
  "                y = 40",
  "                for line in (page.get(\"texts\") or [\"课件页 %d\" % page[\"index\"]])[:12]:",
  "                    draw.text((40, y), line, fill=(30, 30, 30), font=font)",
  "                    y += 28",
  "            canvas.save(target, \"PNG\")",
  "        elif not os.path.isfile(target):",
  "            with open(target, \"wb\") as fh:",
  "                fh.write(",
  "                    b\"\\x89PNG\\r\\n\\x1a\\n\\x00\\x00\\x00\\rIHDR\\x00\\x00\\x00\\x01\\x00\\x00\\x00\\x01\"",
  "                    b\"\\x08\\x06\\x00\\x00\\x00\\x1f\\x15\\xc4\\x89\\x00\\x00\\x00\\nIDATx\\x9cc\\x00\\x01\"",
  "                    b\"\\x00\\x00\\x05\\x00\\x01\\r\\n-\\xb4\\x00\\x00\\x00\\x00IEND\\xaeB`\\x82\"",
  "                )",
  "        page[\"slide\"] = name",
  "        page[\"images\"] = [name]",
  "",
  "",
  "def extract(pptx_path, out_dir):",
  "    os.makedirs(out_dir, exist_ok=True)",
  "    media_dir = os.path.join(out_dir, \"media\")",
  "    os.makedirs(media_dir, exist_ok=True)",
  "    pages = []",
  "    with zipfile.ZipFile(pptx_path) as zf:",
  "        slides = sorted(",
  "            [name for name in zf.namelist() if re.search(r\"ppt/slides/slide\\d+\\.xml$\", name)],",
  "            key=slide_index,",
  "        )",
  "        if not slides:",
  "            raise SystemExit(\"PPTX 里没有幻灯片\")",
  "        used = {}",
  "        for index, name in enumerate(slides, start=1):",
  "            xml = zf.read(name)",
  "            images = []",
  "            for src in images_of(zf, name):",
  "                base = os.path.basename(src)",
  "                safe = re.sub(r\"[^A-Za-z0-9._-]\", \"_\", base) or \"img\"",
  "                key = \"%d-%s\" % (index, safe)",
  "                if key in used:",
  "                    continue",
  "                used[key] = True",
  "                if src in zf.namelist():",
  "                    target = os.path.join(media_dir, key)",
  "                    with zf.open(src) as src_fh, open(target, \"wb\") as dest_fh:",
  "                        shutil.copyfileobj(src_fh, dest_fh)",
  "                    images.append(key)",
  "            pages.append({\"index\": index, \"texts\": texts_of(xml), \"images\": images, \"slide\": \"\"})",
  "    if not render_soffice(pptx_path, media_dir, len(pages)):",
  "        render_fallback(pages, media_dir)",
  "    else:",
  "        for page in pages:",
  "            name = \"slide-%d.png\" % page[\"index\"]",
  "            page[\"slide\"] = name",
  "            page[\"images\"] = [name]",
  "    missing = [page for page in pages if not os.path.isfile(os.path.join(media_dir, page[\"slide\"]))]",
  "    if missing:",
  "        render_fallback(pages, media_dir)",
  "    with open(os.path.join(out_dir, \"pages.json\"), \"w\", encoding=\"utf-8\") as fh:",
  "        json.dump({\"pages\": pages}, fh, ensure_ascii=False)",
  "    print(json.dumps({\"ok\": True, \"pages\": len(pages)}))",
  "",
  "",
  "if __name__ == \"__main__\":",
  "    if len(sys.argv) != 3:",
  "        raise SystemExit(\"usage: read-pptx.py infile.pptx outdir\")",
  "    extract(sys.argv[1], sys.argv[2])",
  ""
].join("\n");

const execFileAsync = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data", "courses");
const CATALOG_FILE = join(DATA_DIR, "catalog.json");
const READER = join(ROOT, "read-pptx.py");
const CATEGORIES = ["选品与商品", "流量与投放", "转化与页面", "数据与复盘", "大促节奏"];

async function ensureReader() {
  await writeFile(READER, READ_PPTX_PY);
}

let memory = [];
let memoryCatalog = null;

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function publicCourse(row, folderId = "") {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    folderId,
    published: Boolean(row.published),
    pageCount: Number(row.pageCount) || 0,
    originalName: row.originalName,
    createdAt: row.createdAt,
    download: false,
    watermark: true
  };
}

function defaultFolders() {
  return CATEGORIES.map((title, index) => ({
    id: `course-folder-${index + 1}`,
    title,
    children: []
  }));
}

function cloneFolders(nodes) {
  return (nodes || []).map((node) => ({
    id: node.id,
    title: node.title,
    children: cloneFolders(node.children)
  }));
}

function cleanFolderTitle(title) {
  return String(title || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim();
}

function cleanFolders(nodes) {
  return (nodes || []).flatMap((node) => {
    const title = cleanFolderTitle(node.title);
    const children = cleanFolders(node.children);
    return title ? [{ id: node.id, title, children }] : children;
  });
}

function walkFolders(nodes, visit, parent = null) {
  for (const node of nodes || []) {
    visit(node, parent);
    walkFolders(node.children, visit, node);
  }
}

function findFolder(nodes, id) {
  let hit = null;
  walkFolders(nodes, (node) => {
    if (node.id === id) {
      hit = node;
    }
  });
  return hit;
}

function findFolderByTitle(nodes, title) {
  let hit = null;
  walkFolders(nodes, (node) => {
    if (!hit && node.title === title) {
      hit = node;
    }
  });
  return hit;
}

function safeFolderId(id) {
  const value = String(id || "");
  return /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value) ? value : "";
}

function catalogPayload(catalog) {
  return {
    folders: cloneFolders(catalog.folders),
    assignments: { ...(catalog.assignments || {}) }
  };
}

async function saveCourseCatalog(catalog) {
  const next = catalogPayload(catalog);
  memoryCatalog = next;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CATALOG_FILE, JSON.stringify(next, null, 2));
  return catalogPayload(next);
}

async function loadCourseCatalog() {
  if (memoryCatalog) {
    return catalogPayload(memoryCatalog);
  }
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const data = JSON.parse(await readFile(CATALOG_FILE, "utf8"));
    const sourceFolders = Array.isArray(data.folders) ? data.folders : defaultFolders();
    const catalog = {
      folders: cleanFolders(sourceFolders),
      assignments: data.assignments && typeof data.assignments === "object" ? data.assignments : {}
    };
    if (JSON.stringify(catalog.folders) !== JSON.stringify(sourceFolders)) {
      return saveCourseCatalog(catalog);
    }
    memoryCatalog = catalogPayload(catalog);
    return catalogPayload(catalog);
  } catch {
    return saveCourseCatalog({ folders: defaultFolders(), assignments: {} });
  }
}

function folderForCourse(catalog, row) {
  const assigned = findFolder(catalog.folders, catalog.assignments[row.id]);
  return assigned || findFolderByTitle(catalog.folders, row.category) || catalog.folders[0] || null;
}

function bad(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function getCourseFolderTree() {
  const catalog = await loadCourseCatalog();
  return cloneFolders(catalog.folders);
}

export async function addCourseFolder({ parentId, title }) {
  const name = cleanFolderTitle(title);
  if (!name) {
    throw bad("请填写分类名称");
  }
  const catalog = await loadCourseCatalog();
  const pid = safeFolderId(parentId);
  const node = { id: `course-${randomUUID()}`, title: name.slice(0, 64), children: [] };
  if (pid) {
    const parent = findFolder(catalog.folders, pid);
    if (!parent) {
      throw bad("没有这个上级分类", 404);
    }
    parent.children = parent.children || [];
    parent.children.push(node);
  } else {
    catalog.folders.push(node);
  }
  await saveCourseCatalog(catalog);
  return node;
}

function findFolderParent(nodes, id) {
  let parent;
  walkFolders(nodes, (node, owner) => {
    if (node.id === id) {
      parent = owner;
    }
  });
  return parent;
}

function takeFolder(nodes, id) {
  for (let index = 0; index < (nodes || []).length; index += 1) {
    if (nodes[index].id === id) {
      return nodes.splice(index, 1)[0];
    }
    const nested = takeFolder(nodes[index].children || [], id);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function folderContains(node, id) {
  return Boolean(findFolder(node.children || [], id));
}

export async function moveCourseFolder({ id, beforeId, parentId }) {
  const catalog = await loadCourseCatalog();
  const sid = safeFolderId(id);
  const moving = findFolder(catalog.folders, sid);
  if (!moving) {
    throw bad("没有这个分类", 404);
  }
  const before = safeFolderId(beforeId);
  if (before === sid) {
    return cloneFolders(catalog.folders);
  }
  let destinationParent = null;
  let destination = catalog.folders;
  if (before) {
    if (!findFolder(catalog.folders, before)) {
      throw bad("放不下这个位置");
    }
    destinationParent = findFolderParent(catalog.folders, before);
    destination = destinationParent ? destinationParent.children : catalog.folders;
  } else if (safeFolderId(parentId)) {
    destinationParent = findFolder(catalog.folders, safeFolderId(parentId));
    if (!destinationParent) {
      throw bad("没有这个上级分类", 404);
    }
    destination = destinationParent.children || (destinationParent.children = []);
  }
  if (destinationParent && (destinationParent.id === sid || folderContains(moving, destinationParent.id))) {
    throw bad("不能拖进自己的下级");
  }
  const taken = takeFolder(catalog.folders, sid);
  if (!taken) {
    throw bad("没有这个分类", 404);
  }
  const index = before ? destination.findIndex((node) => node.id === before) : destination.length;
  destination.splice(index < 0 ? destination.length : index, 0, taken);
  await saveCourseCatalog(catalog);
  return cloneFolders(catalog.folders);
}

export async function assignPptCourseFolder({ courseId, folderId }) {
  const catalog = await loadCourseCatalog();
  const folder = findFolder(catalog.folders, safeFolderId(folderId));
  if (!folder) {
    throw bad("没有这个课件分类", 404);
  }
  const rows = await listPptCourses({ includeUnpublished: true });
  const course = rows.find((item) => item.id === safeCourseId(courseId));
  if (!course) {
    throw bad("课件不存在", 404);
  }
  catalog.assignments[course.id] = folder.id;
  await saveCourseCatalog(catalog);
  return { ...course, folderId: folder.id, category: folder.title };
}

async function ensureCoursesTable() {
  if ((await dbMode()) !== "mysql") {
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
  const catalog = await loadCourseCatalog();
  if ((await dbMode()) === "mysql") {
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
        }, (folderForCourse(catalog, {
          id: row.id,
          category: row.category
        }) || {}).id)
      )
      .filter((item) => includeUnpublished || item.published);
  }
  return memory
    .map((item) => publicCourse(item, (folderForCourse(catalog, item) || {}).id))
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

export async function createPptCourse({ title, category, folderId, published = true, file, createdBy }) {
  const name = String(title || "").trim();
  const catalog = await loadCourseCatalog();
  const folder =
    findFolder(catalog.folders, safeFolderId(folderId)) ||
    findFolderByTitle(catalog.folders, String(category || "").trim());
  const cat = folder ? folder.title : String(category || "").trim();
  if (!name) {
    const error = new Error("请填写课件标题");
    error.statusCode = 400;
    throw error;
  }
  if (!folder) {
    const error = new Error("请选择课件分类");
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
  if ((await dbMode()) === "mysql") {
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
  catalog.assignments[row.id] = folder.id;
  await saveCourseCatalog(catalog);
  return publicCourse(row, folder.id);
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
  folderId,
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
      folderId,
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
    folderId: session.folderId,
    published: session.published,
    file: { filename: session.filename || "course.pptx", buffer: assembled },
    createdBy: session.createdBy
  });
  return { pending: false, course };
}

export async function resetPptCoursesForTests() {
  memory = [];
  memoryCatalog = null;
  uploads.clear();
  await rm(DATA_DIR, { recursive: true, force: true });
  await mkdir(DATA_DIR, { recursive: true });
}

export { DATA_DIR };
