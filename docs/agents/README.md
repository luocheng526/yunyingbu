# 运营部 Agent 分工

主脑只出任务稿。7 个业务 Agent **在 Cursor Cloud 工作**，代码目录 `apps/xingmai/`。不要再用 My Machines。流程见 [00-cloud-workflow.md](agents/00-cloud-workflow.md)，全员补丁 [00-cloud-patch.md](agents/00-cloud-patch.md)。

**发布纪律（现行）：** [00-release-rules.md](00-release-rules.md)。全站一条号 `0.1.N`，交单前 `GET /api/releases/next`，`POST /api/releases` 按提交时间排队，禁止上移下移，只等网页第 1 位「通过」。**做完直接交单**（含图形改动），不要等用户再单独说「提交」（见仓库根目录 `AGENTS.md`）。只有版本发布中心能落地。补丁：[00-release-doc-only.md](00-release-doc-only.md)、[00-release-doc-patch.md](00-release-doc-patch.md)。全站外观由首页壳控制，侧栏内容跟壳同一套浅色/暗色。

| Agent | 提示词文件 | 站点路径 | 只许改的目录 |
|-------|------------|----------|----------------|
| 首页 | [01-home.md](agents/01-home.md) | `/` | `apps/xingmai/public/index.html` `shared/` `src/modules/home/` |
| 数据中心 | [02-data-center.md](agents/02-data-center.md) | `/data` | `public/data.html` `src/modules/data/` |
| 沈子晗运营中心 | [03-shen-zihan.md](agents/03-shen-zihan.md) | `/shen` | `public/shen.html` `src/modules/shen/` |
| 韩梦凯运营中心 | [04-han-mengkai.md](agents/04-han-mengkai.md) | `/han` | `public/han.html` `src/modules/han/` |
| 人员管理 | [05-people.md](agents/05-people.md) | `/people` | `public/people.html` `src/modules/people/` |
| 版本发布中心 | [06-releases.md](agents/06-releases.md) | `/releases` | `public/releases.html` `src/modules/releases/` |
| 个人中心 | [07-profile.md](agents/07-profile.md) | `/me` | `public/me.html` `src/modules/profile/` （登录、改资料、改密码） |
