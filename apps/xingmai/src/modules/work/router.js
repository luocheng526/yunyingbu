/* 工作汇报接口。 */
import { Router, json } from "express";
import {
  diaryDuty,
  diarySummary,
  getDiary,
  getDiarySettings,
  readDiaryImage,
  saveDiary,
  saveDiaryImage,
  saveDiaryRest,
  saveDiarySettings,
  activateDing,
  saveDingApp,
  saveDingBinds,
  syncDingBinds
} from "./diary.js";
import { getReport, getSettings, isWorkAdmin, myTodoCount, orgPeople, saveMembers, saveReport, saveTemplate, snapshot } from "./store.js";
import { dingUserOf, popupTo, saveNotifyWebhook } from "./dingtalk.js";
import { actTask, listTasks, publishTask, readTaskFile, taskContext, taskCounts } from "./tasks.js";
import { isImage } from "./rich-content.js";
import { centerRouter } from './center.js';
import { startWorkReminders } from './reminders.js';

export const workRouter = Router();
// Module-scoped image payloads bypass the site's 100 KB application/json parser.
workRouter.use(json({ type: 'application/vnd.xm-work+json', limit: '8mb' }));
workRouter.use('/center', centerRouter);
startWorkReminders();

function sendResult(res, result, fallbackStatus = 400) {
  if (!result || result.ok === false) {
    res.status(Number(result?.statusCode) || fallbackStatus).json({
      ok: false,
      error: result?.error || "失败"
    });
    return;
  }
  res.json(result);
}

function wrap(handler) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message || "失败" });
    });
  };
}

workRouter.get(
  "/",
  wrap(async (req, res) => {
    sendResult(res, await snapshot(req.user), 401);
  })
);

workRouter.get(
  "/settings",
  wrap(async (req, res) => {
    sendResult(res, await getSettings(req.user), 403);
  })
);

workRouter.put(
  "/settings/members",
  wrap(async (req, res) => {
    sendResult(res, await saveMembers(req.user, req.body || {}));
  })
);

workRouter.put(
  "/settings/templates",
  wrap(async (req, res) => {
    sendResult(res, await saveTemplate(req.user, req.body || {}));
  })
);

workRouter.get(
  "/report",
  wrap(async (req, res) => {
    sendResult(res, await getReport(req.user, req.query || {}));
  })
);

workRouter.put(
  "/report",
  wrap(async (req, res) => {
    sendResult(res, await saveReport(req.user, req.body || {}));
  })
);

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("截图不能为空，每张最大 3 MB"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, boundary) {
  const text = buffer.toString("latin1");
  const parts = text.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  let file = null;
  for (const part of parts) {
    const splitAt = part.indexOf("\r\n\r\n");
    if (splitAt < 0) {
      continue;
    }
    const head = part.slice(0, splitAt);
    let body = part.slice(splitAt + 4);
    if (body.endsWith("\r\n")) {
      body = body.slice(0, -2);
    }
    const name = /name="([^"]+)"/.exec(head)?.[1] || "";
    const filename = /filename="([^"]*)"/.exec(head)?.[1];
    const mime = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] || "";
    if (filename) {
      file = { name: filename, mime: mime.trim(), data: Buffer.from(body, "latin1").toString("base64") };
    } else if (name) {
      fields[name] = Buffer.from(body, "latin1").toString("utf8");
    }
  }
  return { fields, file };
}

function parseTaskForm(buffer, boundary) {
  const text = buffer.toString("latin1");
  const parts = text.split(`--${boundary}`).slice(1, -1);
  const fields = {};
  const files = [];
  for (const part of parts) {
    const splitAt = part.indexOf("\r\n\r\n");
    if (splitAt < 0) {
      continue;
    }
    const head = Buffer.from(part.slice(0, splitAt), "latin1").toString("utf8");
    let body = part.slice(splitAt + 4);
    if (body.endsWith("\r\n")) {
      body = body.slice(0, -2);
    }
    const name = /name="([^"]+)"/.exec(head)?.[1] || "";
    const filename = /filename="([^"]*)"/.exec(head)?.[1];
    const mime = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] || "";
    if (filename) {
      files.push({ name: filename, mime: mime.trim(), bytes: Buffer.from(body, "latin1") });
    } else if (name) {
      fields[name] = Buffer.from(body, "latin1").toString("utf8");
    }
  }
  return { ...fields, files };
}

async function readTaskBody(req) {
  const type = String(req.headers["content-type"] || "");
  if (!type.includes("multipart/form-data")) {
    return req.body || {};
  }
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type);
  if (!boundary) {
    return { ok: false, statusCode: 400, error: "附件格式不对" };
  }
  return parseTaskForm(await readBody(req, 8 * 1024 * 1024), (boundary[1] || boundary[2] || "").trim());
}

workRouter.get(
  "/diary",
  wrap(async (req, res) => {
    sendResult(res, await getDiary(req.user, req.query || {}, isWorkAdmin(req.user)));
  })
);

workRouter.put(
  "/diary",
  wrap(async (req, res) => {
    sendResult(res, await saveDiary(req.user, req.body || {}, isWorkAdmin(req.user)));
  })
);

workRouter.post(
  "/diary/image",
  wrap(async (req, res) => {
    const type = String(req.headers["content-type"] || "");
    let input = req.body || {};
    if (type.includes("multipart/form-data")) {
      const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type);
      if (!boundary) {
        sendResult(res, { ok: false, statusCode: 400, error: "附件格式不对" });
        return;
      }
      const form = parseMultipart(await readBody(req, 4 * 1024 * 1024), boundary[1] || boundary[2]);
      input = {
        ...form.fields,
        name: form.file?.name,
        mime: form.file?.mime,
        data: form.file?.data
      };
    }
    sendResult(res, await saveDiaryImage(req.user, input));
  })
);

workRouter.get(
  "/diary/image",
  wrap(async (req, res) => {
    sendResult(res, await readDiaryImage(req.user, req.query?.id, isWorkAdmin(req.user)), 404);
  })
);

workRouter.get(
  "/diary/summary",
  wrap(async (req, res) => {
    sendResult(res, await diarySummary(req.user, req.query || {}, isWorkAdmin(req.user)), 403);
  })
);

workRouter.get(
  "/diary/duty",
  wrap(async (req, res) => {
    sendResult(res, await diaryDuty(req.user, req.query || {}, isWorkAdmin(req.user)), 403);
  })
);

workRouter.put(
  "/diary/rest",
  wrap(async (req, res) => {
    sendResult(res, await saveDiaryRest(req.user, req.body || {}, isWorkAdmin(req.user)));
  })
);

workRouter.get(
  "/diary/settings",
  wrap(async (req, res) => {
    sendResult(res, await getDiarySettings(req.user, isWorkAdmin(req.user)), 403);
  })
);

workRouter.put(
  "/diary/settings",
  wrap(async (req, res) => {
    sendResult(res, await saveDiarySettings(req.user, req.body || {}, isWorkAdmin(req.user)), 403);
  })
);

workRouter.put(
  "/diary/ding/app",
  wrap(async (req, res) => {
    sendResult(res, await saveDingApp(req.user, req.body || {}, isWorkAdmin(req.user)), 403);
  })
);

workRouter.post(
  "/diary/ding/activate",
  wrap(async (req, res) => {
    sendResult(res, await activateDing(req.user, isWorkAdmin(req.user)), 403);
  })
);

workRouter.post(
  "/diary/ding/sync",
  wrap(async (req, res) => {
    sendResult(res, await syncDingBinds(req.user, isWorkAdmin(req.user)), 403);
  })
);

workRouter.put(
  "/diary/ding/webhook",
  wrap(async (req, res) => {
    if (!isWorkAdmin(req.user)) {
      sendResult(res, { ok: false, statusCode: 403, error: "只有罗成可以改通知群" });
      return;
    }
    sendResult(res, await saveNotifyWebhook(req.body?.webhook));
  })
);

workRouter.post(
  "/diary/ding/popup",
  wrap(async (req, res) => {
    if (!isWorkAdmin(req.user)) {
      sendResult(res, { ok: false, statusCode: 403, error: "只有罗成可以发弹窗" });
      return;
    }
    const snap = await snapshot(req.user);
    const personId = Number(req.body?.personId) || (snap.me && snap.me.id);
    const person = (await orgPeople()).find((item) => Number(item.id) === personId);
    sendResult(res, await popupTo(dingUserOf(personId), person?.name || ""), 502);
  })
);

workRouter.put(
  "/diary/ding",
  wrap(async (req, res) => {
    sendResult(res, await saveDingBinds(req.user, req.body || {}, isWorkAdmin(req.user)), 403);
  })
);

workRouter.get(
  "/badges",
  wrap(async (req, res) => {
    const todo = await myTodoCount(req.user);
    const counts = await taskCounts(req.user);
    sendResult(res, { ok: true, todo, mine: counts.mine, review: counts.review });
  })
);

workRouter.get(
  "/tasks/context",
  wrap(async (req, res) => {
    sendResult(res, await taskContext(req.user));
  })
);

workRouter.get(
  "/tasks/file",
  wrap(async (req, res) => {
    const inline = req.query?.inline === "1";
    const file = await readTaskFile(req.user, req.query?.id, { binary: inline });
    if (!inline || !file.ok) return sendResult(res, file, 404);

    const extension = file.name?.split(".").at(-1).toLowerCase();
    const imageTypes = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp" };
    const mime = file.mime === "application/octet-stream" ? imageTypes[extension] : file.mime.toLowerCase();
    if (!isImage({ ...file, mime })) {
      return sendResult(res, { ok: false, statusCode: 415, error: "这个附件不支持图片预览" });
    }
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.type(mime).send(file.bytes);
  })
);

workRouter.get(
  "/tasks",
  wrap(async (req, res) => {
    sendResult(res, await listTasks(req.user, req.query?.queue));
  })
);

workRouter.post(
  "/tasks/publish",
  wrap(async (req, res) => {
    const body = await readTaskBody(req);
    if (body?.ok === false) {
      sendResult(res, body);
      return;
    }
    sendResult(res, await publishTask(req.user, body));
  })
);

workRouter.post(
  "/tasks/action",
  wrap(async (req, res) => {
    const body = await readTaskBody(req);
    if (body?.ok === false) {
      sendResult(res, body);
      return;
    }
    sendResult(res, await actTask(req.user, body));
  })
);
