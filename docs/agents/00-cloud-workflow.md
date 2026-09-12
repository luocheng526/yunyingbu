# Cloud 开发 + 版本发布中心落地

10 个业务 Agent 和主框架都在 **Cursor Cloud** 改 `apps/xingmai/`。不要用 My Machines 在服务器本地改。

结构与边界以 [00-module-charter.md](00-module-charter.md) 为准。现行是嵌入式模块，不是每页一套完整站。

## 怎么干活

| 谁 | 改什么 | 怎么上线 |
|---|---|---|
| 主框架 | 壳、内核、闸补丁 | 交单，模块名「主框架」 |
| 首页 / 数据中心 / 沈子晗 / 韩梦凯 / 组织中心 / 店铺维护中心 / 甄选商学院 / 甄选智能体 / 个人中心 | 自己的目录 + `public/shared/modules/<id>.js` | 交单，等网页「通过」 |
| 版本发布中心 | 闸页和闸逻辑（只补丁，不整文件覆盖线上 router） | 交单；落地只走本页「通过」 |

生产目录是 ECS `/opt/mengkai`，站点 `https://zx.xingmaierp.cc`。禁止 SSH、禁止 `push-xingmai-to-ecs.sh`、禁止自己 `systemctl restart`。

做完：用 `罗成` / `luocheng` + `jingdong220` 登录 → `GET /api/releases/next` → `POST /api/releases`（`files` + `contents`）→ 等队首「通过」。
不要再用演示账号 / `ChangeMe123!`。见 [00-prod-admin.md](00-prod-admin.md)。

常规发布不录像。只有用户点名要预览图时才截图。
