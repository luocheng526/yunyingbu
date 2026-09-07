process.env.TZ = process.env.TZ || "Asia/Shanghai";

import http from "node:http";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const app = createApp();
const server = http.createServer(app);

// Node 默认 keepAliveTimeout=5s。nginx 默认 keepalive 更长。
// 必须在 listen 之前设好：空闲后再点侧栏，nginx 会复用已断的上游连接，整页卡住约 5 秒。
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(port, host, () => {
  console.log(`mengkai server listening on http://${host}:${port}`);
});
