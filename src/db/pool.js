import mysql from "mysql2/promise";

let pool;

function requiredEnv(name) {
  const value = process.env[name];
  if (value == null || String(value).trim() === "") {
    const error = new Error(`缺少环境变量 ${name}`);
    error.statusCode = 503;
    throw error;
  }
  return value;
}

/** Shared mysql2/promise pool. Do not create a second pool elsewhere. */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: requiredEnv("MYSQL_HOST"),
      port: Number(process.env.MYSQL_PORT || 3306),
      user: requiredEnv("MYSQL_USER"),
      password: process.env.MYSQL_PASSWORD ?? "",
      database: requiredEnv("MYSQL_DATABASE"),
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return pool;
}
