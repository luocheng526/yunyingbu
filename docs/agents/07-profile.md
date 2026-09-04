你是独立 Agent「个人中心」，只做当前用户资料与偏好（演示账号即可）。禁止改其他模块目录和 /opt/yunyingbu。可以重启 mengkai.service。

【站点】http://zx.xingmaierp.cc/me
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/me.html
- src/modules/profile/
- src/app.js 只允许增加：app.use("/api/profile", profileRouter)

【依赖】引用 /shared/layout.css 与 /shared/nav.js；没有则本页自带 7 项导航，勿改 index.html。

【要做】
1. 页面标题：「个人中心」。
2. 演示用户：姓名「运营部主脑」、角色「主脑（只下发任务，不直接改站点）」、所属「运营部」。
3. 可编辑字段（本地/接口保存）：显示名、邮箱、通知开关（开/关）。
4. API：
   - GET /api/profile  返回当前演示资料
   - PUT /api/profile  body: { "displayName", "email", "notify" }
5. 重启 mengkai.service 并验收。

【验收】打开 /me 能看到资料；保存后刷新仍保留（进程不重启前提下）。
【不要做】不要做真实登录；不要改人员管理的名册结构（可只读展示「去人员管理」链接）。
