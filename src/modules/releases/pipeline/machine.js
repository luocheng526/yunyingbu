import { TRANSITIONS } from "./constants.js";

export function assertTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    const error = new Error(`非法状态跳转：${from} -> ${to}`);
    error.code = "illegal_transition";
    throw error;
  }
}

export function applyTransition(record, to, { actor, reason, now } = {}) {
  const from = record.state;
  assertTransition(from, to);
  record.state = to;
  record.updatedAt = now || new Date().toISOString();
  record.transitions = record.transitions || [];
  record.transitions.push({
    from,
    to,
    actor: actor || "system",
    reason: reason || "",
    at: record.updatedAt
  });
  return record;
}
