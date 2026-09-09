-- 甄选智能体工作台。表由 store.ensureAgentsSchema 在首次请求时补齐，不改 auth.js。

CREATE TABLE IF NOT EXISTS agents_threads (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  agent_id VARCHAR(32) NOT NULL,
  title VARCHAR(128) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agents_messages (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  thread_id INT NOT NULL,
  role VARCHAR(16) NOT NULL,
  text TEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  KEY thread_id (thread_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
