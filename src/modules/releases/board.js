export const BOARD_PAGE_SIZE = 20;

export function newestFirst(a, b) {
  return String(b.publishFinishedAt || b.reviewedAt || b.submittedAt || "").localeCompare(
    String(a.publishFinishedAt || a.reviewedAt || a.submittedAt || "")
  );
}

export function paginateRows(rows, page, limit) {
  const size = Math.min(50, Math.max(1, Number(limit) || BOARD_PAGE_SIZE));
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / size) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const start = (current - 1) * size;
  return {
    items: list.slice(start, start + size),
    page: current,
    pageCount,
    total,
    limit: size
  };
}

export function summarizeItems(items) {
  const summary = {
    queued: 0,
    approved: 0,
    publishing: 0,
    failed: 0,
    success: 0,
    logs: 0,
    rolledBack: 0
  };
  for (const item of items || []) {
    if (item.status === "queued") {
      summary.queued += 1;
    } else if (item.status === "approved") {
      summary.approved += 1;
    } else if (item.status === "publishing") {
      summary.publishing += 1;
    } else if (item.status === "failed") {
      summary.failed += 1;
    } else if (item.status === "success") {
      summary.success += 1;
      if (item.rolledBack) {
        summary.rolledBack += 1;
      }
    }
    if (item.log) {
      summary.logs += 1;
    }
  }
  return summary;
}

export function slimHistoryItem(item) {
  return {
    id: item.id,
    version: item.version,
    module: item.module,
    summary: item.summary || "",
    status: item.status,
    demo: Boolean(item.demo),
    publishFinishedAt: item.publishFinishedAt || null,
    reviewedAt: item.reviewedAt || null,
    submittedAt: item.submittedAt || null,
    snapshotDir: item.snapshotDir || "",
    rolledBack: Boolean(item.rolledBack)
  };
}

export function slimLogItem(item) {
  return {
    id: item.id,
    version: item.version,
    module: item.module,
    status: item.status,
    log: item.log || "",
    publishFinishedAt: item.publishFinishedAt || null,
    reviewedAt: item.reviewedAt || null,
    submittedAt: item.submittedAt || null
  };
}

export function slimVersionItem(item) {
  return {
    id: item.id,
    version: item.version,
    status: item.status,
    module: item.module,
    publishFinishedAt: item.publishFinishedAt || null,
    snapshotDir: item.snapshotDir || "",
    rolledBack: Boolean(item.rolledBack)
  };
}
