import { Router } from "express";
import { createDingClient, readDingEnv } from "./dingtalk.js";
import { startDingStream } from "./stream.js";
import {
  addDays,
  boardPack,
  canSeeHr,
  effortReport,
  loadRoster,
  runDaily,
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
  listInterviews,
  listLinks,
  importStaff,
  listOnboards,
  listRecruits,
  listStaff,
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
  res.status(status).json({ ok: false, error: status >= 500 ? "人事数据暂时读不出来" : err.message });
}

hrRouter.use(requireUser);

async function viewerAllowed(req) {
  const [people, users] = await Promise.all([
    loadRoster().catch(() => []),
    listDingUsers().catch(() => [])
  ]);
  return canSeeHr(req.user, people, users);
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

hrRouter.get("/board", async (req, res) => {
  try {
    const today = shanghaiToday();
    const raw = String(req.query.date || today);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    const users = await listDingUsers();
    const links = await listLinks();
    const userByPerson = new Map(links.map((link) => [link.personId, link.dingtalkUserId]));
    const leaves = (await listLeaves()).map((row) => ({
      ...row,
      dingtalkUserId: row.dingtalkUserId || userByPerson.get(row.personId) || ""
    }));
    const dates = [];
    const punches = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = addDays(date, -offset);
      dates.push(day);
      punches.push(...await listPunches({ date: day }));
    }
    const boards = boardPack({ date, users, punches, leaves, dates });
    const first = boards[0];
    res.json({
      ok: true,
      configured: readDingEnv().configured,
      boards,
      board: first.board,
      days: first.days,
      punches: first.punches
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
    const users = await listDingUsers();
    const byId = new Map(users.map((user) => [user.userId, user]));
    const punches = (await listPunches({ month })).map((row) => {
      const user = byId.get(row.dingtalkUserId) || {};
      return {
        ...row,
        userName: row.userName || user.userName || "",
        department: row.department || user.department || ""
      };
    });
    const report = effortReport({
      month: /^\d{4}-\d{2}$/.test(month) ? month : "",
      users,
      punches,
      people: await loadRoster(),
      links: await listLinks()
    });
    res.json({ ok: true, ...report });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/links", async (req, res) => {
  try {
    const link = await upsertLink(req.body || {});
    res.status(201).json({ ok: true, link });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/links/:personId", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteLink(req.params.personId)) });
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
