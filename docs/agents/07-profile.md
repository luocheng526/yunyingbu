你是独立 Agent「个人中心」。本模块只负责**当前登录账号自己的设置**：资料、改密码、安全选项。禁止改人员管理名册、禁止改其他模块目录和 /opt/yunyingbu。禁止自行重启 mengkai.service；改完去版本发布中心排队审核。

【站点】http://zx.xingmaierp.cc/me
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/me.html
- src/modules/profile/
- src/app.js 只允许增加：
  - app.use("/api/profile", profileRouter)
  - app.use("/api/auth", authRouter)（仅登录/退出当前账号，不要做组织级权限后台）

【依赖】引用 /shared/layout.css 与 /shared/nav.js；没有则本页自带 7 项导航，勿改 index.html。

【职责边界】
- 个人中心：我是谁、改我的显示名/邮箱/手机、修改我的密码、退出登录。
- 人员管理：全员名册、入职离职、所属中心。不要在人员管理里做「改别人密码」（除非以后主脑另下任务）。
- 不要把密码明文写进 HTML 或日志。服务端用哈希存储（Node crypto，如 scrypt/pbkdf2）。

【第一期账号（演示，页面标明演示）】
预置 1 个可登录账号：
- 用户名：admin
- 初始密码：ChangeMe123!
登录成功后才显示设置页；未登录显示登录表单。

【页面必须有】
1. 标题：「个人中心」
2. 未登录：用户名 + 密码 +「登录」
3. 已登录：
   - 账号信息：用户名（只读）、显示名、邮箱、手机
   - 「保存资料」
   - 「修改密码」：当前密码、新密码、确认新密码（新密码至少 8 位，两次一致，不能与当前相同）
   - 「退出登录」
4. 改密码成功后保持登录或要求重新登录均可，但必须提示成功/失败原因（当前密码错误、两次不一致等）。

【API】
- POST /api/auth/login     { username, password } → 设置 session/cookie，失败 401
- POST /api/auth/logout
- GET  /api/auth/me        未登录 401；已登录返回 { username, displayName, email, phone }（绝不返回密码哈希）
- GET  /api/profile        同 me，需登录
- PUT  /api/profile        { displayName, email, phone } 需登录
- POST /api/profile/password  { currentPassword, newPassword, confirmPassword } 需登录
  校验失败 400，当前密码错 403

Session 用内存 + httpOnly cookie 即可（进程重启会掉登录，可接受）。

【验收】
1. 错误密码无法登录。
2. 正确登录后可改显示名，刷新仍在（未重启进程时）。
3. 当前密码错误时不能改密。
4. 正确改密后，旧密码不能再登录，新密码可以。
5. 打开 /me 能完成登录、改资料、改密码、退出。

【不要做】不要做第三方 OAuth；不要改 /people 表格结构；不要在前端保存明文密码；不要自己 systemctl restart。
