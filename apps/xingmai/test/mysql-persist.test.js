import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { startMysql } from "../src/notes-store.js";
import { setPoolForTests, setDbMode } from "../src/modules/profile/auth.js";
import { createMemoryPool } from "./helpers/memory-mysql.js";
import { resetStoreForTests } from "../src/modules/profile/auth.js";
import { resetHanStore } from "../src/modules/han/store.js";
import { resetStore as resetShenStore } from "../src/modules/shen/store.js";
import { resetPeopleStore } from "../src/modules/people/store.js";
import { clearNotes, createNotesStore } from "../src/notes-store.js";

const server = createApp().listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => {
  resetStoreForTests();
  server.close();
});

async function loginCookie() {
  resetStoreForTests();
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "luocheng", password: "ChangeMe123!" })
  });
  assert.equal(res.status, 200);
  return String(res.headers.get("set-cookie") || "").split(";")[0];
}

test("memory mode keeps the live JSON shapes for every business API", async () => {
  resetHanStore();
  resetShenStore();
  resetPeopleStore();
  clearNotes();
  const liveNotes = createNotesStore();
  assert.equal(typeof liveNotes.list, "function");
  assert.equal(typeof liveNotes.create, "function");
  assert.deepEqual(liveNotes.list(), []);
  const cookie = await loginCookie();
  const headers = { cookie, "Content-Type": "application/json" };

  const hanTasks = await (await fetch(`${base}/api/han/tasks`, { headers })).json();
  assert.deepEqual(hanTasks, { ok: true, tasks: [] });
  const createdHan = await fetch(`${base}/api/han/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "函件归档" })
  });
  assert.equal(createdHan.status, 201);
  const hanBody = await createdHan.json();
  assert.equal(hanBody.ok, true);
  assert.equal(hanBody.task.title, "函件归档");
  assert.equal(hanBody.task.owner, "韩梦凯");
  const hanBrief = await fetch(`${base}/api/han/brief`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ text: "今日无积压" })
  });
  assert.deepEqual(await hanBrief.json(), { ok: true, text: "今日无积压" });

  const shenCreated = await fetch(`${base}/api/shen/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "早会" })
  });
  assert.equal(shenCreated.status, 201);
  assert.equal((await shenCreated.json()).owner, "沈子晗");
  const shenTasks = await (await fetch(`${base}/api/shen/tasks`, { headers })).json();
  assert.equal(shenTasks.tasks.length, 1);

  const people = await (await fetch(`${base}/api/people`, { headers })).json();
  assert.equal(people.ok, true);
  assert.equal(people.people.length, 3);
  const added = await fetch(`${base}/api/people`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "罗成", role: "主脑", center: "其他" })
  });
  assert.equal(added.status, 201);

  const overview = await (await fetch(`${base}/api/data/overview`, { headers })).json();
  assert.equal(overview.ok, true);
  assert.equal(overview.cards.length, 4);
  assert.equal(overview.events.length, 5);

  const noteRes = await fetch(`${base}/api/notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "备忘" })
  });
  assert.equal(noteRes.status, 201);
  const notes = await (await fetch(`${base}/api/notes`, { headers })).json();
  assert.equal(notes.length, 1);
});

test("mysql mode hydrates seeds and keeps writes after a second hydrate", async () => {
  resetHanStore();
  resetShenStore();
  resetPeopleStore();
  clearNotes();
  resetStoreForTests();
  setPoolForTests(createMemoryPool());
  await startMysql({ skipCreateDatabase: true });

  const cookieRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "罗成", password: "ChangeMe123!" })
  });
  assert.equal(cookieRes.status, 200);
  const cookie = String(cookieRes.headers.get("set-cookie") || "").split(";")[0];
  const headers = { cookie, "Content-Type": "application/json" };

  await fetch(`${base}/api/han/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "入库函件" })
  });
  await fetch(`${base}/api/han/brief`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ text: "库里的日报" })
  });
  await fetch(`${base}/api/shen/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "入库任务" })
  });
  await fetch(`${base}/api/people`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "新同事", role: "运营", center: "数据中心" })
  });
  await fetch(`${base}/api/profile`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ displayName: "罗成主脑", email: "luocheng@demo.local", phone: "13800000000" })
  });

  await startMysql({ skipCreateDatabase: true });

  const hanRes = await fetch(`${base}/api/han/tasks`, { headers });
  assert.equal(hanRes.status, 200);
  const han = await hanRes.json();
  assert.equal(Array.isArray(han.tasks), true);
  assert.equal(han.tasks.some((task) => task.title === "入库函件"), true);
  const brief = await (await fetch(`${base}/api/han/brief`, { headers })).json();
  assert.equal(brief.text, "库里的日报");
  const shen = await (await fetch(`${base}/api/shen/tasks`, { headers })).json();
  assert.equal(shen.tasks.some((task) => task.title === "入库任务"), true);
  const people = await (await fetch(`${base}/api/people`, { headers })).json();
  assert.equal(people.people.some((person) => person.name === "新同事"), true);
  const me = await (await fetch(`${base}/api/profile`, { headers })).json();
  assert.equal(me.displayName, "罗成主脑");
  assert.equal(me.phone, "13800000000");
  const overview = await (await fetch(`${base}/api/data/overview`, { headers })).json();
  assert.equal(overview.cards[0].value, 128);

  resetStoreForTests();
  setDbMode("memory");
});
