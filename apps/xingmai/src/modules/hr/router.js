import { Router } from "express";
import { createDingClient, dingCallsEnabled, readDingEnv } from "./dingtalk.js";
import { startDingStream } from "./stream.js";
import {
  archiveYesterday,
  canSeeHr,
  refreshLeaves,
  archiveEffortMonth,
  loadRoster,
  readStoredBoard,
  readStoredEffort,
  refreshBoardDay,
  shanghaiToday,
  startScheduler
} from "./sync.js";
import {
  HR_TABS,
  createInterview,
  createOnboard,
  createRecruit,
  createStaff,
  createTalent,
  deleteInterview,
  deleteOnboard,
  deleteLink,
  deleteRecruit,
  deleteStaff,
  deleteTalent,
  latestSync,
  listDingUsers,
  readApiUsage,
  listInterviews,
  listLinks,
  importStaff,
  listOnboards,
  listRecruits,
  listStaff,
  readHrHome,
  listLeaves,
  listOvertime,
  listPunches,
  listQuotas,
  listTalents,
  registerRecruitJoin,
  syncStaffFromPunches,
  updateStaff,
  upsertLink
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
  const detail = String(err?.code || err?.sqlMessage || err?.message || "").replace(/\s+/g, " ").slice(0, 180);
  const safe = /password|secret|token/i.test(detail) ? "" : detail;
  res.status(status).json({
    ok: false,
    error: status >= 500 ? "人事数据暂时读不出来" : err.message,
    detail: status >= 500 ? safe : undefined
  });
}

hrRouter.use(requireUser);

const accessCache = new Map();

async function viewerAllowed(req) {
  if (canSeeHr(req.user)) return true;
  const key = [req.user?.username, req.user?.displayName, req.user?.name, req.user?.department]
    .map((value) => String(value || ""))
    .join("|");
  const hit = accessCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.allowed;
  const [people, users] = await Promise.all([
    loadRoster().catch(() => []),
    listDingUsers().catch(() => [])
  ]);
  const allowed = canSeeHr(req.user, people, users);
  accessCache.set(key, { at: Date.now(), allowed });
  return allowed;
}

hrRouter.get("/access", async (req, res) => {
  try {
    res.json({ ok: true, allowed: await viewerAllowed(req) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.use(async (req, res, next) => {
  try {
    if (await viewerAllowed(req)) {
      next();
      return;
    }
    res.status(403).json({ ok: false, error: "没有智能人事权限" });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/", (_req, res) => {
  res.json({ ok: true, module: "hr", name: "智能人事", tabs: HR_TABS });
});

hrRouter.get("/status", async (_req, res) => {
  try {
    const links = await listLinks();
    const usage = await readApiUsage();
    const paused = !dingCallsEnabled();
    usage.paused = paused;
    res.json({
      ok: true,
      configured: readDingEnv().configured,
      paused,
      linked: links.length,
      lastSync: await latestSync(),
      usage
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

hrRouter.get("/home", async (req, res) => {
  try {
    const range = String(req.query.range || "30");
    res.json({ ok: true, ...(await readHrHome({ range, viewer: actorName(req) })) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/board", async (req, res) => {
  try {
    const today = shanghaiToday();
    const raw = String(req.query.date || today);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    const stored = await readStoredBoard(date);
    res.json({
      ok: true,
      configured: readDingEnv().configured,
      saved: stored.saved,
      updatedAt: stored.updatedAt,
      boards: stored.boards,
      board: stored.board,
      days: stored.days,
      punches: stored.punches
    });
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

hrRouter.get("/effort", async (req, res) => {
  try {
    const month = String(req.query.month || shanghaiToday().slice(0, 7));
    res.json({ ok: true, ...(await readStoredEffort(month)) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/links", async (req, res) => {
  try {
    const link = await upsertLink(req.body || {});
    await archiveEffortMonth(shanghaiToday().slice(0, 7)).catch(() => {});
    res.status(201).json({ ok: true, link });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/links/:personId", async (req, res) => {
  try {
    const removed = await deleteLink(req.params.personId);
    await archiveEffortMonth(shanghaiToday().slice(0, 7)).catch(() => {});
    res.json({ ok: true, ...removed });
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

hrRouter.post("/sync", async (req, res) => {
  try {
    if (readDingEnv().configured && !dingCallsEnabled()) {
      const usage = await readApiUsage();
      usage.paused = true;
      res.json({ ok: true, configured: true, paused: true, usage });
      return;
    }
    const rawDate = String((req.body && req.body.date) || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const refreshed = await refreshBoardDay(rawDate, createDingClient());
      res.json({ ok: true, ...refreshed });
      return;
    }
    if (!readDingEnv().configured) {
      res.json({ ok: true, configured: false });
      return;
    }
    const client = createDingClient();
    const result = await archiveYesterday(client);
    const leaves = await refreshLeaves(client);
    res.json({ ok: true, ...result, leaveCount: (leaves.leaves || []).length });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/recruits", async (req, res) => {
  try {
    res.json({ ok: true, recruits: await listRecruits({ date: req.query.date, month: req.query.month }) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/recruits", async (req, res) => {
  try {
    const recruit = await createRecruit(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, recruit });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/onboards", async (_req, res) => {
  try {
    res.json({ ok: true, onboards: await listOnboards() });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/onboards", async (req, res) => {
  try {
    const onboard = await createOnboard(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, onboard });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/onboards/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteOnboard(req.params.id)) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/staff", async (req, res) => {
  try {
    res.json({ ok: true, staff: await listStaff({ status: req.query.status }) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/staff/import", async (req, res) => {
  try {
    res.json({ ok: true, ...(await importStaff((req.body || {}).rows, actorName(req))) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/staff/sync", async (req, res) => {
  try {
    res.json({ ok: true, ...(await syncStaffFromPunches(actorName(req))) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/staff", async (req, res) => {
  try {
    const person = await createStaff(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, staff: person });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.put("/staff/:id", async (req, res) => {
  try {
    const body = req.body || {};
    const person = await updateStaff(req.params.id, body, actorName(req), { replace: body.replace === true });
    res.json({ ok: true, staff: person });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/staff/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteStaff(req.params.id)) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/recruits/:id/join", async (req, res) => {
  try {
    res.json({ ok: true, ...(await registerRecruitJoin(req.params.id, actorName(req))) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/recruits/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteRecruit(req.params.id)) });
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

export function shouldStartHrJobs() {
  if (process.env.NODE_TEST_CONTEXT) return false;
  if (process.argv.includes("--test")) return false;
  if (process.env.MENGKAI_SMOKE_LIVE) return false;
  return true;
}

if (shouldStartHrJobs()) {
  const client = createDingClient();
  startScheduler(client);
  startDingStream({ client });
}

export default hrRouter;
