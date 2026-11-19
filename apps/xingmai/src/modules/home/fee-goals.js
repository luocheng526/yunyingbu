import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let storePath = "";

export function setFeeGoalStorePath(filePath) {
  storePath = String(filePath || "");
}

function defaultStorePath() {
  const env = String(process.env.HOME_FEE_GOAL_STORE || "").trim();
  if (env) {
    return env;
  }
  const root = String(process.env.MENGKAI_LIVE_ROOT || "").trim();
  if (root) {
    return path.join(root, "data", "home-fee-goals.json");
  }
  if (fs.existsSync("/opt/mengkai/src")) {
    return "/opt/mengkai/data/home-fee-goals.json";
  }
  return path.join(os.tmpdir(), "xingmai-home-fee-goals.json");
}

function resolveStorePath() {
  return storePath || defaultStorePath();
}

export function feeBound(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(String(value).replace(/%/g, "").trim());
  if (!Number.isFinite(n)) {
    return null;
  }
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, pct));
}

function cleanGoal(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  let lo = feeBound(raw.lo);
  let hi = feeBound(raw.hi);
  if (lo != null && hi != null && lo > hi) {
    const swap = lo;
    lo = hi;
    hi = swap;
  }
  return { set: true, lo, hi };
}

export function readFeeGoals() {
  const goals = Object.create(null);
  try {
    const raw = JSON.parse(fs.readFileSync(resolveStorePath(), "utf8"));
    const book = raw && raw.goals && typeof raw.goals === "object" ? raw.goals : {};
    Object.keys(book).forEach((name) => {
      const shop = String(name || "").trim();
      if (!shop || shop === "__proto__" || shop === "constructor" || shop === "prototype") {
        return;
      }
      const goal = cleanGoal(book[name]);
      if (goal) {
        goals[shop] = goal;
      }
    });
  } catch {
    return goals;
  }
  return goals;
}

export function saveFeeGoal(shop, lo, hi) {
  const name = String(shop || "").trim();
  if (!name || name === "__proto__" || name === "constructor" || name === "prototype") {
    const error = new Error("缺少店铺");
    error.statusCode = 400;
    throw error;
  }
  const goals = readFeeGoals();
  goals[name] = cleanGoal({ lo, hi });
  const file = resolveStorePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const plain = {};
  Object.keys(goals).forEach((key) => {
    plain[key] = goals[key];
  });
  fs.writeFileSync(file, JSON.stringify({ goals: plain }, null, 2));
  return readFeeGoals();
}
