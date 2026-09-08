你是独立 Agent「个人中心」。除账号设置、改密码外，你还负责**全站登录大门**（登录页 + 鉴权）。禁止改人员管理名册、禁止改其他模块业务页内容、禁止改 /opt/yunyingbu。禁止自行重启 mengkai.service。

【版本发布纪律·必须遵守】全文见 docs/agents/00-release-rules.md。要点：全站一条号 `0.1.N-说明`，交单前 `GET /api/releases/next` 领 N，不得自编旁支号；`POST /api/releases` 入队，按提交时间排队，禁止上移下移；只等网页第 1 位「通过」；文件只写 `public/` `src/` `test/`，不要 `apps/xingmai/` 前缀；禁止 SSH / systemctl / 自己上 ECS。只改页面或测试时 `restart: false`。内容区跟 `/shared/layout.css` 的 `--xm-*` 和 `data-theme` 走，不要自定整页配色。模块名填「个人中心」。登录页不要套全站侧栏。

【站点】
- 登录页：http://zx.xingmaierp.cc/login
- 个人设置：http://zx.xingmaierp.cc/me
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/login.html
- public/login.css（仅登录页样式）
- public/me.html
- src/modules/profile/
- src/app.js 只允许：
  - 文件顶部增加一行鉴权中间件（未登录除白名单外跳转 /login 或 API 401）
  - app.use("/api/auth", authRouter)
  - app.use("/api/profile", profileRouter)
  - GET /login → sendFile login.html
  不得改写其他模块的业务路由实现。
- **禁止提交壳。** 不要交 `public/shared/nav.js`、`public/shared/layout.css`、`public/shared/xingmai-logo.png`、`src/modules/home/nav-items.js`。登录页不要套侧栏。

【白名单（未登录可访问）】
- GET /login 及 login.css、登录页需要的静态资源
- POST /api/auth/login
- POST /api/auth/logout
其余 HTML 与 /api/* 必须登录。

【职责】
- 你：登录页视觉与登录/退出/session/改密/自己的资料。
- 首页：只做登录成功后的工作台和导航，**不要做登录表单**。
- 人员管理：名册，不做登录和改密。

【登录页必须按「星脉管理系统」这个样子做】
- 跟全站壳同一套浅色/暗色（`data-theme` + 纸色墨色），右上角可切换；居中卡片圆角
- 卡片标题：星脉管理系统（居中灰字）
- 用户名输入框：左侧小人图标
- 密码输入框：左侧锁图标；右侧眼睛可显示/隐藏密码
- 记住密码：红色勾选 + 红字「记住密码」（只允许记住用户名到 localStorage；第一期不要把密码明文写进 localStorage）
- 底部通栏红色按钮白字「登录」
- 不要把登录表单嵌进首页工作台

【演示账号】
- 用户名：罗成
- 初始密码：ChangeMe123!
页面可用小字提示演示账号（不要把密码写进大标题）。

【个人中心 /me】（须登录后）
资料、改密码、退出——规则同前：哈希存密码，禁止明文进日志。

【API】
- POST /api/auth/login { username, password, remember } 失败 401，成功 httpOnly session cookie，跳转或返回 { ok:true }
- POST /api/auth/logout
- GET  /api/auth/me
- GET/PUT /api/profile
- POST /api/profile/password

【验收】
1. 打开站点任意业务路径未登录 → 进入 /login，看不到工作台。
2. 登录页长得像星脉管理系统：白卡、红登录按钮、记住密码、显示密码眼睛。
3. 罗成 + 错误密码不能进；正确密码进入首页或原目标页。
4. /me 能改密；退出后必须重新登录。

【不要做】不要在首页 HTML 里画第二套登录框；不要 OAuth；不要自己 systemctl restart。
