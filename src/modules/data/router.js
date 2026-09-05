import { Router } from "express";
import { getOverview } from "./overview.js";

export const dataRouter = Router();

dataRouter.get("/overview", (_req, res) => {
  res.json(getOverview());
});
