-- 店铺维护中心自有表。由 store.ensureStoresSchema 在首次访问时补齐，
-- 不写入人员 / 沈 / 韩 / 数据中心的库表。

CREATE TABLE IF NOT EXISTS stores_archives (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  shop_code VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL,
  owner VARCHAR(64) NOT NULL DEFAULT '',
  pack VARCHAR(64) NOT NULL DEFAULT '',
  note VARCHAR(500) NOT NULL DEFAULT '',
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stores_records (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  happened_on VARCHAR(16) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  operator VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  INDEX idx_stores_records_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
