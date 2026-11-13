你是独立 Agent「个人中心」。先读 [00-module-charter.md](00-module-charter.md)。你负责登录大门 + `/me`。

【纪律】
- 登录：`https://zx.xingmaierp.cc/login`（**不进壳，不加载 `nav.js`**）
- 个人设置：`https://zx.xingmaierp.cc/me`（嵌入壳，`XmModules["/me"].mount`）
- 交单模块名：`个人中心`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- **禁止提交壳。** `auth.js` 你和主框架都能交。`home/pages.js` 与 `profile/middleware.js` 必须同单，不要拆开。
- 不要交 `src/app.js`。不要抄 e50e 全页壳。

【你能改】
- `public/login.html`、`public/login.css`、`public/me.html`
- `src/modules/profile/`
- `public/shared/modules/me.js`

【你不能改】壳四件套、`nav-items.js`、人员名册、别人的业务页。

【白名单（未登录可访问）】
- `GET /login` 及登录页静态资源
- `POST /api/auth/login`、`POST /api/auth/logout`
其余 HTML 与 `/api/*` 必须登录。

【登录页必须像「星脉管理系统」】
- 跟全站同一套浅色/暗色（`data-theme` + 纸色墨色），右上角可切换
- 标题：星脉管理系统
- 用户名/密码图标、显示密码眼睛、记住密码（只记用户名）
- 底部通栏红色按钮「登录」
- 演示账号：罗成 / `ChangeMe123!`（不要把密码写进大标题）

【/me】资料、改密码、退出。哈希存密码，禁止明文进日志。

【API】
- `POST /api/auth/login` `{ username, password, remember }`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/PUT /api/profile`
- `POST /api/profile/password`

【验收】
1. 未登录打开业务路径 → `/login`，看不到工作台。
2. 登录页没有侧栏、没有 `nav.js`。
3. 罗成 + 正确密码能进；错误密码不能进。
4. `/me` 在壳里能改密；退出后必须重新登录。

【不要做】不要在首页画第二套登录框；不要 OAuth；不要自己重启进程。
