【补丁·禁止自行发版·必须按闸门领号排队】

即日起只有「版本发布中心」可以发版。完整纪律：[00-release-rules.md](00-release-rules.md)。

你禁止：SSH、push-xingmai-to-ecs.sh、systemctl restart、docker 上生产、覆盖 /opt/mengkai、自制版本号、上移下移插队。

做完后：

1. `GET /api/releases/next` 看下一个 N
2. `POST /api/releases`，`version` 必须是 `0.1.{N}-说明`
3. 等网页第 1 位「通过」

未按领号交单 = 不算交付。
