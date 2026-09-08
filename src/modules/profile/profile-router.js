import { Router } from "express";
import { hashPassword, verifyPassword } from "./password.js";
import { currentUser, issueSession, logoutRequest, requireAuth, setSessionCookie } from "./session.js";
import { findUser, publicProfile, setPasswordHash, updateProfile } from "./store.js";

export const profileRouter = Router();

function sendProfile(res, user) {
  const profile = publicProfile(user);
  res.json({
    ok: true,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone
  });
}

profileRouter.post("/login", (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !password) {
    res.status(401).json({ ok: false, error: "请输入用户名和密码" });
    return;
  }
  const user = findUser(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ ok: false, error: "用户名或密码错误" });
    return;
  }
  setSessionCookie(res, issueSession(user.username));
  res.json({ ok: true, user: publicProfile(user) });
});

profileRouter.post("/logout", (req, res) => {
  logoutRequest(req, res);
  res.json({ ok: true });
});

profileRouter.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  sendProfile(res, user);
});

profileRouter.get("/", requireAuth, (req, res) => {
  sendProfile(res, req.user);
});

profileRouter.put("/", requireAuth, (req, res) => {
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const user = updateProfile(req.user.username, { displayName, email, phone });
  sendProfile(res, user);
});

profileRouter.post("/password", requireAuth, (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400).json({ ok: false, error: "请填写当前密码、新密码和确认新密码" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ ok: false, error: "新密码至少 8 位" });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ ok: false, error: "两次新密码不一致" });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ ok: false, error: "新密码不能与当前密码相同" });
    return;
  }
  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    res.status(403).json({ ok: false, error: "当前密码错误" });
    return;
  }

  setPasswordHash(req.user.username, hashPassword(newPassword));
  res.json({ ok: true, message: "密码已更新" });
});
