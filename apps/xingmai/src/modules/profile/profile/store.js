import { hashPassword } from "./password.js";

/** Demo seed credentials are server-side only. Never send the hash to clients. */
export const DEMO_USERNAME = "罗成";
export const DEMO_INITIAL_PASSWORD = "ChangeMe123!";

const users = new Map();
const sessions = new Map();

function seedAdmin() {
  users.set(DEMO_USERNAME, {
    username: DEMO_USERNAME,
    displayName: "罗成",
    email: "luocheng@demo.local",
    phone: "",
    passwordHash: hashPassword(DEMO_INITIAL_PASSWORD)
  });
}

seedAdmin();

export function resetStoreForTests() {
  users.clear();
  sessions.clear();
  seedAdmin();
}

export function publicProfile(user) {
  if (!user) {
    return null;
  }
  return {
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone
  };
}

export function findUser(username) {
  if (typeof username !== "string") {
    return null;
  }
  return users.get(username) ?? null;
}

export function updateProfile(username, { displayName, email, phone }) {
  const user = findUser(username);
  if (!user) {
    return null;
  }
  user.displayName = String(displayName ?? "");
  user.email = String(email ?? "");
  user.phone = String(phone ?? "");
  return user;
}

export function setPasswordHash(username, passwordHash) {
  const user = findUser(username);
  if (!user) {
    return null;
  }
  user.passwordHash = passwordHash;
  return user;
}

export function createSession(username) {
  const sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  sessions.set(sid, { username, createdAt: Date.now() });
  return sid;
}

export function getSession(sid) {
  if (!sid) {
    return null;
  }
  return sessions.get(sid) ?? null;
}

export function destroySession(sid) {
  if (sid) {
    sessions.delete(sid);
  }
}
