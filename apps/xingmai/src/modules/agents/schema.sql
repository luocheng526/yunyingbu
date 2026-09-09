-- 甄选智能体问答台。表由 store.ensureAgentsSchema 在首次请求时补齐，不改 auth.js、不写人员/沈/韩表。

CREATE TABLE IF NOT EXISTS agents_sessions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  model_id VARCHAR(64) NOT NULL,
  title VARCHAR(128) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agents_messages (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  role VARCHAR(16) NOT NULL,
  text TEXT NOT NULL,
  file_ids VARCHAR(255) NOT NULL DEFAULT '[]',
  model_id VARCHAR(64) NOT NULL DEFAULT '',
  sources VARCHAR(255) NOT NULL DEFAULT '[]',
  created_at VARCHAR(32) NOT NULL,
  KEY session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agents_uploads (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime VARCHAR(128) NOT NULL,
  size INT NOT NULL,
  content LONGBLOB NOT NULL,
  created_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
