# AGENTS.md

主脑：罗成。线上站点：https://zx.xingmaierp.cc

发布纪律正文见 `docs/agents/00-release-rules.md`。下面是主脑口令，覆盖旧稿。

## 实时 / 付费看板只用本地接口

首页「实时」、韩梦凯「实时付费」、沈子晗「付费中心」、数据中心「实时付费」都是**本站本地接口**（韩梦凯、沈子晗本地机回传），**不是星脉 BI**。

全文：`docs/agents/00-local-paid.md`。相关对话框：`docs/agents/01-home.md`、`02-data-center.md`、`03-shen-zihan.md`、`04-han-mengkai.md`。

禁止把这四块改接星脉 BI。禁止用 `/api/home/erp-paid` 填付费列。禁止用空的 `/api/han/paid` 或空的 `/api/home/local-paid` 存根冒充已更新。

## 网页打不开

1. 先只告诉主脑：原因、要改哪些内容、建议修不修。不要先交单。
2. 主脑回「修复」后：改完立刻交单，并强制发版通过。不要等主脑去网站点「通过」。
3. 强制通过：登录后 `POST /api/releases/:id/confirm`。若闸门说必须先处理队首，驳回挡路的队首（写明是为打开站点），再强制通过打开站点这一单。
