const FULL = new Set(["罗成", "管理员"]);
const LINE_LEADERS = new Set(["罗成", "沈子晗", "韩梦凯", "管理员"]);

export function normalizeGroupId(value) {
  return String(value || "")
    .trim()
    .replace(/组$/, "");
}

export function groupIdOf(row = {}) {
  const explicit = normalizeGroupId(row.groupId);
  if (explicit) {
    return explicit;
  }
  const supervisor = String(row.supervisor || "").trim();
  const operator = String(row.operator || row.owner || "").trim();
  const lead = String(row.lead || "").trim();
  const manager = String(row.manager || "").trim();
  if (supervisor && !LINE_LEADERS.has(supervisor)) {
    return supervisor;
  }
  if (lead && !LINE_LEADERS.has(lead)) {
    return lead;
  }
  if (operator && !LINE_LEADERS.has(operator)) {
    return operator;
  }
  return normalizeGroupId(row.team || row.chief || manager || "未分组");
}

export function scopeOf(actor) {
  const name = normalizeGroupId(actor);
  if (!name || FULL.has(name) || name.includes("罗成")) {
    return { key: "all", actor: name || "罗成", groupId: "", label: "可改全部团队" };
  }
  if (name.includes("沈子晗")) {
    return { key: "shen", actor: name, groupId: "", label: "仅沈子晗组" };
  }
  if (name.includes("韩梦凯")) {
    return { key: "han", actor: name, groupId: "", label: "仅韩梦凯组" };
  }
  return { key: "group", actor: name, groupId: name, label: "仅" + name + "组" };
}

function teamBlob(row) {
  return [row.team, row.chief, row.lead, row.manager, row.director, row.supervisor, row.operator, row.groupId].join(" ");
}

export function rowMatchesScope(row, scope) {
  if (!scope || scope.key === "all") {
    return true;
  }
  if (scope.key === "group") {
    return groupIdOf(row) === scope.groupId;
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

/** 成员表五级线：只有罗成、韩梦凯、沈子晗能双击改。 */
export function canEditRoster(actor) {
  const name = normalizeGroupId(actor);
  return name.includes("罗成") || name.includes("沈子晗") || name.includes("韩梦凯");
}

export function assertCanWrite(actor, row, next = null) {
  if (!canEditStore(actor, row)) {
    return { ok: false, statusCode: 403, error: "超出责权：只能改本小组店铺" };
  }
  if (next && !canEditStore(actor, { ...row, ...next })) {
    return { ok: false, statusCode: 403, error: "不能把店铺改到其它小组名下" };
  }
  return { ok: true };
}

export function assertCanImportRow(actor, row, selectedGroupId = "") {
  const scope = scopeOf(actor);
  const gid = groupIdOf(row);
  const picked = normalizeGroupId(selectedGroupId);
  if (picked && gid !== picked) {
    return { ok: false, statusCode: 403, error: "不在当前选择的小组范围内" };
  }
  if (scope.key === "group" && gid !== scope.groupId) {
    return { ok: false, statusCode: 403, error: "只能导入本组店铺，其它小组已跳过" };
  }
  if (!canEditStore(actor, row)) {
    return { ok: false, statusCode: 403, error: "超出责权：只能导入本团队店铺" };
  }
  return { ok: true };
}
