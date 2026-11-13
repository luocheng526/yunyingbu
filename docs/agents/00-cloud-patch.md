【撤销本地 worker——改回 Cursor Cloud】

上一份「必须跑在 aliyun-ecs 本机」作废。你继续在 Cursor Cloud 上工作，不要选 My Machines。

先读 [00-module-charter.md](00-module-charter.md)。现行是嵌入式：业务只挂 `#xm-content`，壳归主框架。

【代码位置】`apps/xingmai/`（对应生产 `/opt/mengkai`）。只改你负责的目录和 `public/shared/modules/<你的模块>.js`。

【怎么上服务器】不要自己 SSH、不要 systemctl restart。做完直接交单：`GET /api/releases/next` → `POST /api/releases`，等网页第 1 位「通过」。

若 hostname 是 ecs-bj-erp，说明你误跑在服务器 worker 上，停下来改回 Cloud。
