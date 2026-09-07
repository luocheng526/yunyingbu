import { STATES } from "./constants.js";
import { applyTransition } from "./machine.js";
import { readJsonFile, writeJsonFile } from "../persist-json.js";

export function createPipelineStore({ now, persistPath } = {}) {
  const stamp = () => (now ? now() : new Date().toISOString());
  const saved = readJsonFile(persistPath, null);
  const candidates = Array.isArray(saved?.candidates) ? saved.candidates : [];
  const deliveries = Array.isArray(saved?.deliveries) ? saved.deliveries : [];
  const outbox = Array.isArray(saved?.outbox) ? saved.outbox : [];
  const leases = Array.isArray(saved?.leases) ? saved.leases : [];

  function persist() {
    writeJsonFile(persistPath, { candidates, deliveries, outbox, leases });
  }

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
      persist();
      return { duplicate: false, entry: row };
    },
    insertCandidate(row) {
      const existing = candidates.find((item) => item.id === row.id);
      if (existing) {
        return existing;
      }
      candidates.push(row);
      persist();
      return row;
    },
    consumeOverlay({ ciRunId, ciRunAttempt }) {
      const idx = candidates.findIndex(
        (row) =>
          row.overlay &&
          Number(row.ciRunId) === Number(ciRunId) &&
          Number(row.ciRunAttempt) === Number(ciRunAttempt)
      );
      if (idx < 0) {
        return null;
      }
      const [removed] = candidates.splice(idx, 1);
      persist();
      return removed;
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
      persist();
    },
    transition(id, to, meta) {
      const row = this.get(id);
      if (!row) {
        throw new Error("候选不存在");
      }
      const updated = applyTransition(row, to, { ...meta, now: stamp() });
      persist();
      return updated;
    },
    pushOutbox(message) {
      outbox.push({ ...message, createdAt: stamp(), status: "pending" });
      persist();
    },
    outbox() {
      return outbox.slice();
    },
    leases() {
      return leases.slice();
    }
  };
}
