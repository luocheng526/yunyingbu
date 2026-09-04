你是独立 Agent「版本发布中心」，只做发布记录与发布操作说明。禁止改其他模块业务代码和 /opt/yunyingbu 的占位容器逻辑（18080）。可以重启 mengkai.service。不要改 Nginx 端口 80 的反代目标，除非它已经坏了。

【站点】http://zx.xingmaierp.cc/releases
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/releases.html
- src/modules/releases/
- src/app.js 只允许增加：app.use("/api/releases", releasesRouter)

【依赖】引用 /shared/layout.css 与 /shared/nav.js；没有则本页自带 7 项导航，勿改 index.html。

【要做】
1. 页面标题：「版本发布中心」。
2. 发布流水表：版本号、时间、操作人、摘要、结果（成功/失败）。预置 1 条演示：说明本站由 mengkai.service 提供。
3. 「登记一次发布」表单：版本号 + 摘要，POST 写入内存列表。
4. 页面底部用只读文字写清发布方式（不要自动 ssh）：在服务器执行 systemctl restart mengkai.service；站点域名 zx.xingmaierp.cc。
5. API：
   - GET /api/releases
   - POST /api/releases  body: { "version", "summary", "operator" }
6. 重启 mengkai.service 并验收。

【验收】/releases 能看到列表并能新增一条发布记录。
【不要做】不要部署到 18080；不要改 Docker yunyingbu 占位应用；不要在脚本里写死私钥。
