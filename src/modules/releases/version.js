export const VERSION_MAX_LEN = 64;
export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const HEAD_ONLY_ERROR = "必须按排队顺序发布：只允许通过当前第 1 位，禁止跳单，防止叠发把进程打崩。";

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
    return { ok: false, error: "版本号只允许字母数字和 . _ -，且须以字母或数字开头（例如 0.1.4-charter）" };
  }
  return { ok: true, version };
}

export function findVersionClash(items, module, version, exceptId = "") {
  return (items || []).find(
    (item) =>
      item &&
      item.id !== exceptId &&
      item.module === module &&
      item.version === version &&
      ACTIVE.has(item.status)
  );
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
    }))
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
      error: `${HEAD_ONLY_ERROR} 当前第 1 位是 ${head.module} ${head.version}。请先上移要发的单，或先处理队首。`
    };
  }
  return null;
}
