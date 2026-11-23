-- Additive and idempotent migration. Existing tasks, files and daily reports remain intact.
-- Runtime center-db.js applies the same schema lazily in MySQL mode.
CREATE TABLE IF NOT EXISTS work_center_migrations (
  id VARCHAR(80) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_center_record (
  id VARCHAR(120) PRIMARY KEY,
  kind VARCHAR(24) NOT NULL,
  revision INT NOT NULL,
  body MEDIUMTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX work_center_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO work_center_migrations (id) VALUES ('20261123-work-center-v2');
