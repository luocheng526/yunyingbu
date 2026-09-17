import assert from "node:assert/strict";
import test from "node:test";
import { selectPopupNotice } from "../src/modules/notices/store.js";

test("ordinary active notices do not open a login popup", () => {
  const selected = selectPopupNotice([
    { id: "ordinary", status: "active", popup: false },
    { id: "draft-popup", status: "draft", popup: true }
  ]);
  assert.equal(selected, null);
});

test("only an active notice explicitly marked popup opens at login", () => {
  const selected = selectPopupNotice([
    { id: "ordinary", status: "active", popup: false },
    { id: "login-popup", status: "active", popup: true }
  ]);
  assert.equal(selected.id, "login-popup");
});
