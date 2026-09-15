-- 沈子晗运营中心内部表。其他智能体不要直连、不要 SELECT 这些表。
-- 对外只读入口：GET /api/shen/summary?store=&from=&to=
-- 线上简报表名是 shen_brief（单数），与 notes-store 水合一致。

CREATE TABLE IF NOT EXISTS shen_tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT '待办',
  owner VARCHAR(64) NOT NULL DEFAULT '沈子晗',
  store VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shen_tasks_store_created (store, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shen_brief (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  text MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO shen_brief (id, text) VALUES (1, '');

-- 付费中心：本地程序跑完后回传。其他智能体不要直连本表。
-- 写入：POST /api/shen/paid/ingest
-- 读取：GET /api/shen/paid 、 GET /api/shen/paid/summary
CREATE TABLE IF NOT EXISTS shen_paid_daily (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  seq INT UNSIGNED NOT NULL DEFAULT 0,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_orders INT NOT NULL DEFAULT 0,
  roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  cvr DECIMAL(12,4) NOT NULL DEFAULT 0,
  cpc DECIMAL(14,4) NOT NULL DEFAULT 0,
  jingmai_gmv DECIMAL(14,2) NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  ctr DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  real_fee_ratio DECIMAL(12,4) NOT NULL DEFAULT 0,
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_daily (store, day),
  KEY idx_shen_paid_daily_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
