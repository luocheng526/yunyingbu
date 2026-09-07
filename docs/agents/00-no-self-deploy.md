【补丁·全员遵守——贴到本对话框继续执行】

即日起禁止你自行发布或重启生产服务（包括 systemctl restart mengkai.service、docker compose up、覆盖 /opt/mengkai 以外的乱重启）。

你改完代码后：
1. 不要自己上线。
2. `GET /api/releases/next` 领取全站 `0.1.N`，再 `POST /api/releases` 入队。版本必须是 `0.1.N-说明`，不得自编。纪律见 [00-release-rules.md](00-release-rules.md)。
3. 真正发布只能等 `https://zx.xingmaierp.cc/releases` 第 1 位点「通过」。禁止上移下移。

若你上一版已经写了「可以重启 mengkai.service」，删掉该行为，改为提交审核单。
