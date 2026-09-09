const FULL = new Set(["罗成", "管理员"]);

export function scopeOf(actor) {
  const name = String(actor || "").trim();
  if (!name || FULL.has(name) || name.includes("罗成")) {
    return { key: "all", actor: name || "罗成", label: "可改全部团队" };
  }
  if (name.includes("沈子晗")) {
    return { key: "shen", actor: name, label: "仅沈子晗组" };
  }
  if (name.includes("韩梦凯")) {
    return { key: "han", actor: name, label: "仅韩梦凯组" };
  }
  return { key: "none", actor: name, label: "只读" };
}

function teamBlob(row) {
  return [row.team, row.chief, row.lead].join(" ");
}

export function rowMatchesScope(row, scope) {
  if (!scope || scope.key === "all") {
    return true;
  }
  const blob = teamBlob(row);
  if (scope.key === "shen") {
    return blob.includes("沈子晗");
  }
  if (scope.key === "han") {
    return blob.includes("韩梦凯");
  }
  return false;
}

export function canEditStore(actor, row) {
  return rowMatchesScope(row, scopeOf(actor));
}

export function assertCanWrite(actor, row, next = null) {
  if (!canEditStore(actor, row)) {
    return { ok: false, statusCode: 403, error: "超出责权：只能改本团队店铺" };
  }
  if (next && !canEditStore(actor, { ...row, ...next })) {
    return { ok: false, statusCode: 403, error: "不能把店铺改到其它团队名下" };
  }
  return { ok: true };
}
