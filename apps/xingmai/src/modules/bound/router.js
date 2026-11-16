import { Router } from "express";
import { isHrDesk } from "../home/nav-items.js";
import { demoBoard, readBoard } from "./store.js";

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
    const board = demoBoard();
    board.warning = "演示模板暂时读不到库，仍展示演示数据，没有改去读 ERP。";
    res.json(board);
  }
});
