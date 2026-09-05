export const REVIEWER = "运营部主脑";

export const MODULES = [
  "首页",
  "数据中心",
  "沈子晗",
  "韩梦凯",
  "人员管理",
  "版本发布中心",
  "个人中心",
  "其他"
];

const HISTORY_STATUSES = new Set(["success", "failed", "rejected"]);

export function createStore({ now } = {}) {
  const timestamp = () => (now ? now() : new Date().toISOString());
  const items = [];
  let seq = 0;
  let lock = null;

  function nextId() {
    seq += 1;
    return `rel-${seq}`;
  }

  function seedDemo() {
    const t0 = timestamp();
    items.push({
      id: nextId(),
      version: "0.1.0-demo",
      applicant: "首页 Agent",
      module: "首页",
      summary: "演示：工作台导航壳提交审核，未通过不得上线。",
      status: "queued",
      demo: true,
      submittedAt: t0,
      reviewer: null,
      reviewedAt: null,
      rejectReason: null,
      publishStartedAt: null,
      publishFinishedAt: null,
      files: ["public/index.html"],
      acceptance: "演示：打开首页。",
      restart: false,
      log: "演示数据：等待运营部主脑审核。没有主脑口令不会发版。"
    });
    items.push({
      id: nextId(),
      version: "0.0.9-demo",
      applicant: "数据中心 Agent",
      module: "数据中心",
      summary: "演示：历史驳回单，终态不可发布。",
      status: "rejected",
      demo: true,
      submittedAt: t0,
      reviewer: REVIEWER,
      reviewedAt: t0,
      rejectReason: "演示：摘要不完整，驳回。",
      publishStartedAt: null,
      publishFinishedAt: null,
      files: ["public/data.html"],
      acceptance: "演示：不应发布。",
      restart: false,
      log: "演示数据：已驳回，禁止发布。"
    });
  }

  seedDemo();

  return {
    list() {
      return items.slice();
    },
    queue() {
      return items
        .filter((item) => item.status === "queued")
        .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)) || a.id.localeCompare(b.id));
    },
    history() {
      return items
        .filter((item) => HISTORY_STATUSES.has(item.status))
        .sort((a, b) => String(b.reviewedAt || b.submittedAt).localeCompare(String(a.reviewedAt || a.submittedAt)));
    },
    approved() {
      return items.filter((item) => item.status === "approved");
    },
    get(id) {
      return items.find((item) => item.id === id) || null;
    },
    getLock() {
      if (!lock) {
        return { locked: false };
      }
      const current = this.get(lock.id);
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
    tryAcquireLock(item) {
      if (lock) {
        return false;
      }
      lock = { id: item.id, version: item.version, startedAt: timestamp() };
      return true;
    },
    releaseLock() {
      lock = null;
    },
    create({ version, applicant, module, summary, files, acceptance, restart }) {
      const item = {
        id: nextId(),
        version: String(version).trim(),
        applicant: String(applicant).trim(),
        module: String(module).trim(),
        summary: String(summary).trim(),
        files: Array.isArray(files) ? files.slice() : [],
        acceptance: String(acceptance || "").trim(),
        restart: Boolean(restart),
        status: "queued",
        demo: false,
        submittedAt: timestamp(),
        reviewer: null,
        reviewedAt: null,
        rejectReason: null,
        publishStartedAt: null,
        publishFinishedAt: null,
        log: "已记到队列。主脑口令（发版/发板）即可发布，不必先点网页通过。"
      };
      items.push(item);
      return item;
    },
    approve(id) {
      const item = this.get(id);
      if (!item) {
        return { error: "单据不存在", status: 404 };
      }
      if (item.status !== "queued") {
        return { error: "仅待审核单据可通过", status: 409 };
      }
      item.status = "approved";
      item.reviewer = REVIEWER;
      item.reviewedAt = timestamp();
      item.log = "审核通过（记账）。主脑口令即可发版。";
      return { item };
    },
    reject(id, reason) {
      const item = this.get(id);
      if (!item) {
        return { error: "单据不存在", status: 404 };
      }
      if (item.status !== "queued") {
        return { error: "仅待审核单据可驳回", status: 409 };
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
      return { item };
    },
    markPublishing(item) {
      item.status = "publishing";
      item.publishStartedAt = lock?.startedAt || timestamp();
      item.log = "已抢到全局发布锁，正在执行 push-xingmai-to-ecs.sh";
    },
    markSuccess(item, message) {
      item.status = "success";
      item.publishFinishedAt = timestamp();
      item.log = message || "发版成功。队列下一条不会自动发布。";
    },
    markFailed(item, message) {
      item.status = "failed";
      item.publishFinishedAt = timestamp();
      item.log = message || "发布失败。";
    }
  };
}
