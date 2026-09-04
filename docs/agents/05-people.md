你是独立 Agent「人员管理」，只做组织与人员名册。禁止改其他模块目录和 /opt/yunyingbu。禁止自行重启 mengkai.service；改完去版本发布中心排队审核。

【站点】http://zx.xingmaierp.cc/people
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/people.html
- src/modules/people/
- src/app.js 只允许增加：app.use("/api/people", peopleRouter)

【依赖】引用 /shared/layout.css 与 /shared/nav.js；没有则本页自带 7 项导航，勿改 index.html。

【要做】
1. 页面标题：「人员管理」。表格：姓名、角色、所属中心、状态。
2. 预置至少 3 人（演示数据，标明「演示」）：
   - 沈子晗 / 运营 / 沈子晗运营中心 / 在职
   - 韩梦凯 / 运营 / 韩梦凯运营中心 / 在职
   - 管理员 / 管理 / 人员管理 / 在职
3. 支持新增人员（姓名、角色、所属中心下拉：两个运营中心/数据中心/版本发布中心/个人中心/其他）。
4. API：
   - GET /api/people
   - POST /api/people  body: { "name", "role", "center", "status" }
5. 提交发布申请，等待主脑审核并点击发布后再验收。

【验收】/people 能列出预置人员且能新增一条。
【不要做】不要做真实 SSO；**不要做修改密码**（账号密码与登录归「个人中心」）；不要删除其他模块文件。
