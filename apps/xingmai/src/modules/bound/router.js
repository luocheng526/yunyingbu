import { Router } from "express";
import { isHrDesk } from "../home/nav-items.js";
import { buildBoard, normalizeFilters, readBoard } from "./store.js";

export const boundRouter = Router();

function denyHr(req, res) {
  if (!isHrDesk(req.user)) {
    return false;
  }
  res.status(403).json({
    ok: false,
    error: "人事部只看智能人事和个人中心",
    module: "bound",
    source: "crawler",
    erp: false
  });
  return true;
}

boundRouter.get("/", (req, res) => {
  if (denyHr(req, res)) {
    return;
  }
  res.json({ ok: true, module: "bound", source: "crawler", erp: false });
});

boundRouter.get("/board", async (req, res) => {
  if (denyHr(req, res)) {
    return;
  }
  try {
    res.json(await readBoard(req.query || {}));
  } catch (err) {
    console.error("bound board read failed", err && err.message ? err.message : err);
    const board = buildBoard(normalizeFilters(req.query || {}), [], []);
    board.warning = "汇总表暂时读不到，页面保持为空，没有改去读 ERP。";
    res.json(board);
  }
});
