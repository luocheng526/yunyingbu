import { Router } from "express";
import { verifyPassword } from "./password.js";
import { currentUser, issueSession, logoutRequest, setSessionCookie } from "./session.js";
import { findUser, publicProfile } from "./store.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
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

  const sid = issueSession(user.username);
  setSessionCookie(res, sid);
  res.json({ ok: true, user: publicProfile(user) });
});

authRouter.post("/logout", (req, res) => {
  logoutRequest(req, res);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return;
  }
  const profile = publicProfile(user);
  res.json({
    ok: true,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone
  });
});
