# 已取消：不要执行本文档

主脑已改口：线上无问题则保持现状，不回滚、不额外重启。见 [00-keep-production.md](00-keep-production.md)。

模块：生产回滚（清掉业务 Agent 私自上线的文件）
版本号建议：rollback-feature-agents-1
PR / 分支：无（ECS 现场回滚）
改动文件列表：
- 删除 /opt/mengkai/src/modules/home
- 删除 /opt/mengkai/src/modules/profile
- 删除 /opt/mengkai/public/login.html、login.css、me.html
- 删除 /opt/mengkai/public/shared（若仅为首页导航）
- 将 /opt/mengkai/src/app.js 恢复为不含 attachHome/attachProfile 的 notes 应用（可用 src/app.js.bak-home 若仍在）
- 将 public/index.html 恢复为 9 月 3 日原始笔记首页（若无备份则保留最简 notes 页）
- 保留 /opt/mengkai/src/modules/releases 与 public/releases.html（发布中心自己的模块，不在这 6 个回滚范围内）
用户可见变化：站点不再有首页工作台、登录墙、个人中心；恢复为早期笔记应用 + 发布中心（若保留）。
本机如何验收：SSH 后 ls /opt/mengkai/src/modules 应无 home、profile。
上线后如何验收：curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 为 200；GET /login 不再是登录页（可 404）。
依赖：无
回滚办法：再发一版从 Git apps/xingmai 推回
风险：未登录即可打开站点；数据中心等本就没上生产，无文件可删
是否需要重启 mengkai.service：是（全站只重启这一次）
