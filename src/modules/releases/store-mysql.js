import { getPool } from "../../db/pool.js";
import { REVIEWER } from "./store-memory.js";

function toIso(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function parseFiles(value) {
  if (Array.isArray(value)) {
    return value.slice();
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function mapTicketRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    version: row.version,
    applicant: row.applicant,
    source: row.source,
    module: row.module,
    summary: row.summary,
    files: parseFiles(row.files),
    acceptance: row.acceptance || "",
    restart: Boolean(row.restart),
    status: row.status,
    demo: Boolean(row.demo),
    priority: Number(row.priority) || 0,
    submittedAt: toIso(row.submitted_at),
    reviewer: row.reviewer || null,
    reviewedAt: toIso(row.reviewed_at),
    rejectReason: row.reject_reason || null,
    publishStartedAt: toIso(row.publish_started_at),
    publishFinishedAt: toIso(row.publish_finished_at),
    log: row.log || ""
  };
}

function decorateQueue(list) {
  return list.map((item, index) => {
    item.queueIndex = index + 1;
    return item;
  });
}

export function createMysqlStore({ now, pool } = {}) {
  const timestamp = () => (now ? now() : new Date().toISOString());
  const db = () => pool || getPool();
  let lock = null;

  async function queuedRows() {
    const [rows] = await db().query(
      "SELECT * FROM release_tickets WHERE status = 'queued' ORDER BY priority ASC, submitted_at ASC, id ASC"
    );
    return rows.map(mapTicketRow);
  }

  async function persist(item) {
    await db().query(
      `UPDATE release_tickets SET
        version = ?, applicant = ?, source = ?, module = ?, summary = ?, files = ?,
        acceptance = ?, restart = ?, status = ?, priority = ?, demo = ?,
        submitted_at = ?, reviewer = ?, reviewed_at = ?, reject_reason = ?,
        publish_started_at = ?, publish_finished_at = ?, log = ?
      WHERE id = ?`,
      [
        item.version,
        item.applicant,
        item.source,
        item.module,
        item.summary,
        JSON.stringify(item.files || []),
        item.acceptance || "",
        item.restart ? 1 : 0,
        item.status,
        item.priority,
        item.demo ? 1 : 0,
        item.submittedAt ? new Date(item.submittedAt) : null,
        item.reviewer,
        item.reviewedAt ? new Date(item.reviewedAt) : null,
        item.rejectReason,
        item.publishStartedAt ? new Date(item.publishStartedAt) : null,
        item.publishFinishedAt ? new Date(item.publishFinishedAt) : null,
        item.log || "",
        item.id
      ]
    );
    return item;
  }

  return {
    backend: "mysql",
    async list() {
      const [rows] = await db().query("SELECT * FROM release_tickets ORDER BY submitted_at ASC, id ASC");
      return rows.map(mapTicketRow);
    },
    async queue() {
      return decorateQueue(await queuedRows());
    },
    async history() {
      const [rows] = await db().query(
        "SELECT * FROM release_tickets WHERE status IN ('success', 'failed', 'rejected') ORDER BY COALESCE(reviewed_at, submitted_at) DESC, id DESC"
      );
      return rows.map(mapTicketRow);
    },
    async approved() {
      const [rows] = await db().query("SELECT * FROM release_tickets WHERE status = 'approved'");
      return rows.map(mapTicketRow);
    },
    async get(id) {
      const [rows] = await db().query("SELECT * FROM release_tickets WHERE id = ? LIMIT 1", [id]);
      return mapTicketRow(rows[0]);
    },
    async getLock() {
      if (!lock) {
        return { locked: false };
      }
      const current = await this.get(lock.id);
      return {
        locked: true,
        current: current
          ? {
              id: current.id,
              version: current.version,
              status: current.status,
              startedAt: lock.startedAt
            }
          : { id: lock.id, version: lock.version, startedAt: lock.startedAt }
      };
    },
    async tryAcquireLock(item) {
      if (lock) {
        return false;
      }
      lock = { id: item.id, version: item.version, startedAt: timestamp() };
      return true;
    },
    async releaseLock() {
      lock = null;
    },
    async create({ version, applicant, source, module, summary, files, acceptance, restart }) {
      const who = String(applicant || "").trim();
      const [prioRows] = await db().query(
        "SELECT COALESCE(MAX(priority), 0) AS max_priority FROM release_tickets WHERE status = 'queued'"
      );
      const priority = Number(prioRows[0]?.max_priority || 0) + 1;
      const [idRows] = await db().query(
        "SELECT id FROM release_tickets WHERE id LIKE 'rel-%' ORDER BY CAST(SUBSTRING(id, 5) AS UNSIGNED) DESC LIMIT 1"
      );
      const seq = idRows[0] ? Number(String(idRows[0].id).slice(4)) + 1 : 1;
      const item = {
        id: `rel-${Number.isFinite(seq) && seq > 0 ? seq : Date.now()}`,
        version: String(version).trim(),
        applicant: who,
        source: String(source || who).trim(),
        module: String(module).trim(),
        summary: String(summary).trim(),
        files: Array.isArray(files) ? files.slice() : [],
        acceptance: String(acceptance || "").trim(),
        restart: Boolean(restart),
        status: "queued",
        demo: false,
        priority,
        submittedAt: timestamp(),
        reviewer: null,
        reviewedAt: null,
        rejectReason: null,
        publishStartedAt: null,
        publishFinishedAt: null,
        log: "已进入发版看板排队。主脑在网页点通过才放行；下一条不会自动发。"
      };
      await db().query(
        `INSERT INTO release_tickets (
          id, version, applicant, source, module, summary, files, acceptance, restart,
          status, priority, demo, submitted_at, reviewer, reviewed_at, reject_reason,
          publish_started_at, publish_finished_at, log
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.version,
          item.applicant,
          item.source,
          item.module,
          item.summary,
          JSON.stringify(item.files),
          item.acceptance,
          item.restart ? 1 : 0,
          item.status,
          item.priority,
          0,
          new Date(item.submittedAt),
          null,
          null,
          null,
          null,
          null,
          item.log
        ]
      );
      return item;
    },
    async reject(id, reason) {
      const item = await this.get(id);
      if (!item) {
        return { error: "单据不存在", status: 404 };
      }
      if (item.status !== "queued") {
        return { error: "仅待放行单据可驳回", status: 409 };
      }
      const trimmed = String(reason || "").trim();
      if (!trimmed) {
        return { error: "驳回必须填写原因", status: 400 };
      }
      item.status = "rejected";
      item.reviewer = REVIEWER;
      item.reviewedAt = timestamp();
      item.rejectReason = trimmed;
      item.log = `已驳回：${trimmed}`;
      await persist(item);
      return { item };
    },
    async move(id, direction) {
      const item = await this.get(id);
      if (!item) {
        return { error: "单据不存在", status: 404 };
      }
      if (item.status !== "queued") {
        return { error: "仅待放行单据可调整顺序", status: 409 };
      }
      const queued = await queuedRows();
      const index = queued.findIndex((row) => row.id === id);
      const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
      if (!delta) {
        return { error: "direction 须为 up 或 down", status: 400 };
      }
      const swapIndex = index + delta;
      if (swapIndex < 0 || swapIndex >= queued.length) {
        return { item, items: decorateQueue(queued) };
      }
      const other = queued[swapIndex];
      const currentPriority = item.priority;
      item.priority = other.priority;
      other.priority = currentPriority;
      await persist(item);
      await persist(other);
      return { item, items: decorateQueue(await queuedRows()) };
    },
    async reorder(ids) {
      const queued = await queuedRows();
      if (!Array.isArray(ids) || !ids.length) {
        return { error: "ids 须为待放行单据的完整顺序列表", status: 400 };
      }
      const wanted = ids.map((id) => String(id));
      if (wanted.length !== queued.length) {
        return { error: "ids 必须覆盖当前全部待放行单据", status: 400 };
      }
      const queuedIds = new Set(queued.map((row) => row.id));
      if (new Set(wanted).size !== wanted.length || wanted.some((id) => !queuedIds.has(id))) {
        return { error: "ids 必须是当前待放行单据的排列", status: 400 };
      }
      for (let index = 0; index < wanted.length; index += 1) {
        const row = queued.find((item) => item.id === wanted[index]);
        row.priority = index + 1;
        await persist(row);
      }
      return { items: decorateQueue(await queuedRows()) };
    },
    async markPublishing(item) {
      item.status = "publishing";
      item.publishStartedAt = lock?.startedAt || timestamp();
      item.log = "已抢到全局发布锁，正在执行 push-xingmai-to-ecs.sh";
      await persist(item);
    },
    async markSuccess(item, message) {
      item.status = "success";
      item.publishFinishedAt = timestamp();
      item.log = message || "发版成功。队列下一条不会自动发布。";
      await persist(item);
    },
    async markFailed(item, message) {
      item.status = "failed";
      item.publishFinishedAt = timestamp();
      item.log = message || "发布失败。";
      await persist(item);
    }
  };
}
