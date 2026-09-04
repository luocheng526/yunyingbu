import express from "express";
import { requireReleasesAuth } from "./auth.js";
import { checkMainBrainOrder, documentGaps, parseReleaseDocument } from "./document.js";
import { pushXingmaiToEcs } from "./push.js";
import { restartMengkaiService } from "./restart.js";
import { createStore, MODULES } from "./store.js";

function publishBlockedReason(item) {
  if (!item) {
    return { status: 404, error: "单据不存在" };
  }
  if (item.status === "queued") {
    return { status: 409, error: "未审核通过，禁止发布" };
  }
  if (item.status === "rejected") {
    return { status: 409, error: "已驳回的单据禁止发布" };
  }
  if (item.status === "publishing") {
    return { status: 409, error: "有发布正在进行，禁止抢发" };
  }
  if (item.status === "success" || item.status === "failed") {
    return { status: 409, error: "该单据已结束，禁止再次发布" };
  }
  if (item.status !== "approved") {
    return { status: 409, error: "当前状态不允许发布" };
  }
  return null;
}

export function createReleasesRouter(options = {}) {
  const store = options.store || createStore({ now: options.now });
  const restart = options.restart || restartMengkaiService;
  const push = options.push || pushXingmaiToEcs;
  const router = express.Router();
  router.use(requireReleasesAuth(options));

  router.get("/", (_req, res) => {
    res.json({ ok: true, items: store.list() });
  });

  router.get("/queue", (_req, res) => {
    res.json({ ok: true, items: store.queue() });
  });

  router.get("/lock", (_req, res) => {
    res.json({ ok: true, ...store.getLock() });
  });

  router.post("/", (req, res) => {
    const body = req.body || {};
    const version = String(body.version || "").trim();
    const applicant = String(body.applicant || "").trim();
    const summary = String(body.summary || "").trim();
    const parsed = parseReleaseDocument(body);
    if (!version || !applicant || !summary) {
      res.status(400).json({
        ok: false,
        error: "版本号、申请人、变更摘要均为必填",
        missing: ["版本号", "申请人", "变更摘要"].filter((label, i) => ![version, applicant, summary][i])
      });
      return;
    }
    if (parsed.missing.length) {
      res.status(400).json({
        ok: false,
        error: `发布文档缺项：${parsed.missing.join("、")}。只入队需要完整文档；没有口令也不会发版。`,
        missing: parsed.missing
      });
      return;
    }
    if (!MODULES.includes(parsed.document.module)) {
      res.status(400).json({ ok: false, error: "模块不在允许列表中" });
      return;
    }
    const item = store.create({
      version,
      applicant,
      summary,
      module: parsed.document.module,
      files: parsed.document.files,
      acceptance: parsed.document.acceptance,
      restart: parsed.document.restart
    });
    res.status(201).json({ ok: true, item });
  });

  router.post("/:id/approve", (req, res) => {
    const result = store.approve(req.params.id);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item });
  });

  router.post("/:id/reject", (req, res) => {
    const result = store.reject(req.params.id, req.body?.reason);
    if (result.error) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, item: result.item });
  });

  router.post("/:id/publish", async (req, res) => {
    const item = store.get(req.params.id);
    const blocked = publishBlockedReason(item);
    if (blocked) {
      res.status(blocked.status).json({ ok: false, error: blocked.error });
      return;
    }

    const gaps = documentGaps(item);
    if (gaps.length) {
      res.status(409).json({
        ok: false,
        error: `缺少发布文档：${gaps.join("、")}。不要发。`,
        missing: gaps
      });
      return;
    }

    const order = checkMainBrainOrder(req.body?.order ?? req.body?.口令, item.module);
    if (!order.ok) {
      res.status(409).json({ ok: false, error: order.error });
      return;
    }

    const acquired = store.tryAcquireLock(item);
    if (!acquired) {
      res.status(409).json({ ok: false, error: "有发布正在进行，禁止抢发" });
      return;
    }

    store.markPublishing(item);

    const runJob = async () => {
      try {
        const pushResult = await push(item.files);
        let extra = "";
        if (item.restart) {
          const result = await restart();
          extra = result && result.skipped ? `未执行 systemctl：${result.reason}` : "已 systemctl restart mengkai.service";
        } else {
          extra = "文档要求不重启，已跳过 systemctl。";
        }
        const pushNote = pushResult && pushResult.stdout ? String(pushResult.stdout).trim() : "push-xingmai-to-ecs.sh 完成";
        store.markSuccess(
          item,
          `版本 ${item.version} 发版成功。${pushNote} ${extra} 队列下一条不会自动发布。`
        );
        return { ok: true };
      } catch (err) {
        const message = `发版失败：${err?.message || err}。已释放发布锁。`;
        store.markFailed(item, message);
        return { ok: false, error: message };
      } finally {
        store.releaseLock();
      }
    };

    const defer = item.restart && restart === restartMengkaiService;
    if (defer) {
      res.json({ ok: true, item, version: item.version });
      setTimeout(() => {
        runJob().catch((err) => {
          console.error("release job failed", err);
        });
      }, 400);
      return;
    }

    const result = await runJob();
    if (result.ok) {
      res.json({ ok: true, item, version: item.version });
      return;
    }
    res.status(500).json({ ok: false, error: result.error, item, version: item.version });
  });

  return router;
}

export const releasesRouter = createReleasesRouter();
