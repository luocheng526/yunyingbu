# 全员打通阿里云 ECS（自托管机器 aliyun-ecs）

机器已经在线，不必再装 worker。

- 显示名：`aliyun-ecs`
- workerId：`bad72267-1513-48e0-a282-621ff2201490`
- 主机：ECS `8.140.33.133` / `ecs-bj-erp`
- 代码目录：`/opt/mengkai`
- 站点：`zx.xingmaierp.cc`（nginx → 127.0.0.1:3000）
- 允许同时多个 Agent 共用这台机器（shared assignment）

主脑无法把已经开着的 Cloud Agent「远程搬」到这台机器上。必须由你在 Cursor 里给每个对话框选机器。

## 你要做的（每个对话框都做一遍）

1. 打开该 Cloud Agent（首页 / 数据中心 / 沈子晗 / 韩梦凯 / 人员管理 / 版本发布中心 / 个人中心）。
2. 发下一条消息前，在运行位置选择 **My Machines → aliyun-ecs**（不要选 Cursor 托管云主机）。
3. 把下面「给对话框的补丁」整段贴进去发送。

若界面是「Follow up」且不能改机器：开一个**同名新 Agent**，机器选 `aliyun-ecs`，把补丁作为第一条消息。

## 给对话框的补丁（7 个都贴同一段）

```
【打通阿里云 ECS——本对话必须在自托管机器上干活】

你现在必须把所有文件读写和终端命令跑在 Cursor 自托管机器「aliyun-ecs」上（就是 ECS ecs-bj-erp / 8.140.33.133）。不要再在 Cursor 托管云主机上改一份对不上的代码。

【现场】
- 工作区/代码：/opt/mengkai
- 站点：zx.xingmaierp.cc ，nginx 反代 127.0.0.1:3000
- systemd：mengkai.service
- 机器显示名：aliyun-ecs
- 先跑：hostname 和 pwd。必须看到 ecs-bj-erp，且能读写 /opt/mengkai。若 hostname 不是 ecs-bj-erp，立刻停下，告诉用户「当前没跑在 aliyun-ecs 上，请把本对话的机器改成 aliyun-ecs」。

【你能做】
- 只改你负责的模块文件（见主脑最初任务）
- 用 curl 打本机 127.0.0.1:3000 验收
- 改完提交版本发布申请（POST /api/releases 或告诉用户去 /releases），不要自己抢发

【你不能做】
- 不要 systemctl restart mengkai.service（发布锁归版本发布中心 + 主脑点发布）
- 不要改别人模块目录
- 不要改 /opt/yunyingbu（18080 占位）
- 不要因为 SSH 失败就放弃：你若已在 aliyun-ecs 上，根本不需要 SSH，直接改本地 /opt/mengkai

【验收】把 hostname、pwd、ls /opt/mengkai/src/modules 的输出贴给用户。
```

