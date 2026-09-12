-- 店铺主数据落库时用。本仓库演示数据在内存里，导入同样按这两列做联合唯一。
-- UNIQUE(group_id, shop_id)：同一小组同一店铺ID只能有一条。

CREATE TABLE IF NOT EXISTS org_stores (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  shop_id VARCHAR(64) NOT NULL DEFAULT '',
  store_name VARCHAR(191) NOT NULL,
  merchant_id VARCHAR(64) NOT NULL DEFAULT '',
  director VARCHAR(64) NOT NULL DEFAULT '',
  manager VARCHAR(64) NOT NULL DEFAULT '',
  supervisor VARCHAR(64) NOT NULL DEFAULT '',
  operator VARCHAR(64) NOT NULL DEFAULT '',
  assistant VARCHAR(64) NOT NULL DEFAULT '',
  remark VARCHAR(64) NOT NULL DEFAULT '运营中',
  updated_on VARCHAR(32) NOT NULL DEFAULT '',
  closed_on VARCHAR(32) NOT NULL DEFAULT '',
  login VARCHAR(64) NOT NULL DEFAULT '',
  password VARCHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE org_stores
  ADD UNIQUE KEY uk_org_stores_group_shop (group_id, shop_id);
