export const VERSION_MAX_LEN = 64;
export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const GATE_VERSION_PATTERN = /^0\.1\.(\d+)-[A-Za-z0-9][A-Za-z0-9-]*$/;

export const HEAD_ONLY_ERROR = "必须按提交时间发布：只允许通过当前第 1 位，禁止跳单和插队，防止叠发把进程打崩。";

export const VERSION_GATE_ERROR =
  "版本号由版本发布中心统一发放，格式 0.1.N-说明。各模块不得自领。交单不填版本号或填 auto，或先 GET /api/releases/next。";

const ACTIVE = new Set(["queued", "approved", "publishing", "success"]);

export function parseReleaseVersion(raw) {
  const version = String(raw || "").trim();
  if (!version) {
    return { ok: false, error: "版本号必填" };
  }
  if (version.length > VERSION_MAX_LEN) {
    return { ok: false, error: `版本号最长 ${VERSION_MAX_LEN} 字` };
  }
  if (version.includes("..") || version.includes("/") || version.includes("\\")) {
    return { ok: false, error: "版本号不能包含路径或 ..，防止发布脚本被带崩" };
  }
  if (/\s/.test(version)) {
    return { ok: false, error: "版本号不能有空格" };
  }
  if (!VERSION_PATTERN.test(version)) {
    return { ok: false, error: "版本号只允许字母数字和 . _ -，且须以字母或数字开头（例如 0.1.20-sider-always）" };
  }
  return { ok: true, version };
}

export function sanitizeSlug(raw) {
  const slug = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "ship";
}

export function parseSeriesNumber(version) {
  const match = String(version || "").match(/^0\.1\.(\d+)(?:-|$)/);
  return match ? Number(match[1]) : null;
}

export function isGateVersion(version) {
  return GATE_VERSION_PATTERN.test(String(version || ""));
}

export function nextSeriesNumber(items) {
  let max = 0;
  for (const item of items || []) {
    if (!item || !ACTIVE.has(item.status)) {
      continue;
    }
    const n = parseSeriesNumber(item.version);
    if (n != null) {
      max = Math.max(max, n);
    }
  }
  return max + 1;
}

export function allocateReleaseVersion(items, slug) {
  return `0.1.${nextSeriesNumber(items)}-${sanitizeSlug(slug)}`;
}

export function describeNextVersion(items, slug = "next") {
  const seq = nextSeriesNumber(items);
  return {
    seq,
    version: `0.1.${seq}-${sanitizeSlug(slug)}`,
    rule: "全站一条号 0.1.N-说明，由闸门发放；失败/驳回不占号；同一 N 不能跨模块再用"
  };
}

export function clashMessage(clash, version) {
  const series = parseSeriesNumber(version);
  const held = parseSeriesNumber(clash?.version);
  if (series != null && held === series) {
    return `号段 0.1.${series} 已被 ${clash.id} ${clash.version}（${clash.status}，${clash.module}）占用。版本号由闸门统一发放，请领取下一号。`;
  }
  return `版本号已占用：${clash.version}（${clash.id} ${clash.status} ${clash.module}）。禁止重复版本号。`;
}

export function findVersionClash(items, version, exceptId = "") {
  const series = parseSeriesNumber(version);
  return (items || []).find((item) => {
    if (!item || item.id === exceptId || !ACTIVE.has(item.status)) {
      return false;
    }
    if (item.version === version) {
      return true;
    }
    return series != null && parseSeriesNumber(item.version) === series;
  });
}

export function resolveReleaseVersion(items, raw, slug) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || trimmed === "auto") {
    const version = allocateReleaseVersion(items, slug);
    return { ok: true, version, allocated: true };
  }
  const parsed = parseReleaseVersion(trimmed);
  if (!parsed.ok) {
    return { ...parsed, status: 400 };
  }
  if (!isGateVersion(parsed.version)) {
    return { ok: false, status: 409, error: VERSION_GATE_ERROR };
  }
  const clash = findVersionClash(items, parsed.version);
  if (clash) {
    return { ok: false, status: 409, error: clashMessage(clash, parsed.version) };
  }
  const next = nextSeriesNumber(items);
  const n = parseSeriesNumber(parsed.version);
  if (n !== next) {
    return {
      ok: false,
      status: 409,
      error: `下一号是 0.1.${next}，不能自领 0.1.${n}。请 GET /api/releases/next 或交单时不填版本号。`
    };
  }
  return { ok: true, version: parsed.version, allocated: false };
}

export function listModuleVersions(items) {
  const success = (items || [])
    .filter((item) => item && item.status === "success")
    .slice()
    .sort((a, b) => String(b.publishFinishedAt || "").localeCompare(String(a.publishFinishedAt || "")));
  const currentByModule = new Map();
  for (const item of success) {
    if (!currentByModule.has(item.module)) {
      currentByModule.set(item.module, item);
    }
  }
  return {
    current: [...currentByModule.values()].map((item) => ({
      id: item.id,
      module: item.module,
      version: item.version,
      publishedAt: item.publishFinishedAt,
      canRollback: Boolean(item.snapshotDir),
      rolledBack: Boolean(item.rolledBack)
    })),
    history: success.map((item) => ({
      id: item.id,
      module: item.module,
      version: item.version,
      publishedAt: item.publishFinishedAt,
      current: currentByModule.get(item.module)?.id === item.id,
      canRollback: Boolean(item.snapshotDir),
      rolledBack: Boolean(item.rolledBack)
    })),
    next: describeNextVersion(items)
  };
}

export function assertQueueHead(item, queue) {
  if (!item) {
    return { status: 404, error: "单据不存在" };
  }
  const head = Array.isArray(queue) && queue[0] ? queue[0] : null;
  if (!head) {
    return { status: 409, error: HEAD_ONLY_ERROR };
  }
  if (head.id !== item.id) {
    return {
      status: 409,
      error: `${HEAD_ONLY_ERROR} 当前第 1 位是 ${head.module} ${head.version}。请先处理队首。`
    };
  }
  return null;
}
