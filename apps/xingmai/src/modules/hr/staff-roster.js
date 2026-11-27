import { randomBytes } from "node:crypto";
import { canEditRoster } from "../people/org-acl.js";
import { createPerson, hydratePeopleRoster, listPeople, patchPerson, removePeople } from "../people/store.js";

export async function readOrganization() {
  await hydratePeopleRoster();
  return listPeople().filter((person) => !person.demo);
}

export function matchOrganization(staff, people) {
  const job = staff.jobNumber;
  const withJob = job ? people.filter((person) => person.employeeNo === job) : [];
  if (withJob.length) return withJob.length === 1 ? withJob[0] : null;
  const named = people.filter((person) => person.name === staff.name);
  if (named.length !== 1) return null;
  const [person] = named;
  return !job || !person.employeeNo || person.employeeNo === job ? person : null;
}

export function staffWithOrganization(staff, person) {
  if (!person) return { ...staff, group: staff.group || "", needsOrganization: true };
  return {
    ...staff,
    orgPersonId: person.id,
    name: person.name,
    status: person.status,
    department: person.department || person.center,
    position: person.role,
    group: person.supervisor || "",
    board: person.rosterBoard || person.board,
    lineManager: person.lineManager || "",
    jobNumber: staff.jobNumber || person.employeeNo || "",
    leftOn: person.status === "离职" ? staff.leftOn : "",
    employmentStage: person.status === "离职" || staff.status === "离职" ? null : staff.employmentStage,
    needsOrganization: false
  };
}

export function organizationPatch(staff, person, people) {
  const patch = {};
  for (const field of ["name", "status"]) {
    if (Object.hasOwn(staff, field) && staff[field] !== person?.[field]) patch[field] = staff[field];
  }
  if (person?.role && Object.hasOwn(staff, "position") && !staff.position) {
    throw Object.assign(new Error("组织中心岗位不能为空"), { statusCode: 400 });
  }
  if (staff.position && staff.position !== person?.role) patch.role = staff.position;
  if (Object.hasOwn(staff, "department") && staff.department !== person?.department) {
    const department = staff.department;
    const legacyGroup = /^(运营.+组)[（(]([^）)]+)[）)]$/.exec(department);
    const legacyManager = /^(运营一[区區]|运营二[区區])(?:[（(].+[）)])?$/.exec(department);
    if (legacyGroup) {
      patch.supervisor = legacyGroup[2];
    } else if (legacyManager) {
      const manager = legacyManager[1].includes("一") ? "韩梦凯" : "沈子晗";
      Object.assign(patch, {
        department: manager + "运营中心", center: manager + "运营中心",
        board: "ops", lineManager: manager, supervisor: ""
      });
    } else {
      patch.department = department;
      if (department === "人事部" || department === "技术部" || department === "后端部门") {
        Object.assign(patch, {
          board: { 人事部: "hr", 技术部: "tech", 后端部门: "backend" }[department],
          center: "其他", lineManager: "", supervisor: "", reserve: ""
        });
      } else if (["韩梦凯运营中心", "沈子晗运营中心"].includes(department)) {
        Object.assign(patch, { board: "ops", center: department, lineManager: department.slice(0, 3), supervisor: "", reserve: "" });
      }
    }
  }
  if (Object.hasOwn(staff, "group") && staff.group !== person?.supervisor && (staff.group || !patch.supervisor)) {
    patch.supervisor = staff.group;
  }
  if (patch.supervisor && patch.supervisor !== person?.supervisor) {
    const lead = people.find((row) => row.name === patch.supervisor && row.status === "在职");
    const manager = lead?.role === "经理" ? lead.name : lead?.lineManager;
    if (manager && ["韩梦凯", "沈子晗"].includes(manager)) {
      Object.assign(patch, { lineManager: manager, center: manager + "运营中心", department: manager + "运营中心", board: "ops" });
    }
    if (person?.reserve) patch.reserve = "";
  }
  // Department presets and imports may resolve to the existing organization fields.
  return Object.fromEntries(Object.entries(patch).filter(([key, value]) =>
    value !== (key === "role" ? person?.role : key === "board" ? person?.rosterBoard || person?.board : person?.[key])));
}

function requireEditor(actor) {
  if (canEditRoster(actor)) return;
  throw Object.assign(new Error("需要组织中心的成员编辑权限才能修改共用花名册"), { statusCode: 403 });
}

function requireResult(result) {
  if (!result.ok) throw Object.assign(new Error(result.error), { statusCode: result.statusCode });
  return result;
}

export async function saveOrganization(staff, person, people, actor) {
  const patch = organizationPatch(staff, person, people);
  if (person && !Object.keys(patch).length) return person;
  requireEditor(actor);
  if (person) return requireResult(await patchPerson(person.id, patch)).person;
  if (listPeople().some((entry) =>
    entry.name === staff.name || entry.username === staff.name || (staff.jobNumber && entry.employeeNo === staff.jobNumber))) {
    throw Object.assign(new Error("组织中心已有同名人员，请核对工号后再同步"), { statusCode: 409 });
  }
  return requireResult(await createPerson({
    ...patch, name: staff.name, employeeNo: staff.jobNumber || "", password: randomBytes(24).toString("base64url")
  })).person;
}

export async function removeFromOrganization(person, actor) {
  requireEditor(actor);
  return requireResult(await removePeople([person.id]));
}
