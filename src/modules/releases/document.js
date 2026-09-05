import { MODULES } from "./store.js";

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
