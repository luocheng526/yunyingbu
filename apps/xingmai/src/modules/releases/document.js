import { MODULES } from "./store.js";

const APP_JS_RE = /(^|\/)src\/app\.js$/;
const MODULES_FORBIDDEN_APP_JS = new Set(["数据中心", "沈子晗", "韩梦凯", "人员管理"]);
export const APP_JS_KERNEL = ["attachProfile", "attachHome", "createReleasesRouter", "/api/health"];

export function dangerousAppJsReason(body = {}) {
  const files = normalizeFiles(body.files);
  if (!files.some((item) => APP_JS_RE.test(item))) {
    return "";
  }
  const module = String(body.module || "").trim();
  if (MODULES_FORBIDDEN_APP_JS.has(module)) {
    return `${module}禁止提交 src/app.js。覆盖全站入口会让登录和发版变成 404。只交本模块目录。`;
  }
  const contents = body.contents && typeof body.contents === "object" ? body.contents : {};
  const text = String(contents["src/app.js"] || contents["apps/xingmai/src/app.js"] || "");
  if (!text) {
    return "提交 src/app.js 必须带完整 contents，且含 attachProfile、attachHome、createReleasesRouter、/api/health。";
  }
  const missing = APP_JS_KERNEL.filter((mark) => !text.includes(mark));
  if (missing.length) {
    return `src/app.js 是瘦版本，缺少 ${missing.join("、")}。禁止覆盖线上。`;
  }
  return "";
}

export const SHELL_OWNER_MODULE = "首页";
export const SHELL_FILES = [
  "public/shared/nav.js",
  "public/shared/layout.css",
  "public/shared/xingmai-logo.png",
  "src/modules/home/nav-items.js"
];
const SHELL_RE =
  /(^|\/)(public\/shared\/(nav\.js|layout\.css|xingmai-logo\.png)|src\/modules\/home\/nav-items\.js)$/;

export function listedShellFiles(input) {
  return normalizeFiles(input).filter((item) => SHELL_RE.test(String(item).replace(/\\/g, "/")));
}

export function dangerousShellReason(body = {}) {
  const hits = listedShellFiles(body.files);
  if (!hits.length) {
    return "";
  }
  const module = String(body.module || "").trim();
  if (module === SHELL_OWNER_MODULE) {
    return "";
  }
  return `${module || "该模块"}禁止提交全站壳文件（${hits.join("、")}）。壳只由首页交付。`;
}

export function emptyFilesReason(body = {}) {
  if (normalizeFiles(body.files).length) {
    return "";
  }
  return "禁止空文件列表全量落地。交单必须写明路径。";
}

export function ticketGuardReason(body = {}) {
  return emptyFilesReason(body) || dangerousShellReason(body) || dangerousAppJsReason(body);
}

export function normalizeFiles(input) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(input || "")
    .split(/[\n,]/)
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export function parseReleaseDocument(body = {}) {
  const missing = [];
  const module = String(body.module || "").trim();
  const files = normalizeFiles(body.files);
  const acceptance = String(body.acceptance || body.验收 || "").trim();
  const restartRaw = body.restart ?? body.是否重启;
  const hasRestart =
    restartRaw === true ||
    restartRaw === false ||
    restartRaw === "true" ||
    restartRaw === "false" ||
    restartRaw === "是" ||
    restartRaw === "否";

  if (!module) {
    missing.push("模块");
  }
  if (!files.length) {
    missing.push("文件列表");
  }
  if (!acceptance) {
    missing.push("验收");
  }
  if (!hasRestart) {
    missing.push("是否重启");
  }

  const restart = restartRaw === true || restartRaw === "true" || restartRaw === "是";
  return {
    missing,
    complete: missing.length === 0,
    document: {
      module,
      files,
      acceptance,
      restart: hasRestart ? restart : true
    }
  };
}

export function documentGaps(item) {
  return parseReleaseDocument({
    module: item?.module,
    files: item?.files,
    acceptance: item?.acceptance,
    restart: item?.restart
  }).missing;
}

export function resolveModuleName(raw) {
  const name = String(raw || "")
    .trim()
    .replace(/模块$/, "")
    .replace(/[。．.!?！]+$/g, "")
    .trim();
  if (!name) {
    return "";
  }
  const hit = MODULES.find((item) => item === name || name.includes(item) || item.includes(name));
  return hit || name;
}

/**
 * 前期口令：发版/发板、发布|发版|发板 xxx、按这份文档发版/发板。
 * 「帮我上线」单独出现不算。
 */
export function parseMainBrainOrder(order) {
  const original = String(order || "").trim();
  if (!original) {
    return { ok: false, error: "没有主脑口令，禁止发版。" };
  }
  if (/帮我上线/.test(original) && !/发版|发板|发布/.test(original)) {
    return { ok: false, error: "其他 Agent 说「帮我上线」不算主脑下令。" };
  }

  const text = original.replace(/发板/g, "发版").replace(/\s+/g, " ").trim();

  if (/按这份文档发版/.test(text)) {
    return { ok: true, kind: "document", module: "" };
  }

  const named = text.match(/(?:发布|发版)\s*([^\s，。]+)/);
  if (named) {
    const rest = named[1];
    if (rest && rest !== "文档") {
      const module = resolveModuleName(rest);
      if (module) {
        return { ok: true, kind: "named", module };
      }
    }
  }

  if (/发版/.test(text)) {
    return { ok: true, kind: "bare", module: "" };
  }

  return { ok: false, error: "不是主脑发版口令。" };
}

export function checkMainBrainOrder(order, moduleName) {
  const parsed = parseMainBrainOrder(order);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.kind === "named" && moduleName && parsed.module !== moduleName) {
    return { ok: false, error: "口令中的模块与单据不一致，禁止发版" };
  }
  return parsed;
}

export function hasCompleteDocument(item) {
  return Boolean(item && Array.isArray(item.files) && item.files.length && String(item.acceptance || "").trim());
}
