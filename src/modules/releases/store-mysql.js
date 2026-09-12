import { getPool } from "../../db/pool.js";
import { QUEUE_LOG, requeueFailedItem, returnFailedItem } from "./charter.js";
import { hasApplyReceipt } from "./push.js";
import { assignSubmitOrder } from "./order.js";
import { REVIEWER } from "./store-memory.js";
import { BOARD_PAGE_SIZE, slimFailedItem } from "./board.js";

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
    snapshotDir: row.snapshot_dir || "",
    rolledBack: Boolean(row.rolled_back),
    gitRef: row.git_ref || "",
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
      "SELECT * FROM release_tickets WHERE status = 'queued' ORDER BY submitted_at ASC, id ASC"
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
    async boardSummary() {
      const [rows] = await db().query(`
        SELECT
          COALESCE(SUM(status = 'queued'), 0) AS queued,
          COALESCE(SUM(status = 'approved'), 0) AS approved,
          COALESCE(SUM(status = 'publishing'), 0) AS publishing,
          COALESCE(SUM(status = 'failed'), 0) AS failed,
          COALESCE(SUM(status = 'success'), 0) AS success,
          COALESCE(SUM(CASE WHEN log IS NOT NULL AND log <> '' THEN 1 ELSE 0 END), 0) AS logs
        FROM release_tickets
      `);
      const row = rows[0] || {};
      return {
        queued: Number(row.queued) || 0,
        approved: Number(row.approved) || 0,
        publishing: Number(row.publishing) || 0,
        failed: Number(row.failed) || 0,
        success: Number(row.success) || 0,
        rolledBack: 0,
        logs: Number(row.logs) || 0
      };
    },
    async historyPage(page, limit) {
      const size = Math.min(50, Math.max(1, Number(limit) || BOARD_PAGE_SIZE));
      const [[countRow]] = await db().query("SELECT COUNT(*) AS n FROM release_tickets WHERE status = 'success'");
      const total = Number(countRow?.n) || 0;
      const pageCount = Math.max(1, Math.ceil(total / size) || 1);
      const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
      const offset = (current - 1) * size;
      const [rows] = await db().query(
        `SELECT id, version, module, summary, status, demo, submitted_at, reviewed_at, publish_finished_at
         FROM release_tickets
         WHERE status = 'success'
         ORDER BY COALESCE(publish_finished_at, reviewed_at, submitted_at) DESC, id DESC
         LIMIT ? OFFSET ?`,
        [size, offset]
      );
      return {
        items: rows.map((row) => ({
          id: row.id,
          version: row.version,
          module: row.module,
          summary: row.summary || "",
          status: row.status,
          demo: Boolean(row.demo),
          publishFinishedAt: toIso(row.publish_finished_at),
          reviewedAt: toIso(row.reviewed_at),
          submittedAt: toIso(row.submitted_at),
          snapshotDir: "",
          rolledBack: false
        })),
        page: current,
        pageCount,
        total,
        limit: size
      };
    },
    async logsPage(page, limit) {
      const size = Math.min(50, Math.max(1, Number(limit) || BOARD_PAGE_SIZE));
      const [[countRow]] = await db().query(
        "SELECT COUNT(*) AS n FROM release_tickets WHERE log IS NOT NULL AND log <> ''"
      );
      const total = Number(countRow?.n) || 0;
      const pageCount = Math.max(1, Math.ceil(total / size) || 1);
      const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
      const offset = (current - 1) * size;
      const [rows] = await db().query(
        `SELECT id, version, module, status, log, submitted_at, reviewed_at, publish_finished_at
         FROM release_tickets
         WHERE log IS NOT NULL AND log <> ''
         ORDER BY COALESCE(publish_finished_at, reviewed_at, submitted_at) DESC, id DESC
         LIMIT ? OFFSET ?`,
        [size, offset]
      );
      return {
        items: rows.map((row) => ({
          id: row.id,
          version: row.version,
          module: row.module,
          status: row.status,
          log: row.log || "",
          publishFinishedAt: toIso(row.publish_finished_at),
          reviewedAt: toIso(row.reviewed_at),
          submittedAt: toIso(row.submitted_at)
        })),
        page: current,
        pageCount,
        total,
        limit: size
      };
    },
    async failedPage(page, limit) {
      const size = Math.min(50, Math.max(1, Number(limit) || BOARD_PAGE_SIZE));
      const [[countRow]] = await db().query("SELECT COUNT(*) AS n FROM release_tickets WHERE status = 'failed'");
      const total = Number(countRow?.n) || 0;
      const pageCount = Math.max(1, Math.ceil(total / size) || 1);
      const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
      const offset = (current - 1) * size;
      const [rows] = await db().query(
        `SELECT id, version, module, source, applicant, summary, files, status, log,
                submitted_at, reviewed_at, publish_finished_at
         FROM release_tickets
         WHERE status = 'failed'
         ORDER BY COALESCE(publish_finished_at, reviewed_at, submitted_at) DESC, id DESC
         LIMIT ? OFFSET ?`,
        [size, offset]
      );
      return {
        items: rows.map((row) =>
          slimFailedItem({
            id: row.id,
            version: row.version,
            module: row.module,
            source: row.source || "",
            applicant: row.applicant || "",
            summary: row.summary || "",
            files: parseFiles(row.files),
            status: row.status,
            log: row.log || "",
            publishFinishedAt: toIso(row.publish_finished_at),
            reviewedAt: toIso(row.reviewed_at),
            submittedAt: toIso(row.submitted_at)
          })
        ),
        page: current,
        pageCount,
        total,
        limit: size
      };
    },
    async versionRows() {
      const [rows] = await db().query(
        "SELECT id, version, status, module, publish_finished_at FROM release_tickets"
      );
      return rows.map((row) => ({
        id: row.id,
        version: row.version,
        status: row.status,
        module: row.module,
        publishFinishedAt: toIso(row.publish_finished_at),
        snapshotDir: "",
        rolledBack: false
      }));
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
    async create({ version, applicant, source, module, summary, files, acceptance, restart, gitRef, repository }) {
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
        snapshotDir: "",
        rolledBack: false,
        gitRef: String(gitRef || "").trim(),
        repository: String(repository || "").trim(),
        log: QUEUE_LOG
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
      const queued = assignSubmitOrder(await queuedRows());
      for (const row of queued) {
        await persist(row);
      }
      const ranked = queued.find((row) => row.id === item.id);
      if (ranked) {
        item.priority = ranked.priority;
      }
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
    async move() {
      return { error: "排队只按提交时间，禁止上移下移", status: 409 };
    },
    async reorder() {
      return { error: "排队只按提交时间，禁止上移下移", status: 409 };
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
    },
    async requeueFailed(id) {
      const item = await this.get(id);
      const result = requeueFailedItem(item, hasApplyReceipt(item?.snapshotDir));
      if (result.error) {
        return result;
      }
      await persist(result.item);
      const queued = assignSubmitOrder(await queuedRows());
      for (const row of queued) {
        await persist(row);
      }
      return { item: result.item };
    },
    async returnFailed(id) {
      const item = await this.get(id);
      const result = returnFailedItem(item);
      if (result.error) {
        return result;
      }
      if (!result.already) {
        await persist(result.item);
      }
      return {
        item: slimFailedItem(result.item),
        already: Boolean(result.already),
        dialog: result.dialog
      };
    }
  };
}
