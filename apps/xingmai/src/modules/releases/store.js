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

  function nextPriority() {
    const queued = items.filter((item) => item.status === "queued");
    if (!queued.length) {
      return 1;
    }
    return Math.max(...queued.map((item) => Number(item.priority) || 0)) + 1;
  }

  function seedDemo() {
    const t0 = timestamp();
    items.push({
      id: nextId(),
      version: "0.1.0-demo",
      applicant: "首页导航与工作台",
      source: "首页导航与工作台",
      module: "首页",
      summary: "左侧导航 + 右侧工作台壳，供各模块共用。",
      status: "queued",
      demo: true,
      priority: 1,
      submittedAt: t0,
      reviewer: null,
      reviewedAt: null,
      rejectReason: null,
      publishStartedAt: null,
      publishFinishedAt: null,
      files: ["public/index.html", "public/shared/nav.js", "public/shared/layout.css"],
      acceptance: "登录后打开首页，能看到左侧七个入口。",
      restart: false,
      log: "来自对话提交，等待主脑在网页点确定放行。"
    });
    items.push({
      id: nextId(),
      version: "0.1.1-demo",
      applicant: "数据中心看板",
      source: "数据中心看板",
      module: "数据中心",
      summary: "数据中心看板 KPI 与趋势图（演示数据）。",
      status: "queued",
      demo: true,
      priority: 2,
      submittedAt: t0,
      reviewer: null,
      reviewedAt: null,
      rejectReason: null,
      publishStartedAt: null,
      publishFinishedAt: null,
      files: ["public/data.html", "src/modules/data/overview.js"],
      acceptance: "打开 /data 能看到概览数字。",
      restart: false,
      log: "来自对话提交，等待主脑在网页点确定放行。"
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
        .sort((a, b) => {
          const pa = Number(a.priority) || 0;
          const pb = Number(b.priority) || 0;
          if (pa !== pb) {
            return pa - pb;
          }
          return String(a.submittedAt).localeCompare(String(b.submittedAt)) || a.id.localeCompare(b.id);
        });
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
    create({ version, applicant, module, summary, files, acceptance, restart, source }) {
      const who = String(applicant || "").trim();
      const item = {
        id: nextId(),
        version: String(version).trim(),
        applicant: who,
        source: String(source || who).trim() || "未知对话",
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
        log: "已进入发版队列，等主脑在版本发布中心点确定放行。"
      };
      items.push(item);
      return item;
    },
    reorder(ids) {
      const wanted = Array.isArray(ids) ? ids.map((id) => String(id)) : [];
      const queued = this.queue();
      const known = new Set(queued.map((item) => item.id));
      const ordered = [];
      for (const id of wanted) {
        if (known.has(id) && !ordered.includes(id)) {
          ordered.push(id);
        }
      }
      for (const item of queued) {
        if (!ordered.includes(item.id)) {
          ordered.push(item.id);
        }
      }
      ordered.forEach((id, index) => {
        const item = this.get(id);
        if (item) {
          item.priority = index + 1;
        }
      });
      return this.queue();
    },
    move(id, direction) {
      const queued = this.queue();
      const index = queued.findIndex((item) => item.id === id);
      if (index === -1) {
        return { error: "单据不在待放行队列中", status: 409 };
      }
      const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
      const swapIndex = index + delta;
      if (!delta || swapIndex < 0 || swapIndex >= queued.length) {
        return { item: queued[index], items: queued };
      }
      const ids = queued.map((item) => item.id);
      const tmp = ids[index];
      ids[index] = ids[swapIndex];
      ids[swapIndex] = tmp;
      return { item: this.get(id), items: this.reorder(ids) };
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
      item.log = "主脑已点确定，进入放行。";
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
