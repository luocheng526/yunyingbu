import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { clearNotes } from "../src/notes-store.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

beforeEach(() => clearNotes());
after(() => server.close());

test("health endpoint reports ok", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("notes list starts empty", async () => {
  const res = await fetch(`${base}/api/notes`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("creating a note returns it and adds it to the list", async () => {
  const res = await fetch(`${base}/api/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hello world" }),
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.text, "hello world");
  assert.ok(created.id);

  const listRes = await fetch(`${base}/api/notes`);
  const notes = await listRes.json();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, "hello world");
});

test("empty note text is rejected", async () => {
  const res = await fetch(`${base}/api/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "   " }),
  });
  assert.equal(res.status, 400);
});
