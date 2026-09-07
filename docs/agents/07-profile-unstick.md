【解卡·个人中心——覆盖「全站登录大门」补丁】

你看错补丁了。「未登录不要自己做登录框」是给数据中心、沈子晗、韩梦凯、人员管理、版本发布中心的。你就是负责登录页的人。必须做 /login。首页已经交付，正在等你。禁止再空转。禁止改 src/modules/home 里的业务文案。禁止自行 systemctl restart（做完提交版本发布中心审核）。

【现场（以服务器为准，不要假设缺文件）】
- 代码在 /opt/mengkai
- src/app.js 已有 attachHome(app)
- 首页导航已好：public/shared/nav.js、layout.css
- GET /me 现在是首页占位「该模块 Agent 尚未交付」（因为还没有 public/me.html）
- GET /login 404，GET /api/auth/me 404
- 首页 pages.js 约定：/me 对应 public/me.html，文件存在就会 sendFile，你只要把 me.html 写出来即可，不要改 pages.js

【你要新建的文件】
- public/login.html
- public/login.css
- public/me.html
- src/modules/profile/auth.js        登录/退出/session/改密/资料
- src/modules/profile/middleware.js  未登录拦截
- src/modules/profile/attach.js      attachProfile(app)

【src/app.js 只改两处】
1. import { attachProfile } from "./modules/profile/attach.js";
2. 在 createApp 里、express.json() 之后、现有路由之前：attachProfile(app);
不要删 notes、不要删 attachHome。

【attachProfile 必须做】
1. 白名单：GET /login、/login.css、POST /api/auth/login、POST /api/auth/logout、GET /api/health
2. 其它 /api/* 无 session → 401 JSON
3. 其它页面无 session → 302 /login
4. GET /login → login.html（已登录可 302 到 /）
5. app.use("/api/auth", …) 与 app.use("/api/profile", …)

【登录页】标题「星脉管理系统」；白卡片；用户名+小人图标；密码+锁+眼睛；红勾「记住密码」（只记用户名）；红按钮「登录」。演示账号：罗成 / ChangeMe123!

【/me】必须登录后：显示名/邮箱/手机、改密码、退出。退出 POST /api/auth/logout 后去 /login。

【验收（在服务器 curl，不要说做完却 404）】
- 未带 cookie：GET / 和 GET /me 为 302 到 /login
- GET /login 200，HTML 含「星脉管理系统」
- POST /api/auth/login {"username":"罗成","password":"ChangeMe123!"} 成功并 Set-Cookie
- 带 cookie：GET /api/auth/me 200
- 错密码 401
完成后把 curl 结果贴给用户。不要再引用「全站登录大门」来拒绝做登录页。
