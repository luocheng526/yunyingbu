process.env.TZ = process.env.TZ || "Asia/Shanghai";

import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const app = createApp();

const server = app.listen(port, host, () => {
  console.log(`mengkai server listening on http://${host}:${port}`);
});

// Node 默认 keepAliveTimeout=5s。nginx 默认 keepalive 更长。
// 空闲超过 5 秒再点侧栏，复用连接会撞上已断开的 Node，整页卡住约 5 秒。
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
