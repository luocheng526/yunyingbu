process.env.TZ = process.env.TZ || "Asia/Shanghai";

import http from "node:http";
import { createApp } from "./app.js";
import { ensureFrameworkTrees } from "./boot-dirs.js";
import { startMysql } from "./notes-store.js";

const dirTrees = ensureFrameworkTrees();
for (const tree of dirTrees) {
  if (tree.created.length) {
    console.log(`主框架已建目录 ${tree.root}: ${tree.created.join("、")}`);
  }
  for (const miss of tree.skipped) {
    console.error(`主框架目录未建齐 ${tree.root}/${miss.rel}: ${miss.error}`);
  }
}

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const app = createApp();
const server = http.createServer(app);

// Node 默认 keepAliveTimeout=5s。nginx 默认 keepalive 更长。
// 必须在 listen 之前设好：空闲后再点侧栏，nginx 会复用已断的上游连接，整页卡住约 5 秒。
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function listen() {
  server.listen(port, host, () => {
    console.log(`mengkai server listening on http://${host}:${port}`);
  });
}

const skipMysql = String(process.env.XM_DB || "").toLowerCase() === "memory";
const requireMysql = String(process.env.XM_REQUIRE_MYSQL || "") === "1";
const boot = skipMysql ? Promise.resolve() : startMysql();
boot.then(listen).catch((err) => {
  console.error("MySQL 启动失败。请配置 MYSQL_HOST/USER/PASSWORD/DATABASE 并启动 MySQL。", err);
  if (requireMysql) {
    process.exit(1);
  }
  console.error("本次先用内存启动。配好库后重启即落库。");
  listen();
});
