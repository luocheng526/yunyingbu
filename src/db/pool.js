import mysql from "mysql2/promise";

let pool = null;

export function mysqlConfigFromEnv(env = process.env) {
  return {
    host: String(env.MYSQL_HOST || "").trim(),
    port: Number(env.MYSQL_PORT || 3306),
    user: String(env.MYSQL_USER || "").trim(),
    database: String(env.MYSQL_DATABASE || "").trim(),
    charset: "utf8mb4"
  };
}

export function isMysqlConfigured(env = process.env) {
  const cfg = mysqlConfigFromEnv(env);
  return Boolean(cfg.host && cfg.user && cfg.database);
}

function publicMysqlTarget(env = process.env) {
  const cfg = mysqlConfigFromEnv(env);
  return {
    MYSQL_HOST: cfg.host || "(unset)",
    MYSQL_PORT: cfg.port,
    MYSQL_USER: cfg.user || "(unset)",
    MYSQL_DATABASE: cfg.database || "(unset)",
    charset: "utf8mb4"
  };
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
    enableKeepAlive: true
  });
  return pool;
}

export async function pingPool(env = process.env) {
  const target = publicMysqlTarget(env);
  try {
    const [rows] = await getPool(env).query("SELECT 1 AS ok");
    const ok = Array.isArray(rows) && rows[0] && Number(rows[0].ok) === 1;
    if (!ok) {
      throw new Error("SELECT 1 未返回 ok=1");
    }
    console.info("[mysql] ping ok", target);
    return target;
  } catch (err) {
    const code = err && err.code ? String(err.code) : "";
    const message = err && err.message ? String(err.message) : String(err);
    console.error("[mysql] 连接失败", {
      ...target,
      code,
      message,
      hint: "请在 ECS 上核对本机内网 IP 是否已加入 RDS 白名单，并确认 MYSQL_HOST 使用 RDS 内网地址而非公网。"
    });
    throw err;
  }
}

export async function closePool() {
  if (!pool) {
    return;
  }
  await pool.end();
  pool = null;
}
