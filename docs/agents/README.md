# 运营部 Agent 分工

主脑只出任务稿，不直接改 `zx.xingmaierp.cc`。下面每个文件是一份完整提示词：在 Cursor 新建 **独立 Agent / 独立对话**，把对应文件全文粘贴即可。

建议粘贴顺序：先「首页」，再「版本发布中心」（审核队列与发布锁），再并行其余模块。

**发布纪律：** 只有「版本发布中心」在主脑审核并点击「发布」后才能上线。其余 Agent 禁止自行 `systemctl restart`。补丁提示词：[00-no-self-deploy.md](agents/00-no-self-deploy.md)。

| Agent | 提示词文件 | 站点路径 | 只许改的目录 |
|-------|------------|----------|----------------|
| 首页 | [01-home.md](agents/01-home.md) | `/` | `public/index.html` `public/shared/` `src/modules/home/` |
| 数据中心 | [02-data-center.md](agents/02-data-center.md) | `/data` | `public/data.html` `src/modules/data/` |
| 沈子晗运营中心 | [03-shen-zihan.md](agents/03-shen-zihan.md) | `/shen` | `public/shen.html` `src/modules/shen/` |
| 韩梦凯运营中心 | [04-han-mengkai.md](agents/04-han-mengkai.md) | `/han` | `public/han.html` `src/modules/han/` |
| 人员管理 | [05-people.md](agents/05-people.md) | `/people` | `public/people.html` `src/modules/people/` |
| 版本发布中心 | [06-releases.md](agents/06-releases.md) | `/releases` | `public/releases.html` `src/modules/releases/` |
| 个人中心 | [07-profile.md](agents/07-profile.md) | `/me` | `public/me.html` `src/modules/profile/` |
