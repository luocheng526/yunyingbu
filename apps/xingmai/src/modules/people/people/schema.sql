-- 人员管理花名册试点。auth.js 里的 people 表只建基础列。
-- 新列和新表由 store.ensurePeopleSchema 在 hydrate 时补齐，不改 auth.js。

ALTER TABLE people
  ADD COLUMN employee_no VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE people
  ADD COLUMN department VARCHAR(128) NOT NULL DEFAULT '';
ALTER TABLE people
  ADD COLUMN manager_id INT NULL;

CREATE TABLE IF NOT EXISTS people_shops (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  pack VARCHAR(64) NOT NULL DEFAULT '',
  bundle VARCHAR(64) NOT NULL DEFAULT '',
  demo TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS people_grants (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  shop_id INT NOT NULL,
  role VARCHAR(32) NOT NULL,
  start_on VARCHAR(16) NOT NULL DEFAULT '',
  end_on VARCHAR(16) NOT NULL DEFAULT '',
  revoked TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
