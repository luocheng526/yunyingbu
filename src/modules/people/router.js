import { Router } from "express";
import { CENTERS, createPerson, listPeople } from "./store.js";

export const peopleRouter = Router();

peopleRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    demo: true,
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
