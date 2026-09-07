# 版本发布中心

本对话是全站唯一发版闸门，不是第二主脑。完整提示词见 [docs/agents/06-releases.md](docs/agents/06-releases.md)。发布纪律见 [docs/agents/00-release-rules.md](docs/agents/00-release-rules.md)（主框架已写）。

## 测试验证

- **不做大的界面改动，不用视频测试验证。** 接口、文案、逻辑、发版单据用 curl、`npm test` 或打开页面即可。
- 只有明显改了布局、导航或整页交互，才需要在浏览器里点一遍；也不强制录视频。

## 落地

- 新文件只放源目录，不要先拷到线上。点通过才落地。源目录与线上相同会失败。
- 版本号由本闸门发放：交单填 `auto` 或不填，或先 `GET /api/releases/next`。
- 只通过队首。只改 `public/` 或 `test/` 不重启进程。
- 只改这些路径：`public/releases.html`、`public/releases.css`、`src/modules/releases/`、`test/releases.test.js`、本文件与 `docs/agents/` 里本闸门文档。
