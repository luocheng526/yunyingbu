# 运营部仓库约定

站点代码在 `apps/xingmai/`（生产 `/opt/mengkai`）。板块分工和发版闸门见 `docs/agents/`。

## 非图形改动：做完直接交单

导航、接口、会话、中间件、测试等**非图形**改动，自测通过后立刻：

1. `GET /api/releases/next` 领全站下一个 `0.1.N`
2. `POST /api/releases` 入队（`contents` 为路径→正文；`files` 只写路径字符串）
3. 告知单据号，等 `https://zx.xingmaierp.cc/releases` 第 1 位「通过」

**不要等用户再单独说「提交」「交单」「发布」。** 图形 / 布局 / 视觉改动按当次口令；用户明确说提交时再交。

纪律全文：`docs/agents/00-release-rules.md`。禁止 SSH、禁止自己上 ECS、禁止自己点通过。
