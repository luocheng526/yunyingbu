import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FRAMEWORK_DIRS, ensureFrameworkDirs, ensureFrameworkTrees, resolveAppRoot } from "../src/boot-dirs.js";

test("ensureFrameworkDirs creates missing folders including src/db", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xm-dirs-"));
  try {
    const result = ensureFrameworkDirs(root);
    assert.equal(result.root, path.resolve(root));
    assert.ok(result.created.includes("src/db"));
    assert.ok(result.created.includes("src/lib"));
    assert.equal(result.skipped.length, 0);
    for (const rel of FRAMEWORK_DIRS) {
      assert.ok(fs.statSync(path.join(root, rel)).isDirectory(), rel);
    }
    const again = ensureFrameworkDirs(root);
    assert.deepEqual(again.created, []);
    assert.deepEqual(again.skipped, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ensureFrameworkDirs records EACCES instead of crashing", () => {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xm-dirs-ro-"));
  try {
    const blocked = path.join(root, "src");
    fs.mkdirSync(blocked);
    fs.chmodSync(blocked, 0o555);
    const result = ensureFrameworkDirs(root, ["src/db"]);
    assert.equal(result.created.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].rel, "src/db");
    assert.match(String(result.skipped[0].error), /EACCES|permission|denied/i);
  } finally {
    fs.chmodSync(path.join(root, "src"), 0o755);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ensureFrameworkTrees also fills MENGKAI_SOURCE_DIR", () => {
  const live = fs.mkdtempSync(path.join(os.tmpdir(), "xm-live-"));
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "xm-source-"));
  try {
    const trees = ensureFrameworkTrees(
      { MENGKAI_LIVE_ROOT: live, MENGKAI_SOURCE_DIR: source },
      live
    );
    assert.equal(trees.length, 2);
    assert.ok(fs.existsSync(path.join(live, "src/db")));
    assert.ok(fs.existsSync(path.join(source, "src/db")));
  } finally {
    fs.rmSync(live, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test("resolveAppRoot prefers MENGKAI_LIVE_ROOT", () => {
  const dest = "/tmp/xm-live-root-test";
  assert.equal(resolveAppRoot({ MENGKAI_LIVE_ROOT: dest }, "/tmp/other"), path.resolve(dest));
});
