import { effectiveSiteAcl } from "./site-acl.js";

export function permissionsFor(user, module) {
  const sheet = effectiveSiteAcl(typeof user === "string" ? user : user?.username || user?.name || "");
  const cap = sheet.modules[module];
  return {
    configured: sheet.configured,
    can: (feature, right = "enter") => !sheet.configured || Boolean(cap?.[right] && cap.features?.[`${module}.${feature}`]?.[right]),
    any: (right = "enter") => !sheet.configured || Boolean(cap?.[right] && Object.values(cap.features || {}).some(value => value[right]))
  };
}

export const feedbackFeature = status => ({ doing: "doing", accept: "doing", closed: "closed", rejected: "reject" }[status] || "open");
export const noticeFeature = category => ({ hr: "hr", promotion: "promotion", board: "board", values: "values", daily: "daily", anniversary: "daily" }[category] || "all");

export const meetingSections = { ranks: "rank", intros: "people", levels: "levels", goals: "goals", stars: "stars" };
export const meetingKpis = { hours: "hours", rank: "rank", profit: "profit", new: "people", star: "stars" };
export function filterMeetingBoard(board, policy) {
  if (!policy.configured) return board;
  const next = { ...board, kpis: board.kpis.filter(item => policy.can(meetingKpis[item.key])) };
  for (const [key, feature] of Object.entries(meetingSections)) if (!policy.can(feature)) next[key] = [];
  return next;
}
