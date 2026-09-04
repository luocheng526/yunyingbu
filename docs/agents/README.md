# 运营部 Agent 分工

主脑只出任务稿。7 个业务 Agent **在 Cursor Cloud 工作**，代码目录 `apps/xingmai/`。不要再用 My Machines。流程见 [00-cloud-workflow.md](agents/00-cloud-workflow.md)，全员补丁 [00-cloud-patch.md](agents/00-cloud-patch.md)。

**发布纪律：** 只有「版本发布中心」可发版。其他 Agent 交付时必须输出 [发布文档](agents/00-release-doc-only.md)。主脑把文档交给发布中心并下令后才上线。补丁：[00-release-doc-patch.md](agents/00-release-doc-patch.md)、[06-releases-wait-for-owner.md](agents/06-releases-wait-for-owner.md)。

| Agent | 提示词文件 | 站点路径 | 只许改的目录 |
|-------|------------|----------|----------------|
| 首页 | [01-home.md](agents/01-home.md) | `/` | `apps/xingmai/public/index.html` `shared/` `src/modules/home/` |
| 数据中心 | [02-data-center.md](agents/02-data-center.md) | `/data` | `public/data.html` `src/modules/data/` |
| 沈子晗运营中心 | [03-shen-zihan.md](agents/03-shen-zihan.md) | `/shen` | `public/shen.html` `src/modules/shen/` |
| 韩梦凯运营中心 | [04-han-mengkai.md](agents/04-han-mengkai.md) | `/han` | `public/han.html` `src/modules/han/` |
| 人员管理 | [05-people.md](agents/05-people.md) | `/people` | `public/people.html` `src/modules/people/` |
| 版本发布中心 | [06-releases.md](agents/06-releases.md) | `/releases` | `public/releases.html` `src/modules/releases/` |
| 个人中心 | [07-profile.md](agents/07-profile.md) | `/me` | `public/me.html` `src/modules/profile/` （登录、改资料、改密码） |
