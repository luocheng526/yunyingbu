import { STATES } from "./constants.js";
import { applyTransition } from "./machine.js";

export function createPipelineStore({ now } = {}) {
  const stamp = () => (now ? now() : new Date().toISOString());
  const candidates = [];
  const deliveries = [];
  const outbox = [];
  const leases = [];

  return {
    list() {
      return candidates.slice();
    },
    pending() {
      return candidates.filter((row) => row.state === STATES.pending_approval && !row.dirty);
    },
    get(id) {
      return candidates.find((row) => row.id === id) || null;
    },
    byReleaseId(releaseId) {
      return candidates.find((row) => row.releaseId === releaseId) || null;
    },
    findDelivery(deliveryId) {
      return deliveries.find((row) => row.deliveryId === deliveryId) || null;
    },
    recordDelivery(entry) {
      const existing = this.findDelivery(entry.deliveryId);
      if (existing) {
        return { duplicate: true, entry: existing };
      }
      const row = { ...entry, createdAt: stamp() };
      deliveries.push(row);
      return { duplicate: false, entry: row };
    },
    insertCandidate(row) {
      const existing = candidates.find((item) => item.id === row.id);
      if (existing) {
        return existing;
      }
      candidates.push(row);
      return row;
    },
    supersedeOlder({ repository, prNumber, mergeSha, actor }) {
      for (const row of candidates) {
        if (
          row.repository === repository &&
          row.prNumber === prNumber &&
          row.mergeSha !== mergeSha &&
          (row.state === STATES.pending_approval || row.state === STATES.artifact_ready)
        ) {
          applyTransition(row, STATES.superseded, {
            actor,
            reason: "被更新的 merge SHA 替代",
            now: stamp()
          });
        }
      }
    },
    transition(id, to, meta) {
      const row = this.get(id);
      if (!row) {
        throw new Error("候选不存在");
      }
      return applyTransition(row, to, { ...meta, now: stamp() });
    },
    pushOutbox(message) {
      outbox.push({ ...message, createdAt: stamp(), status: "pending" });
    },
    outbox() {
      return outbox.slice();
    },
    leases() {
      return leases.slice();
    }
  };
}
