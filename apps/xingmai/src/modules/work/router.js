/* 工作汇报接口。 */
import { Router } from "express";
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
  startDiaryReminder,
  syncDingBinds
} from "./diary.js";
import { getReport, getSettings, isWorkAdmin, saveMembers, saveReport, saveTemplate, snapshot } from "./store.js";

export const workRouter = Router();
startDiaryReminder();

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
      res.status(500).json({ ok: false, error: err.message || "失败" });
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
  "/diary/ding",
  wrap(async (req, res) => {
    sendResult(res, await saveDingBinds(req.user, req.body || {}, isWorkAdmin(req.user)), 403);
  })
);
