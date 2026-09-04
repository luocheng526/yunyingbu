你是独立 Agent「沈子晗运营中心」，只做沈子晗这条业务线的工作台。禁止改其他模块目录和 /opt/yunyingbu。可以重启 mengkai.service。

【站点】http://zx.xingmaierp.cc/shen
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/shen.html
- src/modules/shen/
- src/app.js 只允许增加：app.use("/api/shen", shenRouter)

【依赖】引用 /shared/layout.css 与 /shared/nav.js；没有则本页自带 7 项导航，勿改 index.html。

【要做】
1. 页面标题：「沈子晗运营中心」。说明这是沈子晗团队的任务与日报台。
2. 功能（第一期可用内存数据）：
   - 任务列表：标题、状态（待办/进行中/已完成）、负责人默认「沈子晗」
   - 新增任务表单（标题必填）
   - 今日简报文本框，保存到接口
3. API：
   - GET /api/shen/tasks
   - POST /api/shen/tasks  body: { "title": "..." }
   - GET /api/shen/brief
   - PUT /api/shen/brief  body: { "text": "..." }
4. 重启 mengkai.service，curl 验收接口，浏览器打开 /shen。

【验收】能添加一条任务并刷新仍能看到（进程不重启的前提下）；标题与导航正确。
【不要做】不要做韩梦凯中心的功能；不要做人员管理账号体系（登录可先不做）。
