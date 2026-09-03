import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { TaskStore, ValidationError } from "./store";

function freshStore(): TaskStore {
  const dir = mkdtempSync(join(tmpdir(), "yunyingbu-"));
  return new TaskStore(join(dir, "tasks.json"));
}

test("seeds with starter tasks", () => {
  const store = freshStore();
  assert.equal(store.list().length, 4);
});

test("creates a task and persists it", () => {
  const store = freshStore();
  const created = store.create({ title: "Draft newsletter", owner: "Sam", priority: "high" });
  assert.equal(created.title, "Draft newsletter");
  assert.equal(created.owner, "Sam");
  assert.equal(created.priority, "high");
  assert.equal(created.status, "todo");
  assert.ok(store.get(created.id));
});

test("rejects an invalid task", () => {
  const store = freshStore();
  assert.throws(() => store.create({ title: "", owner: "" }), ValidationError);
});

test("updates status and recomputes metrics", () => {
  const store = freshStore();
  const created = store.create({ title: "Ship dashboard", owner: "Lee" });
  store.update(created.id, { status: "done" });
  const metrics = store.metrics();
  assert.ok(metrics.byStatus.done >= 1);
  assert.equal(metrics.total, store.list().length);
});

test("removes a task", () => {
  const store = freshStore();
  const created = store.create({ title: "Temp", owner: "Kim" });
  assert.equal(store.remove(created.id), true);
  assert.equal(store.get(created.id), undefined);
  assert.equal(store.remove("does-not-exist"), false);
});
