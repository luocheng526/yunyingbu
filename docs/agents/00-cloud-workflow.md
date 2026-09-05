# Cloud 开发 + ECS 发布（现行方案）

**已废弃：** 让 7 个 Agent 选 My Machines `aliyun-ecs` 在服务器本地改代码。不可行，改回 **Cursor Cloud**。

## 怎么干活

| 谁 | 在哪改代码 | 怎么上 ECS |
|----|------------|------------|
| 首页 / 数据中心 / 沈子晗 / 韩梦凯 / 人员管理 / 个人中心 | Cloud，`apps/xingmai/` | **只输出发布文档**，禁止自己上 ECS |
| 版本发布中心 | Cloud | 仅当主脑粘贴发布文档并说「发版」后，才 push 到 `/opt/mengkai` 并按文档重启 |
| 主脑 | Cloud | 拆任务、验收，不直接改业务页 |

生产目录仍是 ECS `/opt/mengkai`，站点 `zx.xingmaierp.cc`。Cloud 上的同源代码在 **`apps/xingmai`**。

## SSH（只有发版需要）

Cloud Agent 默认没有 ECS 私钥。请在 Cursor 环境 Secrets 增加：

- `ALIYUN_SSH_PRIVATE_KEY`：与服务器 `authorized_keys` 里 `yunyingbu-deploy` 对应的私钥全文

本机/主脑已有 `~/.ssh/yunyingbu_aliyun`。不要把私钥提交进 Git。

```bash
# 从 ECS 拉最新到仓库
./deploy/scripts/pull-xingmai-from-ecs.sh

# 同步文件到 ECS（不重启）
./deploy/scripts/push-xingmai-to-ecs.sh
```

## 安全组

站点外网要通：入方向 **TCP 80** 和 **TCP 443**（以及已放行的 22、18080）。

360 等浏览器会强制 `https://zx.xingmaierp.cc`（走 443）。安全组还没放行 443 时，页面就是「打开页面失败」。

**临时可用（443 未放行时）：** `https://zx.xingmaierp.cc:18080/login`  
账号 `luocheng`，密码 `ChangeMe123!`。

长期：在阿里云安全组 `sg-2zee621yvv8l64q2x2jb` 增加 **TCP 443 / 0.0.0.0/0**，然后即可用 `https://zx.xingmaierp.cc/login`。
