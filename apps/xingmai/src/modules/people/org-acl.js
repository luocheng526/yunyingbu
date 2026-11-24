let canonicalActor = value => value;
let featureAllowed = () => false;
let isConfigured = () => false;
let storeAllowed = () => false;
export function registerOrganizationPermissions(source) {
  ({ canonicalActor, featureAllowed, isConfigured, storeAllowed } = source);
}
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

export function actorKey(actor) {
  const name = normalizeGroupId(canonicalActor(actor));
  if (name === "luocheng") {
    return "罗成";
  }
  return name;
}

export function scopeOf(actor) {
  const name = actorKey(actor);
  if (FULL.has(name)) {
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
    return groupIdOf(row) === scope.groupId || ["director", "manager", "supervisor", "reserve", "operator", "assistant"].some(key => normalizeGroupId(row[key]) === scope.actor);
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

// Explicit organization master-data access is independent of operational
// responsibility and downstream business-data grants.
export function storeScopeOf(actor, cap = "enter") {
  const scope = scopeOf(actor);
  if (scope.key === "all") return scope;
  if (isConfigured(actor) && featureAllowed(actor, "people.stores", cap)) {
    return { key: "all", actor: scope.actor, groupId: "", label: cap === "edit" ? "可管理全部店铺主数据" : "可查看全部店铺主数据" };
  }
  return scope;
}

export function canEditStore(actor, row) {
  if (scopeOf(actor).key !== "all" && isConfigured(actor) && !featureAllowed(actor, "people.stores", "edit")) return false;
  return rowMatchesScope(row, storeScopeOf(actor, "edit"));
}

/** 成员表五级线：只有罗成、韩梦凯、沈子晗能双击改。 */
export function canEditRoster(actor) {
  const name = actorKey(actor);
  return ["罗成", "沈子晗", "韩梦凯"].includes(name) || (isConfigured(name) && featureAllowed(name, "people.members", "edit"));
}

function samePerson(actor, person) {
  const name = actorKey(actor);
  if (!name || !person) {
    return false;
  }
  const personName = normalizeGroupId(person.name);
  const username = normalizeGroupId(person.username);
  return name === personName || (Boolean(username) && name === username);
}

// Credential fields follow explicit member-management permissions. The owner
// account remains protected; unconfigured accounts retain their legacy scope.
export function canSeeLogin(actor, person) {
  if (samePerson(actor, person)) {
    return true;
  }
  const scope = scopeOf(actor);
  if (scope.key === "all") {
    return true;
  }
  if (isAdministratorPerson(person)) return false;
  if (isConfigured(actor)) return featureAllowed(actor, "people.members", "enter");
  if (scope.key === "shen" || scope.key === "han") {
    return canAssignPerson(actor, person);
  }
  return false;
}

export function canEditLogin(actor, person) {
  if (scopeOf(actor).key === "all") return true;
  if (isAdministratorPerson(person)) return false;
  if (isConfigured(actor)) return featureAllowed(actor, "people.members", "edit");
  return canSeeLogin(actor, person);
}

function isAdministratorPerson(person) {
  return Boolean(person && [person.name, person.username].some(value => ["罗成", "luocheng", "管理员"].includes(String(value || "").trim())));
}

export function canAssignSiteAcl(actor) {
  const name = actorKey(actor);
  return ["罗成", "沈子晗", "韩梦凯"].includes(name) || (isConfigured(name) && featureAllowed(name, "people.acl", "edit"));
}

export function personBranch(person) {
  const name = normalizeGroupId(person && person.name != null ? person.name : person);
  if (name.includes("罗成") || name === "管理员") {
    return "all";
  }
  if (name.includes("韩梦凯")) {
    return "han";
  }
  if (name.includes("沈子晗")) {
    return "shen";
  }
  const blob = [
    person && person.lineManager,
    person && person.manager,
    person && person.center,
    person && person.department,
    person && person.director
  ].join(" ");
  if (blob.includes("韩梦凯")) {
    return "han";
  }
  if (blob.includes("沈子晗")) {
    return "shen";
  }
  return "";
}

export function canAssignPerson(actor, person) {
  if (!canAssignSiteAcl(actor)) {
    return false;
  }
  const scope = scopeOf(actor);
  if (isConfigured(actor) && featureAllowed(actor, "people.acl", "edit") && !["沈子晗", "韩梦凯"].includes(actorKey(actor))) return true;
  if (scope.key === "all") {
    return true;
  }
  const branch = personBranch(person);
  if (scope.key === "shen") {
    return branch === "shen";
  }
  if (scope.key === "han") {
    return branch === "han";
  }
  return false;
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
  const scope = storeScopeOf(actor, "edit");
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
