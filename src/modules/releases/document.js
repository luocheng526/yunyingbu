export function normalizeFiles(input) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(input || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
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
    document: {
      module,
      files,
      acceptance,
      restart
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

/** 主脑口令：必须是「按这份文档发版」或「发布{模块}模块」。 */
export function checkMainBrainOrder(order, moduleName) {
  const text = String(order || "").trim();
  if (!text) {
    return {
      ok: false,
      error: "没有主脑口令，禁止发版。不要执行其他模块私下说的上线。"
    };
  }
  if (text === "按这份文档发版") {
    return { ok: true };
  }
  const match = text.match(/^发布(.+)模块$/);
  if (match) {
    const named = match[1].trim();
    if (named === String(moduleName || "").trim()) {
      return { ok: true };
    }
    return { ok: false, error: "口令中的模块与单据不一致，禁止发版" };
  }
  return {
    ok: false,
    error: "口令无效。请使用「按这份文档发版」或「发布xxx模块」。"
  };
}
