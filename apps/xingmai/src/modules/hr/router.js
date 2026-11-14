import { Router } from "express";
import {
  ATTENDANCE_STATUSES,
  HR_TABS,
  INTERVIEW_RESULTS,
  TALENT_STAGES,
  TIMEOFF_STATUSES,
  createAttendance,
  createInterview,
  createOvertime,
  createTalent,
  createTimeoff,
  deleteAttendance,
  deleteInterview,
  deleteOvertime,
  deleteTalent,
  deleteTimeoff,
  listAttendance,
  listInterviews,
  listOvertime,
  listTalents,
  listTimeoff,
  updateTalentStage,
  updateTimeoffStatus
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
  const error = status >= 500 ? "人事数据暂时写不进去" : err.message;
  res.status(status).json({ ok: false, error });
}

hrRouter.use(requireUser);

hrRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    module: "智能人事",
    tabs: HR_TABS,
    interviewResults: INTERVIEW_RESULTS,
    attendanceStatuses: ATTENDANCE_STATUSES,
    timeoffStatuses: TIMEOFF_STATUSES,
    talentStages: TALENT_STAGES
  });
});

hrRouter.get("/interviews", async (req, res) => {
  try {
    res.json({ ok: true, ...(await listInterviews({ month: req.query.month })) });
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

hrRouter.get("/attendance", async (req, res) => {
  try {
    res.json({ ok: true, ...(await listAttendance({ month: req.query.month })) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/attendance", async (req, res) => {
  try {
    const attendance = await createAttendance(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, attendance });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/attendance/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteAttendance(req.params.id)) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/timeoff", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await listTimeoff()) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/timeoff", async (req, res) => {
  try {
    const timeoff = await createTimeoff(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, timeoff });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.patch("/timeoff/:id", async (req, res) => {
  try {
    const timeoff = await updateTimeoffStatus(req.params.id, req.body?.status);
    res.json({ ok: true, timeoff });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/timeoff/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteTimeoff(req.params.id)) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.get("/talents", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await listTalents()) });
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

hrRouter.patch("/talents/:id", async (req, res) => {
  try {
    const talent = await updateTalentStage(req.params.id, req.body?.stage);
    res.json({ ok: true, talent });
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

hrRouter.get("/overtime", async (req, res) => {
  try {
    res.json({ ok: true, ...(await listOvertime({ month: req.query.month })) });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.post("/overtime", async (req, res) => {
  try {
    const overtime = await createOvertime(req.body || {}, actorName(req));
    res.status(201).json({ ok: true, overtime });
  } catch (err) {
    sendErr(res, err);
  }
});

hrRouter.delete("/overtime/:id", async (req, res) => {
  try {
    res.json({ ok: true, ...(await deleteOvertime(req.params.id)) });
  } catch (err) {
    sendErr(res, err);
  }
});

export default hrRouter;
