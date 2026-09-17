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
  success_flag VARCHAR(16) NOT NULL DEFAULT '',
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_daily (store, day),
  KEY idx_shen_paid_daily_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 店铺下钻：循环抓取之外的充值流水。写入可跟付费回传一起带 充值记录，或单独 POST /api/shen/paid/recharge/ingest
CREATE TABLE IF NOT EXISTS shen_paid_recharge (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  charged_at VARCHAR(40) NOT NULL DEFAULT '',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  channel VARCHAR(64) NOT NULL DEFAULT '',
  remark VARCHAR(200) NOT NULL DEFAULT '',
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_recharge (store, day, charged_at, amount),
  KEY idx_shen_paid_recharge_store_day (store, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 子账号明细，与店铺汇总分表。覆盖键：日期 + 京准通主账户ID + 子账号ID
-- 写入：POST /api/shen/paid/ingest 的 子账号 数组
-- 读取：GET /api/shen/paid/subaccounts?store=
CREATE TABLE IF NOT EXISTS shen_paid_subaccount (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL,
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  remark VARCHAR(200) NOT NULL DEFAULT '',
  spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  paid_orders INT NOT NULL DEFAULT 0,
  total_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  impressions INT NOT NULL DEFAULT 0,
  ctr DECIMAL(12,4) NOT NULL DEFAULT 0,
  cpc DECIMAL(14,4) NOT NULL DEFAULT 0,
  cpm DECIMAL(14,4) NOT NULL DEFAULT 0,
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_subaccount (day, account_id, sub_account_id),
  KEY idx_shen_paid_sub_store_day (store, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
