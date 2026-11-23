import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { authRouter, profileRouter, resetStoreForTests, addUserForTests, setPoolForTests, setDbMode, hydrateFromMysql } from "../src/modules/profile/auth.js";
import { createPerson, patchPerson, patchPeoplePasswords, importPeople, listPeople, resetPeopleStore } from "../src/modules/people/store.js";
import { createMemoryPool } from "./helpers/memory-mysql.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
beforeEach(() => { resetStoreForTests(); resetPeopleStore(); setDbMode("memory"); });
after(() => { resetPeopleStore(); server.close(); });
const login = (username, password) => fetch(`${base}/api/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password })
});
const member = async () => (await createPerson({ name: "同步测试成员", username: "sync-member", password: "Original123!" })).person;

test("existing organization password works without an authentication row", async () => {
  const person = await member();
  await patchPerson(person.id, { password: "Reset123!" });
  assert.equal((await login(person.username, "Original123!")).status, 401);
  const response = await login(person.username, "Reset123!");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.username, person.username);
});

test("reset rejects the old authentication hash and survives authentication rehydration", async () => {
  const person = await member();
  addUserForTests({ username: person.username, displayName: person.name, password: "Original123!" });
  const pool = createMemoryPool();
  const query = pool.query.bind(pool);
  pool.query = (sql, params) => /xm_me_(devices|notices|avatars)/.test(sql)
    ? Promise.resolve([[], undefined]) : query(sql, params);
  setPoolForTests(pool); setDbMode("mysql");
  await patchPerson(person.id, { password: "Reset123!" });
  assert.equal((await login(person.username, "Original123!")).status, 401);
  assert.equal((await login(person.username, "Reset123!")).status, 200);
  resetStoreForTests(); setPoolForTests(pool); setDbMode("mysql");
  await hydrateFromMysql();
  assert.equal((await login(person.username, "Reset123!")).status, 200);
  assert.equal((await login(person.username, "Original123!")).status, 401);
});

test("bulk reset and import passwords are effective immediately", async () => {
  const person = await member();
  await patchPeoplePasswords([person.id], "Batch123!");
  assert.equal((await login(person.username, "Batch123!")).status, 200);
  await importPeople([{ name: person.name, username: person.username, password: "Import123!" }]);
  assert.equal((await login(person.username, "Batch123!")).status, 401);
  assert.equal((await login(person.username, "Import123!")).status, 200);
});

test("personal password change updates organization credentials and checks the current roster password", async () => {
  const person = await member();
  const response = await login(person.username, "Original123!");
  const cookie = response.headers.get("set-cookie").split(";")[0];
  await patchPerson(person.id, { password: "AdminReset123!" });
  const change = (currentPassword) => fetch(`${base}/api/profile/password`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ currentPassword, newPassword: "Personal123!", confirmPassword: "Personal123!" })
  });
  assert.equal((await change("Original123!")).status, 403);
  assert.equal((await change("AdminReset123!")).status, 200);
  assert.equal(listPeople().find(row => row.id === person.id).password, "Personal123!");
  assert.equal((await login(person.username, "AdminReset123!")).status, 401);
  assert.equal((await login(person.username, "Personal123!")).status, 200);
});

test("renamed and departed accounts cannot use their old authentication rows", async () => {
  const person = await member();
  assert.equal((await login(person.username, "Original123!")).status, 200);
  await patchPerson(person.id, { username: "renamed-member" });
  assert.equal((await login(person.username, "Original123!")).status, 401);
  assert.equal((await login("renamed-member", "Original123!")).status, 200);
  await patchPerson(person.id, { status: "离职" });
  assert.equal((await login("renamed-member", "Original123!")).status, 401);
});

test("admin aliases keep their existing authentication and ignore roster collisions", async () => {
  await createPerson({ name: "alias collision", username: "luocheng", password: "Wrong123!" });
  assert.equal((await login("luocheng", "Wrong123!")).status, 401);
  assert.equal((await login("luocheng", "ChangeMe123!")).status, 200);
  assert.equal((await login("罗成", "ChangeMe123!")).status, 200);
});

test("authentication persistence errors fail closed and do not issue a session", async () => {
  const person = await member();
  setPoolForTests({ query: async () => { throw new Error("database unavailable"); } }); setDbMode("mysql");
  const response = await login(person.username, "Original123!");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("saved organization password remains usable in a fresh server process", () => {
  const appDir = fileURLToPath(new URL("../", import.meta.url));
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "xm-login-restart-"));
  try {
    fs.writeFileSync(path.join(isolated, "package.json"), '{"type":"module"}');
    fs.symlinkSync(fs.realpathSync(path.join(appDir, "node_modules")), path.join(isolated, "node_modules"), "junction");
    for (const module of ["profile", "people"]) {
      const destination = path.join(isolated, "src/modules", module);
      fs.mkdirSync(destination, { recursive: true });
      for (const entry of fs.readdirSync(path.join(appDir, "src/modules", module))) {
        if (entry.endsWith(".js")) fs.copyFileSync(path.join(appDir, "src/modules", module, entry), path.join(destination, entry));
      }
    }
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const script = `
      import assert from 'node:assert/strict';
      import express from 'express';
      import { createPerson, patchPerson } from './src/modules/people/store.js';
      import { authRouter } from './src/modules/profile/auth.js';
      if (process.env.LOGIN_PHASE === 'write') {
        const { person } = await createPerson({name:'重启测试',username:'restart-member',password:'Before123!'});
        await patchPerson(person.id,{password:'After123!'});
      } else {
        const app=express(); app.use(express.json()); app.use('/auth',authRouter);
        const server=app.listen(0);
        try {
          for(const [password,status] of [['Before123!',401],['After123!',200]]) {
            const res=await fetch('http://127.0.0.1:'+server.address().port+'/auth/login', {
              method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'restart-member',password})
            }); assert.equal(res.status,status);
          }
        } finally { await new Promise(resolve=>server.close(resolve)); }
      }
    `;
    for (const phase of ["write", "read"]) execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: isolated, env: { ...env, LOGIN_PHASE: phase }, timeout: 20000, stdio: "pipe"
    });
  } finally {
    // Never traverse the shared dependency junction during cleanup.
    const junction = path.join(isolated, "node_modules");
    if (fs.existsSync(junction)) fs.unlinkSync(junction);
    fs.rmSync(isolated, { recursive: true, force: true });
  }
});
