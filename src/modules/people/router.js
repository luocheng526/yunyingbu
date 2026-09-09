import { Router } from "express";
import { CENTERS, createPerson, listPeople } from "./store.js";

export const peopleRouter = Router();

export const PEOPLE_CHARTER = {
  agentAccess: "read-only",
  sourceOfTruth: {
    employment: "花名册",
    shopRights: "管辖"
  },
  rule: "智能体是只读调用方。在职与店权只认花名册和管辖。"
};

peopleRouter.get("/charter", (_req, res) => {
  res.json({ ok: true, ...PEOPLE_CHARTER });
});

peopleRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    demo: true,
    charter: PEOPLE_CHARTER,
    centers: CENTERS,
    people: listPeople()
  });
});

peopleRouter.post("/", (req, res) => {
  const result = createPerson(req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json({ ok: true, person: result.person });
});
