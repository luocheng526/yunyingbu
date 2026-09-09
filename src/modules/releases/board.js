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

export async function readBoardView(store, view, page, limit, listed) {
  const loadAll = async () => (typeof listed === "function" ? listed() : store.list());
  try {
    if (view === "summary") {
      if (typeof store.boardSummary === "function") {
        return await store.boardSummary();
      }
      return summarizeItems(await loadAll());
    }
    if (view === "history") {
      if (typeof store.historyPage === "function") {
        return await store.historyPage(page, limit);
      }
      const rows = (await loadAll())
        .filter((item) => item.status === "success")
        .slice()
        .sort(newestFirst)
        .map(slimHistoryItem);
      return paginateRows(rows, page, limit);
    }
    if (view === "logs") {
      if (typeof store.logsPage === "function") {
        return await store.logsPage(page, limit);
      }
      const rows = (await loadAll())
        .filter((item) => item.log)
        .slice()
        .sort(newestFirst)
        .map(slimLogItem);
      return paginateRows(rows, page, limit);
    }
  } catch {
    const items = await loadAll();
    if (view === "summary") {
      return summarizeItems(items);
    }
    if (view === "history") {
      return paginateRows(
        items.filter((item) => item.status === "success").slice().sort(newestFirst).map(slimHistoryItem),
        page,
        limit
      );
    }
    if (view === "logs") {
      return paginateRows(items.filter((item) => item.log).slice().sort(newestFirst).map(slimLogItem), page, limit);
    }
  }
  return null;
}
