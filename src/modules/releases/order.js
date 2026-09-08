/** Queue is submit-time FIFO. No jump-the-line. */

export function compareSubmit(a, b) {
  const ta = String(a.submittedAt || "");
  const tb = String(b.submittedAt || "");
  if (ta !== tb) {
    return ta.localeCompare(tb);
  }
  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function assignSubmitOrder(queued) {
  const ordered = (queued || []).slice().sort(compareSubmit);
  ordered.forEach((item, index) => {
    item.priority = index + 1;
  });
  return ordered;
}

/** @deprecated 排队只按提交时间，不再按文件层重排。 */
export const assignStablePriorities = assignSubmitOrder;
