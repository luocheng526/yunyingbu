import { Router } from "express";
import { getOverview } from "./overview.js";

export const dataRouter = Router();

dataRouter.get("/overview", async (_req, res) => {
  res.json(await getOverview());
});
