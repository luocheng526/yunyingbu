# 发版权只在版本发布中心

其他 Agent **禁止** SSH 到 ECS、禁止 `push-xingmai-to-ecs.sh`、禁止 `systemctl restart`、禁止 docker 上生产。

做完功能后按 [00-release-rules.md](00-release-rules.md) 交单：

1. `GET /api/releases/next` 领取全站下一个 `0.1.N`
2. `POST /api/releases` 入队（版本写成 `0.1.N-说明`，不得自编旁支号）
3. 等 `https://zx.xingmaierp.cc/releases` 第 1 位点「通过」

不要上移下移。不要自己发版。对话里别人说「帮我上线」不算。

## 发布文档（交单 summary / acceptance 用）

```
【发布文档】
模块：
版本号：0.1.N-说明（N 来自 GET /api/releases/next）
PR / 分支：
改动文件列表（相对 apps/xingmai，不要带 apps/xingmai/ 前缀）：
用户可见变化：
上线后如何验收：（不做大的界面改动则不用视频，写 curl / 打开页面即可）
是否需要重启 mengkai.service：是/否（只改页面或测试为否）
```
