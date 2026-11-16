import { Router } from "express";
import { createDingClient, readDingEnv } from "./dingtalk.js";
import { startDingStream } from "./stream.js";
import {
  addDays,
  loadRoster,
  runDaily,
  shanghaiToday,
  startScheduler
} from "./sync.js";
import {
  HR_TABS,
  createInterview,
  createTalent,
  deleteInterview,
  deleteTalent,
  latestSync,
  listInterviews,
  listLeaves,
  listLinks,
  listOvertime,
  listPunches,
  listQuotas,
  listTalents
} from "./store.js";

export const hrRouter = Router();

function requireUser(req, res, next) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  next();
}

function actorName(req) {
  return String(req.user?.displayName || req.user?.username || "").trim();
}

function sendErr(res, err) {
  const status = Number(err?.statusCode) || 500;
  res.status(status).json({ ok: false, error: status >= 500 ? "人事数据暂时读不出来" : err.message });
}

hrRouter.use(requireUser);

hrRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "hr", name: "智能人事", tabs: HR_TABS });
});

hrRouter.get("/status", async (_req, res) => {
  try {
    const links = await listLinks();
    res.json({
      ok: true,
      configured: readDingEnv().configured,
      linked: links.length,
      lastSync: await latestSync()
    });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/links", async (_req, res) => {
  try {
    res.json({ ok: true, links: await listLinks() });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/roster", async (_req, res) => {
  try {
    res.json({ ok: true, people: await loadRoster() });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/attendance", async (req, res) => {
  try {
    const punches = await listPunches({ month: req.query.month, date: req.query.date });
    res.json({ ok: true, punches });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/overtime", async (req, res) => {
  try {
    res.json({ ok: true, overtime: await listOvertime({ month: req.query.month }) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/timeoff", async (_req, res) => {
  try {
    res.json({ ok: true, quotas: await listQuotas(), leaves: await listLeaves() });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/sync", async (_req, res) => {
  try {
    if (!readDingEnv().configured) {
      res.json({ ok: true, configured: false });
      return;
    }
    const day = addDays(shanghaiToday(), -1);
    const result = await runDaily(day, createDingClient());
    res.json({ ok: true, configured: true, workDate: day, ...result });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/interviews", async (_req, res) => {
  try {
    const interviews = await listInterviews();
    res.json({ ok: true, interviews });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/interviews", async (req, res) => {
  try {
    const interview = await createInterview(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, interview });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/interviews/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteInterview(req.params.id)) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/talents", async (_req, res) => {
  try {
    res.json({ ok: true, talents: await listTalents() });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/talents", async (req, res) => {
  try {
    const talent = await createTalent(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, talent });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/talents/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteTalent(req.params.id)) });
  } catch (err) {
    sendErr(res, err);
  }
});

export function shouldStartHrJobs(env = process.env, argv = process.argv) {
  if (env.MENGKAI_SMOKE_LIVE) return false;
  if (env.NODE_TEST_CONTEXT) return false;
  if (Array.isArray(argv) && argv.includes("--test")) return false;
  return true;
}

if (shouldStartHrJobs()) {
  const client = createDingClient();
  startScheduler(client);
  startDingStream({ client });
}

export default hrRouter;
