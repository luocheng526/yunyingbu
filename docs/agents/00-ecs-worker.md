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
