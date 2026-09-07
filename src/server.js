import { createApp } from "./app.js";
import { isMysqlConfigured, pingPool } from "./db/pool.js";
import { mysqlConfigFromEnv } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

async function start() {
  if (isMysqlConfigured()) {
    const target = mysqlConfigFromEnv();
    try {
      await pingPool();
      await runMigrations();
    } catch (err) {
      console.error("[mysql] 启动中止：无法使用 RDS。ECS 请用内网连 RDS，并把本机内网 IP 加白名单。", {
        MYSQL_HOST: target.host,
        MYSQL_PORT: target.port,
        MYSQL_DATABASE: target.database,
        code: err?.code || "",
        message: err?.message || String(err)
      });
      process.exit(1);
    }
  } else {
    console.warn("[mysql] 未配置 MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE，发版队列回退为内存，重启会丢失。");
  }

  const app = createApp();
  app.listen(port, host, () => {
    console.log(`mengkai server listening on http://${host}:${port}`);
  });
}

start().catch((err) => {
  console.error("[mysql] 启动失败", err?.message || err);
  process.exit(1);
});
