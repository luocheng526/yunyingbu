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

function sortQueued(a, b) {
  const pa = Number(a.priority) || 0;
  const pb = Number(b.priority) || 0;
  if (pa !== pb) {
    return pa - pb;
  }
  const ta = String(a.submittedAt || "");
  const tb = String(b.submittedAt || "");
  if (ta !== tb) {
    return ta.localeCompare(tb);
  }
  return String(a.id).localeCompare(String(b.id));
}

export function createStore({ now } = {}) {
  const timestamp = () => (now ? now() : new Date().toISOString());
  const items = [];
  let seq = 0;
  let lock = null;

  function nextId() {
    seq += 1;
    return `rel-${seq}`;
  }

  function queuedItems() {
    return items.filter((item) => item.status === "queued").sort(sortQueued);
  }

  function nextPriority() {
    const queued = queuedItems();
    if (!queued.length) {
      return 1;
    }
    return Math.max(...queued.map((item) => Number(item.priority) || 0)) + 1;
  }

  function decorateQueue(list) {
    return list.map((item, index) => {
      item.queueIndex = index + 1;
      return item;
    });
  }

  function seedDemo() {
    const t0 = timestamp();
    items.push({
      id: nextId(),
      version: "0.1.0-demo",
      applicant: "首页 Agent",
      source: "首页导航与工作台",
      module: "首页",
      summary: "演示：工作台左导航壳。等待主脑在看板点确定才上线。",
      status: "queued",
      demo: true,
      priority: 1,
      submittedAt: t0,
      reviewer: null,
      reviewedAt: null,
      rejectReason: null,
      publishStartedAt: null,
      publishFinishedAt: null,
      files: ["public/index.html", "public/shared/layout.css", "public/shared/nav.js"],
      acceptance: "演示：打开首页，确认左栏七个入口。",
      restart: false,
      log: "演示数据：对话交来的发版单，排队等待确定。"
    });
    items.push({
      id: nextId(),
      version: "0.2.0-demo",
      applicant: "数据中心 Agent",
      source: "数据中心看板",
      module: "数据中心",
      summary: "演示：第二位排队。可用上移/下移改优先级。",
      status: "queued",
      demo: true,
      priority: 2,
      submittedAt: t0,
      reviewer: null,
      reviewedAt: null,
      rejectReason: null,
      publishStartedAt: null,
      publishFinishedAt: null,
      files: ["public/data.html", "src/modules/data/router.js"],
      acceptance: "演示：打开 /data，看到 KPI 卡。",
      restart: false,
      log: "演示数据：对话交来的发版单，排队等待确定。"
    });
    items.push({
      id: nextId(),
      version: "0.0.9-demo",
      applicant: "数据中心 Agent",
      source: "数据中心看板",
      module: "数据中心",
      summary: "演示：历史驳回单，终态不可发布。",
      status: "rejected",
      demo: true,
      priority: 0,
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
      return decorateQueue(queuedItems());
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
    create({ version, applicant, source, module, summary, files, acceptance, restart }) {
      const who = String(applicant || "").trim();
      const item = {
        id: nextId(),
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
        priority: nextPriority(),
        submittedAt: timestamp(),
        reviewer: null,
        reviewedAt: null,
        rejectReason: null,
        publishStartedAt: null,
        publishFinishedAt: null,
        log: "已进入发版看板排队。主脑在网页点确定才放行；下一条不会自动发。"
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
        return { error: "仅待放行单据可通过", status: 409 };
      }
      item.status = "approved";
      item.reviewer = REVIEWER;
      item.reviewedAt = timestamp();
      item.log = "已标记通过。请用确定放行上线。";
      return { item };
    },
    reject(id, reason) {
      const item = this.get(id);
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
      return { item };
    },
    move(id, direction) {
      const item = this.get(id);
      if (!item) {
        return { error: "单据不存在", status: 404 };
      }
      if (item.status !== "queued") {
        return { error: "仅待放行单据可调整顺序", status: 409 };
      }
      const queued = queuedItems();
      const index = queued.findIndex((row) => row.id === id);
      const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
      if (!delta) {
        return { error: "direction 须为 up 或 down", status: 400 };
      }
      const swapIndex = index + delta;
      if (swapIndex < 0 || swapIndex >= queued.length) {
        decorateQueue(queued);
        return { item, items: queued };
      }
      const other = queued[swapIndex];
      const currentPriority = item.priority;
      item.priority = other.priority;
      other.priority = currentPriority;
      return { item, items: decorateQueue(queuedItems()) };
    },
    reorder(ids) {
      const queued = queuedItems();
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
      wanted.forEach((id, index) => {
        this.get(id).priority = index + 1;
      });
      return { items: decorateQueue(queuedItems()) };
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
