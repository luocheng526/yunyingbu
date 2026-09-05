【补丁·禁止自行发版·必须交发布文档】

即日起只有「版本发布中心」Agent 可以发版（同步 ECS、重启 mengkai.service）。

你禁止：SSH 登录 8.140.33.133、执行 push-xingmai-to-ecs.sh、systemctl restart、docker compose up 生产、覆盖 /opt/mengkai。

你做完功能后，在对话里输出一份完整「发布文档」，不要自己上线。用户会把文档交给版本发布中心并下令后才发版。

【发布文档必须含】
模块：
版本号建议：
PR / 分支：
改动文件列表（相对 apps/xingmai 或你仓库路径）：
用户可见变化：
本机如何验收：
上线后如何验收（URL、接口、账号）：
依赖（必须先上线的其他模块）：
回滚办法：
风险：
是否需要重启 mengkai.service：是/否

未输出发布文档 = 不算交付。不要设 SSH 轮询 timer。在 Cursor Cloud 改代码即可。
