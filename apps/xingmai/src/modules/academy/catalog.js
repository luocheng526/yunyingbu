import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "../../../public/academy-catalog.json");
const DATA = JSON.parse(readFileSync(catalogPath, "utf8"));

export const SCHEMA = DATA.schema || ["title", "category", "body", "published"];
export const CATEGORIES = DATA.categories || [];
export const DOCS = Array.isArray(DATA.docs) ? DATA.docs : [];

function cloneDoc(doc, { includeBody = true } = {}) {
  const row = {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    categoryId: doc.categoryId,
    published: Boolean(doc.published)
  };
  if (includeBody) {
    row.body = String(doc.body || "");
  }
  return row;
}

function matchPublished(doc, published) {
  if (published === "all" || published == null) {
    return true;
  }
  return Boolean(doc.published) === Boolean(published);
}

export function listDocs({ published = true, categoryId = "", includeBody = false } = {}) {
  return DOCS.filter((doc) => {
    if (!matchPublished(doc, published)) {
      return false;
    }
    if (categoryId && doc.categoryId !== categoryId && doc.category !== categoryId) {
      return false;
    }
    return true;
  }).map((doc) => cloneDoc(doc, { includeBody }));
}

export function getDoc(id, { allowUnpublished = false } = {}) {
  const doc = DOCS.find((item) => item.id === String(id || ""));
  if (!doc) {
    return null;
  }
  if (!doc.published && !allowUnpublished) {
    return null;
  }
  return cloneDoc(doc, { includeBody: true });
}

export function searchDocs(query, { published = true, categoryId = "", limit = 20 } = {}) {
  const q = String(query || "").trim();
  const pool = listDocs({ published, categoryId, includeBody: true });
  if (!q) {
    return pool.slice(0, limit).map((doc) => ({ ...doc, score: 0 }));
  }
  const hits = [];
  for (const doc of pool) {
    const title = String(doc.title || "");
    const category = String(doc.category || "");
    const body = String(doc.body || "");
    let score = 0;
    if (title === q) {
      score += 8;
    }
    if (title.includes(q)) {
      score += 5;
    }
    if (category.includes(q)) {
      score += 3;
    }
    if (body.includes(q)) {
      score += 1;
    }
    if (score > 0) {
      hits.push({ ...doc, score });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh"));
  return hits.slice(0, Math.max(1, Number(limit) || 20));
}

export function listCatalog() {
  const published = listDocs({ published: true, includeBody: false });
  const drafts = listDocs({ published: false, includeBody: false });
  return {
    title: DATA.title || "甄选商学院",
    schema: SCHEMA,
    note: DATA.note || "",
    categories: CATEGORIES.filter((item) => item.id !== "draft"),
    docs: published,
    stats: {
      categories: CATEGORIES.filter((item) => item.id !== "draft").length,
      published: published.length,
      drafts: drafts.length
    }
  };
}

export function listLessonIds() {
  return DOCS.filter((doc) => doc.published).map((doc) => ({
    courseId: doc.categoryId,
    lessonId: doc.id,
    docId: doc.id
  }));
}
