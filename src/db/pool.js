import mysql from "mysql2/promise";

let pool;

/** Shared mysql2/promise pool. Do not create a second pool elsewhere. */
export function getPool() {
  if (pool) {
    return pool;
  }

  const host = process.env.MYSQL_HOST;
  if (!host) {
    throw new Error("MYSQL_HOST is not set");
  }

  pool = mysql.createPool({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4"
  });

  return pool;
}
