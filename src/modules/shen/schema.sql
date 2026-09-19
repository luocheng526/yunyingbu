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
  sub_account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  charged_at VARCHAR(40) NOT NULL DEFAULT '',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  channel VARCHAR(64) NOT NULL DEFAULT '',
  remark VARCHAR(200) NOT NULL DEFAULT '',
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  config_version INT UNSIGNED NOT NULL DEFAULT 0,
  rule_code VARCHAR(32) NOT NULL DEFAULT '',
  planned_roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  exec_spend DECIMAL(14,2) NOT NULL DEFAULT 0,
  exec_roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  exec_paid_orders INT NOT NULL DEFAULT 0,
  result_flag VARCHAR(32) NOT NULL DEFAULT '',
  execution_id VARCHAR(64) NULL DEFAULT NULL,
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shen_paid_recharge (store, day, charged_at, amount),
  UNIQUE KEY uk_shen_paid_recharge_exec (execution_id),
  KEY idx_shen_paid_recharge_store_day (store, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 当前启用店铺名单。页面默认只展示这些店，历史回传行不删。
-- 写入：POST /api/shen/paid/ingest 的 启用店铺 数组
CREATE TABLE IF NOT EXISTS shen_paid_enabled_store (
  store VARCHAR(64) NOT NULL PRIMARY KEY,
  source VARCHAR(64) NOT NULL DEFAULT 'local',
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 子账号明细，与店铺汇总分表。覆盖键：日期 + 京准通主账户ID + 子账号ID + 抓取时间
-- 写入：POST /api/shen/paid/ingest 的 子账号 数组
-- 读取：GET /api/shen/paid/subaccounts?store=
CREATE TABLE IF NOT EXISTS shen_paid_subaccount (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL,
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  day DATE NOT NULL,
  captured_at VARCHAR(40) NOT NULL DEFAULT '',
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
  UNIQUE KEY uk_shen_paid_subaccount (day, account_id, sub_account_id, captured_at),
  KEY idx_shen_paid_sub_store_day (store, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 充值规则：网站只配置，不发起京准通充值。本地机 GET /api/shen/paid/recharge-config 拉全量有效配置。
CREATE TABLE IF NOT EXISTS shen_paid_recharge_rule (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL,
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  shop_enabled TINYINT NOT NULL DEFAULT 1,
  auto_recharge TINYINT NOT NULL DEFAULT 1,
  planned_roi DECIMAL(12,4) NOT NULL DEFAULT 0,
  tier1_min DECIMAL(14,2) NOT NULL DEFAULT 1,
  tier1_max DECIMAL(14,2) NOT NULL DEFAULT 1000,
  tier1_balance DECIMAL(14,2) NOT NULL DEFAULT 100,
  tier1_amount DECIMAL(14,2) NOT NULL DEFAULT 100,
  tier2_min DECIMAL(14,2) NOT NULL DEFAULT 1000,
  tier2_balance DECIMAL(14,2) NOT NULL DEFAULT 50,
  tier2_amount DECIMAL(14,2) NOT NULL DEFAULT 150,
  roi_rise_amount DECIMAL(14,2) NOT NULL DEFAULT 100,
  no_order_times INT NOT NULL DEFAULT 3,
  pause_minutes INT NOT NULL DEFAULT 30,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  UNIQUE KEY uk_shen_paid_recharge_rule (store, account_id, sub_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shen_paid_recharge_rule_meta (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  change_summary VARCHAR(200) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shen_paid_recharge_rule_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  version INT UNSIGNED NOT NULL,
  store VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_id VARCHAR(64) NOT NULL DEFAULT '',
  field_name VARCHAR(64) NOT NULL,
  old_value VARCHAR(128) NOT NULL DEFAULT '',
  new_value VARCHAR(128) NOT NULL DEFAULT '',
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  change_summary VARCHAR(200) NOT NULL DEFAULT '',
  KEY idx_shen_rule_hist_store (store, sub_account_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shen_paid_store_owner (
  username VARCHAR(64) NOT NULL,
  store VARCHAR(64) NOT NULL,
  PRIMARY KEY (username, store)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shen_paid_recharge_machine (
  machine_id VARCHAR(64) NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  role VARCHAR(64) NOT NULL DEFAULT '',
  data_scope VARCHAR(64) NOT NULL DEFAULT '',
  last_version INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT '',
  message VARCHAR(200) NOT NULL DEFAULT '',
  received_at VARCHAR(40) NOT NULL DEFAULT '',
  synced_at VARCHAR(40) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 工作机运行店铺。未写过任何行时，本地机仍拉权限范围内全部店（默认已开启）。
-- 保存后只把已开启的店放进 runShops。空名单表示工作机在线待机。
-- 执行机为空表示任意已绑定机都可跑；填了 machineId 则只有该机跑。
-- stopping_since：从已开启改为停止时记下版本号，ACK 前页面显示停止中。
CREATE TABLE IF NOT EXISTS shen_paid_recharge_shop_run (
  store VARCHAR(64) NOT NULL PRIMARY KEY,
  run_enabled TINYINT NOT NULL DEFAULT 0,
  machine_id VARCHAR(64) NOT NULL DEFAULT '',
  stopping_since INT UNSIGNED NOT NULL DEFAULT 0,
  account_id VARCHAR(64) NOT NULL DEFAULT '',
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 店铺 / 子账号主档。网站是唯一主档，本地 Excel 只作迁移备份。软删除，不删历史采集和充值。
-- 店铺唯一键：京准通主账户ID。子账号唯一键：主账户ID + 子账号ID。ID 一律字符串。
CREATE TABLE IF NOT EXISTS shen_paid_shop_master (
  account_id VARCHAR(64) NOT NULL PRIMARY KEY,
  store VARCHAR(64) NOT NULL,
  machine_id VARCHAR(64) NOT NULL DEFAULT '',
  deleted TINYINT NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shen_paid_sub_master (
  account_id VARCHAR(64) NOT NULL,
  sub_account_id VARCHAR(64) NOT NULL,
  store VARCHAR(64) NOT NULL DEFAULT '',
  sub_account_name VARCHAR(128) NOT NULL DEFAULT '',
  deleted TINYINT NOT NULL DEFAULT 0,
  updated_by VARCHAR(64) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL DEFAULT '',
  PRIMARY KEY (account_id, sub_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 本地机回报的 Cookie 状态和心跳。网站不接收、不保存 Cookie 正文。
CREATE TABLE IF NOT EXISTS shen_paid_shop_status (
  account_id VARCHAR(64) NOT NULL PRIMARY KEY,
  machine_id VARCHAR(64) NOT NULL DEFAULT '',
  jzt_cookie_status VARCHAR(16) NOT NULL DEFAULT '待录',
  jzt_cookie_updated_at VARCHAR(40) NOT NULL DEFAULT '',
  jm_cookie_status VARCHAR(16) NOT NULL DEFAULT '待录',
  jm_cookie_updated_at VARCHAR(40) NOT NULL DEFAULT '',
  run_status VARCHAR(16) NOT NULL DEFAULT '已停止',
  last_error VARCHAR(200) NOT NULL DEFAULT '',
  heartbeat_at VARCHAR(40) NOT NULL DEFAULT '',
  worker_status VARCHAR(16) NOT NULL DEFAULT '',
  config_version INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
