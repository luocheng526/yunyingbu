import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { authRouter, resetStoreForTests } from "../src/modules/profile/auth.js";
import { createOrgStore, listOrgStores, resetOrgBoard } from "../src/modules/people/org-board.js";
import { peopleRouter } from "../src/modules/people/router.js";
import { effectiveSiteAcl, grantBatchSiteAcl, resetSiteAcl, savePersonSiteAcl } from "../src/modules/people/site-acl.js";
import { createPerson, resetPeopleStore } from "../src/modules/people/store.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/people", peopleRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const visible = { see: true, enter: false, edit: false };
const enter = { see: true, enter: true, edit: false };
const edit = { see: true, enter: true, edit: true };

beforeEach(() => {
  resetStoreForTests();
  resetSiteAcl();
  resetPeopleStore();
  resetOrgBoard();
});
after(() => server.close());

async function member(name, lineManager) {
  const result = await createPerson({ name, operator: name, lineManager, status: "在职" });
  assert.equal(result.ok, true);
  return result.person;
}

async function store(name, manager) {
  assert.equal((await createOrgStore({ storeName: name, storeId: name, manager }, "罗成")).ok, true);
  return String(listOrgStores({}, "罗成").find(row => row.storeName === name).id);
}

async function login() {
  const response = await fetch(origin + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "罗成", password: "ChangeMe123!" })
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

function grant(input, cookie = "") {
  return fetch(origin + "/api/people/org/site-acl/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(input)
  });
}

test("batch grants the chosen feature and store to multiple members while keeping existing rights", async () => {
  const first = await member("批量甲", "沈子晗");
  const second = await member("批量乙", "韩梦凯");
  const originalStore = await store("原有店铺", "沈子晗");
  const newStore = await store("新增店铺", "韩梦凯");
  await savePersonSiteAcl("罗成", first.name, {
    modules: { home: { ...edit, features: { "home.company": edit } } },
    stores: { [originalStore]: visible, [newStore]: edit }
  });
  const targetIds = [first, second].map(person => String(person.id));
  const input = {
    targetIds: [...targetIds, targetIds[0]],
    modules: { shopkeep: { features: { "shopkeep.reviews": enter } } },
    stores: { [newStore]: visible }
  };
  const cookie = await login();
  assert.equal((await grant(input)).status, 403);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await grant(input, cookie);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).updatedIds, targetIds);
  }
  for (const target of [first, second]) {
    const sheet = effectiveSiteAcl(target.name);
    assert.equal(sheet.modules.shopkeep.enter, true);
    assert.deepEqual(sheet.modules.shopkeep.features["shopkeep.reviews"], enter);
    assert.equal(sheet.modules.shopkeep.features["shopkeep.stock"].see, false);
  }
  const firstSheet = effectiveSiteAcl(first.name);
  assert.equal(firstSheet.modules.home.features["home.company"].edit, true);
  assert.deepEqual(firstSheet.stores[originalStore], visible);
  assert.deepEqual(firstSheet.stores[newStore], edit);
  assert.deepEqual(effectiveSiteAcl(second.name).stores[newStore], visible);
});

test("out-of-scope members or stores reject the whole batch", async () => {
  const first = await member("组内运营", "沈子晗");
  const second = await member("其他组运营", "韩梦凯");
  const otherStore = await store("组外店铺", "韩梦凯");
  const id = String(first.id);
  const modules = { home: visible };
  const rejectedMember = await grantBatchSiteAcl("沈子晗", { targetIds: [id, String(second.id)], modules });
  assert.equal(rejectedMember.statusCode, 403);
  const rejectedStore = await grantBatchSiteAcl("沈子晗", { targetIds: [id], modules, stores: { [otherStore]: visible } });
  assert.equal(rejectedStore.statusCode, 403);
  assert.equal(effectiveSiteAcl(first.name).configured, false);
  assert.equal(effectiveSiteAcl(second.name).configured, false);
  assert.equal((await grantBatchSiteAcl("沈子晗", { targetIds: [id], modules })).ok, true);
});

test("simultaneous batches preserve each other's grants", async () => {
  const person = await member("并发授权", "沈子晗");
  const targetIds = [String(person.id)];
  const results = await Promise.all([
    grantBatchSiteAcl("罗成", { targetIds, modules: { home: visible } }),
    grantBatchSiteAcl("罗成", { targetIds, modules: { shopkeep: enter } })
  ]);
  assert.ok(results.every(result => result.ok));
  const { modules } = effectiveSiteAcl(person.name);
  assert.equal(modules.home.see, true);
  assert.equal(modules.shopkeep.enter, true);
});
