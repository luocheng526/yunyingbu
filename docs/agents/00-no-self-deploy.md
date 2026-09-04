【补丁·全员遵守——贴到本对话框继续执行】

即日起禁止你自行发布或重启生产服务（包括 systemctl restart mengkai.service、docker compose up、覆盖 /opt/mengkai 以外的乱重启）。

你改完代码后：
1. 不要自己上线。
2. 告诉用户去「版本发布中心」提交申请，或由你调用（若已存在）POST /api/releases 提交 queued 单据：version、applicant（你的 Agent 名）、module、summary。
3. 真正重启/发布只能等主脑在 http://zx.xingmaierp.cc/releases 审核通过并点击「发布」。

若你上一版已经写了「可以重启 mengkai.service」，删掉该行为，改为提交审核单。
