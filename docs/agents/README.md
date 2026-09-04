# 运营部 Agent 分工

主脑只出任务稿。7 个业务 Agent **在 Cursor Cloud 工作**，代码目录 `apps/xingmai/`。不要再用 My Machines。流程见 [00-cloud-workflow.md](agents/00-cloud-workflow.md)，全员补丁 [00-cloud-patch.md](agents/00-cloud-patch.md)。

**发布纪律：** 只有「版本发布中心」在主脑审核并点击「发布」后才能同步 ECS 并重启。

| Agent | 提示词文件 | 站点路径 | 只许改的目录 |
|-------|------------|----------|----------------|
| 首页 | [01-home.md](agents/01-home.md) | `/` | `public/index.html` `public/shared/` `src/modules/home/` |
| 数据中心 | [02-data-center.md](agents/02-data-center.md) | `/data` | `public/data.html` `src/modules/data/` |
| 沈子晗运营中心 | [03-shen-zihan.md](agents/03-shen-zihan.md) | `/shen` | `public/shen.html` `src/modules/shen/` |
| 韩梦凯运营中心 | [04-han-mengkai.md](agents/04-han-mengkai.md) | `/han` | `public/han.html` `src/modules/han/` |
| 人员管理 | [05-people.md](agents/05-people.md) | `/people` | `public/people.html` `src/modules/people/` |
| 版本发布中心 | [06-releases.md](agents/06-releases.md) | `/releases` | `public/releases.html` `src/modules/releases/` |
| 个人中心 | [07-profile.md](agents/07-profile.md) | `/me` | `public/me.html` `src/modules/profile/` （登录、改资料、改密码） |
