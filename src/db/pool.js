import mysql from "mysql2/promise";

let pool = null;

export function mysqlConfigFromEnv(env = process.env) {
  return {
    host: String(env.MYSQL_HOST || "").trim(),
    port: Number(env.MYSQL_PORT || 3306),
    user: String(env.MYSQL_USER || "").trim(),
    database: String(env.MYSQL_DATABASE || "").trim(),
    charset: "utf8mb4",
  };
}

export function isMysqlConfigured(env = process.env) {
  const cfg = mysqlConfigFromEnv(env);
  return Boolean(cfg.host && cfg.user && cfg.database);
}

export function getPool(env = process.env) {
  if (pool) {
    return pool;
  }
  if (!isMysqlConfigured(env)) {
    const err = new Error("MYSQL_HOST / MYSQL_USER / MYSQL_DATABASE 未配置，无法创建连接池");
    err.code = "MYSQL_NOT_CONFIGURED";
    throw err;
  }
  const cfg = mysqlConfigFromEnv(env);
  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: env.MYSQL_PASSWORD ?? "",
    database: cfg.database,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: Number(env.MYSQL_POOL_SIZE || 10),
    enableKeepAlive: true,
  });
  return pool;
}

export async function closePool() {
  if (!pool) {
    return;
  }
  await pool.end();
  pool = null;
}
