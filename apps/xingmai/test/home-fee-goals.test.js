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
    assert.equal(feeBound("1"), 1);
    assert.equal(feeBound("0"), 0);
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
    saveFeeGoal("HYGGIR医疗保健旗舰店", 10, 20, { onlyIfMissing: true });
    assert.equal(readFeeGoals()["HYGGIR医疗保健旗舰店"].lo, null);
    saveFeeGoal("新店", 32, 38, { onlyIfMissing: true });
    assert.equal(readFeeGoals()["新店"].lo, 32);
    saveFeeGoal("新店", 1, 2, { onlyIfMissing: true });
    assert.equal(readFeeGoals()["新店"].lo, 32);
    assert.equal(fs.existsSync(file + "." + process.pid + ".tmp"), false);
    // A damaged file must surface an error rather than erase other shops on save.
    fs.writeFileSync(file, "{broken");
    assert.throws(() => readFeeGoals(), /读取失败/);
    assert.throws(() => saveFeeGoal("新店", 35, 40), /读取失败/);
    assert.equal(fs.readFileSync(file, "utf8"), "{broken");
  } finally {
    setFeeGoalStorePath("");
    fs.rmSync(file, { force: true });
  }
});
