import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { feeBound, readFeeGoals, saveFeeGoal, setFeeGoalStorePath } from "../src/modules/home/fee-goals.js";

test("fee goal edits are stored per shop and can be cleared", () => {
  const file = path.join(os.tmpdir(), `fee-goals-${process.pid}-${Date.now()}.json`);
  setFeeGoalStorePath(file);
  try {
    assert.equal(feeBound("34%"), 34);
    assert.equal(feeBound(""), null);
    assert.equal(Object.keys(readFeeGoals()).length, 0);
    saveFeeGoal("HYGGIR医疗保健旗舰店", 34, 40);
    saveFeeGoal("RASW旗舰店", 50, 35);
    const goals = readFeeGoals();
    assert.equal(goals["HYGGIR医疗保健旗舰店"].lo, 34);
    assert.equal(goals["HYGGIR医疗保健旗舰店"].hi, 40);
    assert.equal(goals["RASW旗舰店"].lo, 35);
    assert.equal(goals["RASW旗舰店"].hi, 50);
    saveFeeGoal("HYGGIR医疗保健旗舰店", null, null);
    const cleared = readFeeGoals()["HYGGIR医疗保健旗舰店"];
    assert.equal(cleared.set, true);
    assert.equal(cleared.lo, null);
    assert.equal(cleared.hi, null);
  } finally {
    setFeeGoalStorePath("");
    fs.rmSync(file, { force: true });
  }
});
