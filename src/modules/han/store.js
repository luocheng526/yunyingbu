import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool } from "../../db/pool.js";
import {
  PRODUCT_LAYERS,
  classifyProduct,
  classifyRuleHints,
  defaultClassifyRules,
  mergeClassifyRules,
  normalizeProductLayer,
} from "./classify.js";
import { parseOverviewWorkbook } from "./import-file.js";

export {
  classifyProduct,
  defaultClassifyRules,
  mergeClassifyRules,
  classifyRuleHints,
  normalizeProductLayer,
} from "./classify.js";

const DEFAULT_OWNER = "韩梦凯";
const DEFAULT_STORE = "韩梦凯店";
const STATUSES = ["待办", "进行中", "已完成"];
const SELECTION_STATUSES = ["观察", "入选", "淘汰"];
const PICK_BOARDS = ["trend", "peers", "new"];
const TRAINING_STATUSES = ["待开始", "进行中", "已完成"];

function normalizeProductTeam(team) {
  const text = String(team || "").trim();
  return PRODUCT_TEAMS.includes(text) ? text : "";
}
const PRODUCT_LAYER_COLUMNS = [
  ["layer", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["image_url", "VARCHAR(1024) NOT NULL DEFAULT ''"],
  ["spu", "VARCHAR(128) NOT NULL DEFAULT ''"],
  ["first_sku", "VARCHAR(128) NOT NULL DEFAULT ''"],
  ["hot_sell", "VARCHAR(256) NOT NULL DEFAULT ''"],
  ["review_count", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["share_count", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["qa_video", "VARCHAR(128) NOT NULL DEFAULT ''"],
  ["return_m5", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["return_m6", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["return_m7", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["return_m8", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["orders_30d", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["fulfill_note", "VARCHAR(256) NOT NULL DEFAULT ''"],
  ["jd_stock", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["listed_on", "DATE NULL"],
  ["has_new_badge", "VARCHAR(32) NOT NULL DEFAULT ''"],
  ["need_order", "VARCHAR(256) NOT NULL DEFAULT ''"],
  ["remark", "VARCHAR(1024) NOT NULL DEFAULT ''"],
  ["team_name", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["spend_rate", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["gmv_7d", "VARCHAR(64) NOT NULL DEFAULT ''"],
  ["conv_rate", "VARCHAR(64) NOT NULL DEFAULT ''"],
];
const PRODUCT_TEAMS = ["陈晓曼组", "高明阳组", "毛永超组", "段坤孝组", "薛双双组", "韩梦凯组"];
const GROUP_LEADS = ["陈晓曼", "高明阳", "毛永超", "段坤孝", "薛双双"];
const PRODUCT_SELECT =
  "id, name, sku, price, stock, owner, store_name, layer, image_url, spu, first_sku, hot_sell, review_count, share_count, qa_video, return_m5, return_m6, return_m7, return_m8, orders_30d, fulfill_note, jd_stock, listed_on, has_new_badge, need_order, remark, team_name, spend_rate, gmv_7d, conv_rate, created_at";
const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

function toIso(value) {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function toDateOnly(value) {
  if (!value) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  return text.slice(0, 10);
}

function ownerOrDefault(owner) {
  return owner && String(owner).trim() ? String(owner).trim() : DEFAULT_OWNER;
}

function storeOrDefault(store) {
  return store && String(store).trim() ? String(store).trim() : DEFAULT_STORE;
}

function requireShopKey({ team, store } = {}) {
  const teamName = normalizeProductTeam(team);
  const shop = String(store || "").trim();
  if (!shop) {
    const err = new Error("store required");
    err.statusCode = 400;
    throw err;
  }
  return { teamName, shop };
}

function parsePlanItems(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item, i) => ({
        id: String(item?.id || i + 1),
        text: String(item?.text || "").trim(),
        done: Boolean(item?.done),
      }))
      .filter((item) => item.text);
  }
  const text = raw == null ? "" : String(raw).trim();
  if (!text) {
    return [];
  }
  try {
    return parsePlanItems(JSON.parse(text));
  } catch {
    return text.split(/\r?\n/).map((line, i) => ({ id: String(i + 1), text: line.trim(), done: false })).filter((item) => item.text);
  }
}

function serializePlanItems(items) {
  return JSON.stringify(parsePlanItems(items));
}

function nextDay(yyyyMmDd) {
  const d = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function mapTask(row) {
  return {
    id: String(row.id),
    title: row.title,
    status: row.status,
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function mapSelection(row) {
  return {
    id: String(row.id),
    name: row.name,
    category: row.category || "",
    note: row.note || "",
    status: row.status,
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function normalizePickBoard(board) {
  const key = String(board || "").trim();
  return PICK_BOARDS.includes(key) ? key : "";
}

function mapPick(row) {
  return {
    id: String(row.id),
    board: row.board,
    name: row.name,
    extra: row.extra || "",
    category: row.category || "",
    note: row.note || "",
    status: row.status,
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function mapProduct(row) {
  return {
    id: String(row.id),
    name: row.name,
    sku: row.sku || row.first_sku || "",
    price: row.price == null ? "" : String(row.price),
    stock: row.stock == null ? "" : String(row.stock),
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    layer: normalizeProductLayer(row.layer),
    image: row.image_url || "",
    spu: row.spu || "",
    firstSku: row.first_sku || row.sku || "",
    hotSell: row.hot_sell || "",
    reviewCount: row.review_count || "",
    shareCount: row.share_count || "",
    qaVideo: row.qa_video || "",
    returnM5: row.return_m5 || "",
    returnM6: row.return_m6 || "",
    returnM7: row.return_m7 || "",
    returnM8: row.return_m8 || "",
    orders30d: row.orders_30d || "",
    fulfillNote: row.fulfill_note || "",
    jdStock: row.jd_stock || "",
    listedOn: toDateOnly(row.listed_on),
    hasNewBadge: row.has_new_badge || "",
    needOrder: row.need_order || "",
    remark: row.remark || "",
    team: row.team_name || "",
    spendRate: row.spend_rate || "",
    gmv7d: row.gmv_7d || "",
    convRate: row.conv_rate || "",
    createdAt: toIso(row.created_at),
  };
}

function mapPaid(row) {
  return {
    id: String(row.id),
    channel: row.channel,
    amount: row.amount == null ? "" : String(row.amount),
    spentOn: toDateOnly(row.spent_on),
    note: row.note || "",
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function mapTraining(row) {
  return {
    id: String(row.id),
    title: row.title,
    trainee: row.trainee || "",
    scheduledOn: toDateOnly(row.scheduled_on),
    status: row.status,
    note: row.note || "",
    owner: row.owner,
    store: row.store_name || DEFAULT_STORE,
    createdAt: toIso(row.created_at),
  };
}

function optionalNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalDate(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function requireStoreRange({ store, from, to }) {
  const shop = String(store || "").trim();
  const start = optionalDate(from);
  const end = optionalDate(to);
  if (!shop) {
    const err = new Error("store required");
    err.statusCode = 400;
    throw err;
  }
  if (!start || !end) {
    const err = new Error("from and to required (YYYY-MM-DD)");
    err.statusCode = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error("from must be on or before to");
    err.statusCode = 400;
    throw err;
  }
  return { shop, start, end, until: nextDay(end) };
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

export function createHanStore(poolOrFactory = getPool) {
  const db = () => (typeof poolOrFactory === "function" ? poolOrFactory() : poolOrFactory);
  let ready = null;

  async function ensure() {
    if (!ready) {
      ready = (async () => {
        const sql = await readFile(SCHEMA_PATH, "utf8");
        const pool = db();
        for (const stmt of splitSql(sql)) {
          await pool.query(stmt);
        }
        for (const table of ["han_tasks", "han_selection", "han_products", "han_paid", "han_training"]) {
          try {
            await pool.query(
              `ALTER TABLE ${table} ADD COLUMN store_name VARCHAR(128) NOT NULL DEFAULT '韩梦凯店'`,
            );
          } catch (err) {
            if (!err || (err.code !== "ER_DUP_FIELDNAME" && err.errno !== 1060)) {
              throw err;
            }
          }
        }
        for (const [col, spec] of PRODUCT_LAYER_COLUMNS) {
          try {
            await pool.query(`ALTER TABLE han_products ADD COLUMN ${col} ${spec}`);
          } catch (err) {
            if (!err || (err.code !== "ER_DUP_FIELDNAME" && err.errno !== 1060)) {
              throw err;
            }
          }
        }
        for (const stmt of [
          "CREATE TABLE IF NOT EXISTS han_shop_rules (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, team_name VARCHAR(64) NOT NULL, store_name VARCHAR(128) NOT NULL, rules_json MEDIUMTEXT NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (id), UNIQUE KEY uk_han_shop_rules (team_name, store_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
          "CREATE TABLE IF NOT EXISTS han_shop_plans (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, team_name VARCHAR(64) NOT NULL, store_name VARCHAR(128) NOT NULL, month_plan MEDIUMTEXT NOT NULL, week_plan MEDIUMTEXT NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (id), UNIQUE KEY uk_han_shop_plans (team_name, store_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
          "CREATE TABLE IF NOT EXISTS han_picks (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, board VARCHAR(32) NOT NULL, name VARCHAR(512) NOT NULL, extra VARCHAR(256) NOT NULL DEFAULT '', category VARCHAR(128) NOT NULL DEFAULT '', note VARCHAR(1024) NOT NULL DEFAULT '', status VARCHAR(32) NOT NULL DEFAULT '观察', owner VARCHAR(64) NOT NULL DEFAULT '韩梦凯', store_name VARCHAR(128) NOT NULL DEFAULT '韩梦凯店', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        ]) {
          try {
            await pool.query(stmt);
          } catch (err) {
            if (!err || (err.code !== "ER_TABLE_EXISTS_ERROR" && err.errno !== 1050)) {
              throw err;
            }
          }
        }
      })();
    }
    try {
      await ready;
    } catch (err) {
      ready = null;
      throw err;
    }
  }

  return {
    async listTasks() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, title, status, owner, store_name, created_at FROM han_tasks ORDER BY id ASC",
      );
      return rows.map(mapTask);
    },

    async createTask({ title, status, owner, store } = {}) {
      await ensure();
      const trimmed = String(title || "").trim();
      if (!trimmed) {
        const err = new Error("title required");
        err.statusCode = 400;
        throw err;
      }
      const st = STATUSES.includes(status) ? status : "待办";
      const ow = owner && String(owner).trim() ? String(owner).trim() : DEFAULT_OWNER;
      const [result] = await db().query(
        "INSERT INTO han_tasks (title, status, owner, store_name) VALUES (?, ?, ?, ?)",
        [trimmed, st, ow, storeOrDefault(store)],
      );
      const [rows] = await db().query(
        "SELECT id, title, status, owner, store_name, created_at FROM han_tasks WHERE id = ?",
        [result.insertId],
      );
      return mapTask(rows[0]);
    },

    async getBrief() {
      await ensure();
      const [rows] = await db().query("SELECT text FROM han_brief WHERE id = 1");
      return { text: rows[0] ? String(rows[0].text ?? "") : "" };
    },

    async setBrief({ text } = {}) {
      await ensure();
      const value = text == null ? "" : String(text);
      await db().query(
        "INSERT INTO han_brief (id, text) VALUES (1, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)",
        [value],
      );
      return { text: value };
    },

    async listSelection() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, name, category, note, status, owner, store_name, created_at FROM han_selection ORDER BY id ASC",
      );
      return rows.map(mapSelection);
    },

    async createSelection({ name, category, note, status, owner, store } = {}) {
      await ensure();
      const trimmed = String(name || "").trim();
      if (!trimmed) {
        const err = new Error("name required");
        err.statusCode = 400;
        throw err;
      }
      const st = SELECTION_STATUSES.includes(status) ? status : "观察";
      const [result] = await db().query(
        "INSERT INTO han_selection (name, category, note, status, owner, store_name) VALUES (?, ?, ?, ?, ?, ?)",
        [trimmed, String(category || "").trim(), String(note || "").trim(), st, ownerOrDefault(owner), storeOrDefault(store)],
      );
      const [rows] = await db().query(
        "SELECT id, name, category, note, status, owner, store_name, created_at FROM han_selection WHERE id = ?",
        [result.insertId],
      );
      return mapSelection(rows[0]);
    },

    async listPicks({ board } = {}) {
      await ensure();
      const key = normalizePickBoard(board);
      if (!key) {
        const err = new Error("board required");
        err.statusCode = 400;
        throw err;
      }
      const [rows] = await db().query(
        "SELECT id, board, name, extra, category, note, status, owner, store_name, created_at FROM han_picks ORDER BY id ASC",
      );
      return rows.map(mapPick).filter((row) => row.board === key);
    },

    async createPick({ board, name, extra, category, note, status, owner, store } = {}) {
      await ensure();
      const key = normalizePickBoard(board);
      if (!key) {
        const err = new Error("unknown board");
        err.statusCode = 400;
        throw err;
      }
      const trimmed = String(name || "").trim();
      if (!trimmed) {
        const err = new Error("name required");
        err.statusCode = 400;
        throw err;
      }
      const st = SELECTION_STATUSES.includes(status) ? status : "观察";
      const [result] = await db().query(
        "INSERT INTO han_picks (board, name, extra, category, note, status, owner, store_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          key,
          trimmed,
          String(extra || "").trim(),
          String(category || "").trim(),
          String(note || "").trim(),
          st,
          ownerOrDefault(owner),
          storeOrDefault(store),
        ],
      );
      const [rows] = await db().query(
        "SELECT id, board, name, extra, category, note, status, owner, store_name, created_at FROM han_picks WHERE id = ?",
        [result.insertId],
      );
      return mapPick(rows[0]);
    },

    async listProducts({ team, store } = {}) {
      await ensure();
      const [rows] = await db().query(`SELECT ${PRODUCT_SELECT} FROM han_products ORDER BY id ASC`);
      let mapped = rows.map(mapProduct);
      const teamName = normalizeProductTeam(team);
      const shop = String(store || "").trim();
      if (teamName) {
        mapped = mapped.filter((row) => row.team === teamName);
      }
      if (shop) {
        mapped = mapped.filter((row) => row.store === shop);
      }
      return mapped;
    },

    async listShops({ team } = {}) {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, team_name, store_name, created_at FROM han_team_shops ORDER BY id ASC",
      );
      const items = rows.map((row) => ({
        id: String(row.id),
        team: row.team_name,
        store: row.store_name,
        createdAt: toIso(row.created_at),
      }));
      const teamName = normalizeProductTeam(team);
      return teamName ? items.filter((row) => row.team === teamName) : items;
    },

    async createShop({ team, store } = {}) {
      await ensure();
      const teamName = normalizeProductTeam(team);
      const shop = String(store || "").trim();
      if (!teamName) {
        const err = new Error("team required");
        err.statusCode = 400;
        throw err;
      }
      if (!shop) {
        const err = new Error("store required");
        err.statusCode = 400;
        throw err;
      }
      const existing = await this.listShops({ team: teamName });
      if (existing.some((row) => row.store === shop)) {
        const err = new Error("store already exists");
        err.statusCode = 409;
        throw err;
      }
      const [result] = await db().query(
        "INSERT INTO han_team_shops (team_name, store_name) VALUES (?, ?)",
        [teamName, shop],
      );
      const [rows] = await db().query(
        "SELECT id, team_name, store_name, created_at FROM han_team_shops WHERE id = ?",
        [result.insertId],
      );
      return {
        id: String(rows[0].id),
        team: rows[0].team_name,
        store: rows[0].store_name,
        createdAt: toIso(rows[0].created_at),
      };
    },

    async getShopRules({ team, store } = {}) {
      await ensure();
      const teamName = normalizeProductTeam(team);
      const shop = String(store || "").trim();
      if (!shop) {
        const err = new Error("store required");
        err.statusCode = 400;
        throw err;
      }
      const [rows] = await db().query(
        "SELECT id, team_name, store_name, rules_json, updated_at FROM han_shop_rules WHERE team_name = ? AND store_name = ?",
        [teamName, shop],
      );
      if (!rows.length) {
        const rules = defaultClassifyRules();
        return {
          team: teamName,
          store: shop,
          custom: false,
          rules,
          hints: classifyRuleHints(rules),
        };
      }
      let parsed = {};
      try {
        parsed = JSON.parse(rows[0].rules_json || "{}");
      } catch {
        parsed = {};
      }
      const rules = mergeClassifyRules(defaultClassifyRules(), parsed);
      return {
        team: teamName,
        store: shop,
        custom: true,
        rules,
        hints: classifyRuleHints(rules),
        updatedAt: toIso(rows[0].updated_at),
      };
    },

    async saveShopRules({ team, store, rules } = {}) {
      await ensure();
      const teamName = normalizeProductTeam(team);
      const shop = String(store || "").trim();
      if (!shop) {
        const err = new Error("store required");
        err.statusCode = 400;
        throw err;
      }
      const merged = mergeClassifyRules(defaultClassifyRules(), rules);
      const json = JSON.stringify(merged);
      const [found] = await db().query(
        "SELECT id FROM han_shop_rules WHERE team_name = ? AND store_name = ?",
        [teamName, shop],
      );
      if (found.length) {
        await db().query("UPDATE han_shop_rules SET rules_json = ? WHERE id = ?", [json, found[0].id]);
      } else {
        await db().query(
          "INSERT INTO han_shop_rules (team_name, store_name, rules_json) VALUES (?, ?, ?)",
          [teamName, shop, json],
        );
      }
      return this.getShopRules({ team: teamName, store: shop });
    },

    async resetShopRules({ team, store } = {}) {
      await ensure();
      const teamName = normalizeProductTeam(team);
      const shop = String(store || "").trim();
      if (!shop) {
        const err = new Error("store required");
        err.statusCode = 400;
        throw err;
      }
      await db().query("DELETE FROM han_shop_rules WHERE team_name = ? AND store_name = ?", [teamName, shop]);
      return this.getShopRules({ team: teamName, store: shop });
    },

    async getShopPlans({ team, store } = {}) {
      await ensure();
      const { teamName, shop } = requireShopKey({ team, store });
      const [rows] = await db().query(
        "SELECT id, team_name, store_name, month_plan, week_plan, updated_at FROM han_shop_plans WHERE team_name = ? AND store_name = ?",
        [teamName, shop],
      );
      if (!rows.length) {
        return { team: teamName, store: shop, monthItems: [], weekItems: [] };
      }
      return {
        team: teamName,
        store: shop,
        monthItems: parsePlanItems(rows[0].month_plan),
        weekItems: parsePlanItems(rows[0].week_plan),
        updatedAt: toIso(rows[0].updated_at),
      };
    },

    async saveShopPlans({ team, store, monthItems, weekItems, monthPlan, weekPlan } = {}) {
      await ensure();
      const { teamName, shop } = requireShopKey({ team, store });
      const month = serializePlanItems(monthItems != null ? monthItems : monthPlan);
      const week = serializePlanItems(weekItems != null ? weekItems : weekPlan);
      const [found] = await db().query("SELECT id FROM han_shop_plans WHERE team_name = ? AND store_name = ?", [
        teamName,
        shop,
      ]);
      if (found.length) {
        await db().query("UPDATE han_shop_plans SET month_plan = ?, week_plan = ? WHERE id = ?", [
          month,
          week,
          found[0].id,
        ]);
      } else {
        await db().query(
          "INSERT INTO han_shop_plans (team_name, store_name, month_plan, week_plan) VALUES (?, ?, ?, ?)",
          [teamName, shop, month, week],
        );
      }
      return this.getShopPlans({ team: teamName, store: shop });
    },

    async createProduct({
      name,
      sku,
      price,
      stock,
      owner,
      store,
      layer,
      image,
      spu,
      firstSku,
      hotSell,
      reviewCount,
      shareCount,
      qaVideo,
      returnM5,
      returnM6,
      returnM7,
      returnM8,
      orders30d,
      fulfillNote,
      jdStock,
      listedOn,
      hasNewBadge,
      needOrder,
      remark,
      team,
      spendRate,
      gmv7d,
      convRate,
    } = {}) {
      await ensure();
      const spuText = String(spu || "").trim();
      const first = String(firstSku || sku || "").trim();
      const trimmed = String(name || "").trim() || spuText || first;
      if (!trimmed) {
        const err = new Error("name or spu required");
        err.statusCode = 400;
        throw err;
      }
      const payload = {
        layer,
        returnM5,
        returnM6,
        returnM7,
        returnM8,
        orders30d,
        reviewCount,
        spendRate,
        gmv7d,
        convRate,
        needOrder,
        listedOn,
      };
      const teamName = normalizeProductTeam(team);
      const shopName = storeOrDefault(store);
      let layerName = normalizeProductLayer(layer);
      if (!layerName) {
        const shopRules = await this.getShopRules({ team: teamName, store: shopName });
        layerName = classifyProduct(payload, { force: true, rules: shopRules.rules });
      }
      if (layerName && !PRODUCT_LAYERS.includes(layerName)) {
        const err = new Error("unknown layer");
        err.statusCode = 400;
        throw err;
      }
      const [result] = await db().query(
        `INSERT INTO han_products (name, sku, price, stock, owner, store_name, layer, image_url, spu, first_sku, hot_sell, review_count, share_count, qa_video, return_m5, return_m6, return_m7, return_m8, orders_30d, fulfill_note, jd_stock, listed_on, has_new_badge, need_order, remark, team_name, spend_rate, gmv_7d, conv_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trimmed,
          first || String(sku || "").trim(),
          optionalNumber(price),
          optionalNumber(stock),
          ownerOrDefault(owner),
          shopName,
          layerName,
          String(image || "").trim(),
          spuText,
          first,
          String(hotSell || "").trim(),
          String(reviewCount || "").trim(),
          String(shareCount || "").trim(),
          String(qaVideo || "").trim(),
          String(returnM5 || "").trim(),
          String(returnM6 || "").trim(),
          String(returnM7 || "").trim(),
          String(returnM8 || "").trim(),
          String(orders30d || "").trim(),
          String(fulfillNote || "").trim(),
          String(jdStock || "").trim(),
          optionalDate(listedOn),
          String(hasNewBadge || "").trim(),
          String(needOrder || "").trim(),
          String(remark || "").trim(),
          teamName,
          String(spendRate || "").trim(),
          String(gmv7d || "").trim(),
          String(convRate || "").trim(),
        ],
      );
      const [rows] = await db().query(
        `SELECT ${PRODUCT_SELECT} FROM han_products WHERE id = ?`,
        [result.insertId],
      );
      return mapProduct(rows[0]);
    },

    async updateProduct(id, patch = {}) {
      await ensure();
      const productId = Number(id);
      if (!productId) {
        const err = new Error("id required");
        err.statusCode = 400;
        throw err;
      }
      const [found] = await db().query(`SELECT ${PRODUCT_SELECT} FROM han_products WHERE id = ?`, [productId]);
      if (!found.length) {
        const err = new Error("not found");
        err.statusCode = 404;
        throw err;
      }
      const current = mapProduct(found[0]);
      const next = { ...current, ...patch };
      if (patch.layer != null) {
        const layerName = normalizeProductLayer(patch.layer);
        if (layerName && !PRODUCT_LAYERS.includes(layerName)) {
          const err = new Error("unknown layer");
          err.statusCode = 400;
          throw err;
        }
        next.layer = layerName;
      }
      await db().query(
        `UPDATE han_products SET name = ?, sku = ?, price = ?, stock = ?, owner = ?, store_name = ?, layer = ?, image_url = ?, spu = ?, first_sku = ?, hot_sell = ?, review_count = ?, share_count = ?, qa_video = ?, return_m5 = ?, return_m6 = ?, return_m7 = ?, return_m8 = ?, orders_30d = ?, fulfill_note = ?, jd_stock = ?, listed_on = ?, has_new_badge = ?, need_order = ?, remark = ?, team_name = ?, spend_rate = ?, gmv_7d = ?, conv_rate = ? WHERE id = ?`,
        [
          next.name,
          next.sku || next.firstSku || "",
          optionalNumber(next.price),
          optionalNumber(next.stock),
          ownerOrDefault(next.owner),
          storeOrDefault(next.store),
          next.layer || "",
          String(next.image || "").trim(),
          String(next.spu || "").trim(),
          String(next.firstSku || "").trim(),
          String(next.hotSell || "").trim(),
          String(next.reviewCount || "").trim(),
          String(next.shareCount || "").trim(),
          String(next.qaVideo || "").trim(),
          String(next.returnM5 || "").trim(),
          String(next.returnM6 || "").trim(),
          String(next.returnM7 || "").trim(),
          String(next.returnM8 || "").trim(),
          String(next.orders30d || "").trim(),
          String(next.fulfillNote || "").trim(),
          String(next.jdStock || "").trim(),
          optionalDate(next.listedOn),
          String(next.hasNewBadge || "").trim(),
          String(next.needOrder || "").trim(),
          String(next.remark || "").trim(),
          normalizeProductTeam(next.team),
          String(next.spendRate || "").trim(),
          String(next.gmv7d || "").trim(),
          String(next.convRate || "").trim(),
          productId,
        ],
      );
      const [rows] = await db().query(`SELECT ${PRODUCT_SELECT} FROM han_products WHERE id = ?`, [productId]);
      return mapProduct(rows[0]);
    },

    async classifyProducts({ team, store } = {}) {
      const items = await this.listProducts({ team, store });
      const cache = new Map();
      const updated = [];
      for (const item of items) {
        const key = String(item.team || team || "") + "\0" + String(item.store || store || "");
        if (!cache.has(key)) {
          cache.set(
            key,
            await this.getShopRules({
              team: item.team || team,
              store: item.store || store || DEFAULT_STORE,
            }),
          );
        }
        const shopRules = cache.get(key);
        const layer = classifyProduct(item, { force: true, rules: shopRules.rules });
        if (layer && layer !== item.layer) {
          updated.push(await this.updateProduct(item.id, { layer }));
        }
      }
      return { updated, count: updated.length };
    },

    async importProducts({ team, store, items, csv, file, filename } = {}) {
      let rows = Array.isArray(items) && items.length ? items : null;
      if (!rows && file) {
        rows = parseOverviewWorkbook(file, filename).items;
      }
      if (!rows) {
        rows = parseProductCsv(csv);
      }
      const created = [];
      const errors = [];
      const shopRules = String(store || "").trim()
        ? await this.getShopRules({ team, store })
        : { rules: defaultClassifyRules() };
      for (const row of rows) {
        try {
          const layer = normalizeProductLayer(row.layer);
          created.push(
            await this.createProduct({
              ...row,
              layer: PRODUCT_LAYERS.includes(layer)
                ? layer
                : classifyProduct(row, { force: true, rules: shopRules.rules }),
              team: team || row.team,
              store: store || row.store,
            }),
          );
        } catch (err) {
          errors.push({
            spu: row.spu || row.name || "",
            layer: row.layer || "",
            error: err.message,
          });
        }
      }
      return { created, skipped: errors.length, errors };
    },

    async listPaid() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, channel, amount, spent_on, note, owner, store_name, created_at FROM han_paid ORDER BY id ASC",
      );
      return rows.map(mapPaid);
    },

    async createPaid({ channel, amount, spentOn, note, owner, store } = {}) {
      await ensure();
      const trimmed = String(channel || "").trim();
      if (!trimmed) {
        const err = new Error("channel required");
        err.statusCode = 400;
        throw err;
      }
      const [result] = await db().query(
        "INSERT INTO han_paid (channel, amount, spent_on, note, owner, store_name) VALUES (?, ?, ?, ?, ?, ?)",
        [trimmed, optionalNumber(amount), optionalDate(spentOn), String(note || "").trim(), ownerOrDefault(owner), storeOrDefault(store)],
      );
      const [rows] = await db().query(
        "SELECT id, channel, amount, spent_on, note, owner, store_name, created_at FROM han_paid WHERE id = ?",
        [result.insertId],
      );
      return mapPaid(rows[0]);
    },

    async listTraining() {
      await ensure();
      const [rows] = await db().query(
        "SELECT id, title, trainee, scheduled_on, status, note, owner, store_name, created_at FROM han_training ORDER BY id ASC",
      );
      return rows.map(mapTraining);
    },

    async createTraining({ title, trainee, scheduledOn, status, note, owner, store } = {}) {
      await ensure();
      const trimmed = String(title || "").trim();
      if (!trimmed) {
        const err = new Error("title required");
        err.statusCode = 400;
        throw err;
      }
      const st = TRAINING_STATUSES.includes(status) ? status : "待开始";
      const [result] = await db().query(
        "INSERT INTO han_training (title, trainee, scheduled_on, status, note, owner, store_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          trimmed,
          String(trainee || "").trim(),
          optionalDate(scheduledOn),
          st,
          String(note || "").trim(),
          ownerOrDefault(owner),
          storeOrDefault(store),
        ],
      );
      const [rows] = await db().query(
        "SELECT id, title, trainee, scheduled_on, status, note, owner, store_name, created_at FROM han_training WHERE id = ?",
        [result.insertId],
      );
      return mapTraining(rows[0]);
    },

    async listSummary({ store, from, to } = {}) {
      await ensure();
      const { shop, start, end, until } = requireStoreRange({ store, from, to });
      const pool = db();
      const range = [shop, start, until];
      const [[sel]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_selection WHERE store_name = ? AND created_at >= ? AND created_at < ?",
        range,
      );
      const [[prod]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_products WHERE store_name = ? AND created_at >= ? AND created_at < ?",
        range,
      );
      const [[paid]] = await pool.query(
        "SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM han_paid WHERE store_name = ? AND COALESCE(spent_on, DATE(created_at)) >= ? AND COALESCE(spent_on, DATE(created_at)) < ?",
        range,
      );
      const [[train]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_training WHERE store_name = ? AND COALESCE(scheduled_on, DATE(created_at)) >= ? AND COALESCE(scheduled_on, DATE(created_at)) < ?",
        range,
      );
      const [[tasks]] = await pool.query(
        "SELECT COUNT(*) AS n FROM han_tasks WHERE store_name = ? AND created_at >= ? AND created_at < ?",
        range,
      );
      return {
        store: shop,
        from: start,
        to: end,
        readOnly: true,
        selectionCount: Number(sel?.n || 0),
        productCount: Number(prod?.n || 0),
        paidCount: Number(paid?.n || 0),
        paidAmount: String(paid?.amount ?? 0),
        trainingCount: Number(train?.n || 0),
        taskCount: Number(tasks?.n || 0),
      };
    },
  };
}

const defaultStore = createHanStore();

export const listTasks = (...args) => defaultStore.listTasks(...args);
export const createTask = (...args) => defaultStore.createTask(...args);
export const getBrief = (...args) => defaultStore.getBrief(...args);
export const setBrief = (...args) => defaultStore.setBrief(...args);

export async function hydrateFromMysql(poolOrFactory = getPool) {
  const store = poolOrFactory === getPool ? defaultStore : createHanStore(poolOrFactory);
  await store.listTasks();
  await store.getBrief();
  return { ok: true };
}

export async function dropProbeTasks(poolOrFactory = getPool) {
  const db = typeof poolOrFactory === "function" ? poolOrFactory() : poolOrFactory;
  try {
    const [result] = await db.query(
      "DELETE FROM han_tasks WHERE title LIKE ? OR title LIKE ?",
      ["%[probe]%", "HAN-ONLY-%"],
    );
    return { ok: true, deleted: Number(result.affectedRows || 0) };
  } catch (err) {
    if (err && (err.code === "ER_NO_SUCH_TABLE" || err.code === "MYSQL_NOT_CONFIGURED")) {
      return { ok: true, deleted: 0 };
    }
    throw err;
  }
}

export const PRODUCT_CSV_FIELDS = [
  ["layer", "分层"],
  ["image", "主图"],
  ["spu", "SPU"],
  ["firstSku", "第一个sku"],
  ["hotSell", "全网热销"],
  ["reviewCount", "评价数"],
  ["shareCount", "晒单数"],
  ["qaVideo", "问答/视频logo"],
  ["returnM5", "BI 5月退货率"],
  ["returnM6", "BI 6月退货率"],
  ["returnM7", "BI 7月退货率"],
  ["returnM8", "BI 8月退货率"],
  ["orders30d", "近30天真实单量"],
  ["fulfillNote", "京仓/线下/拍单/无锡中转"],
  ["jdStock", "京仓库存"],
  ["price", "价格"],
  ["listedOn", "上架时间"],
  ["hasNewBadge", "是否有新品标"],
  ["needOrder", "需做单数量和时间"],
  ["remark", "备注"],
  ["spendRate", "推广花费占比"],
  ["gmv7d", "近7天日成交金额"],
  ["convRate", "成交转化率"],
];

const PRODUCT_CSV_ALIASES = {
  退货率: "returnM8",
  成交单量: "orders30d",
  近30天真实单量: "orders30d",
  花费占比: "spendRate",
  日成交金额: "gmv7d",
  转化率: "convRate",
};

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

export function buildProductCsv(items) {
  const header = PRODUCT_CSV_FIELDS.map((pair) => pair[1]).join(",");
  const lines = (items || []).map((row) =>
    PRODUCT_CSV_FIELDS.map((pair) => csvEscape(row[pair[0]] ?? "")).join(","),
  );
  return [header, ...lines].join("\n");
}

export function parseProductCsv(text) {
  const raw = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!raw) {
    return [];
  }
  const lines = raw.split("\n").filter((line) => line.trim());
  if (!lines.length) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const keyOf = new Map(PRODUCT_CSV_FIELDS.map((pair) => [pair[0], pair[0]]));
  PRODUCT_CSV_FIELDS.forEach((pair) => {
    keyOf.set(pair[1], pair[0]);
  });
  Object.entries(PRODUCT_CSV_ALIASES).forEach(([label, key]) => {
    keyOf.set(label, key);
  });
  const keys = headers.map((header) => keyOf.get(header) || "");
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    keys.forEach((key, i) => {
      if (key) {
        row[key] = String(cells[i] ?? "").trim();
      }
    });
    return row;
  });
}

export function teamLeadName(team) {
  return String(team || "").trim().replace(/组$/, "");
}

function isClosedStore(row) {
  const remark = String(row.remark || "");
  const status = String(row.statusKey || "");
  return status === "closed" || remark === "已退店";
}

function isHanDirectStore(row) {
  const rowLead = String(row.lead || "").trim();
  const chief = String(row.chief || "").trim();
  if (chief && chief !== "韩梦凯") {
    return false;
  }
  const leadName = rowLead.replace(/组$/, "");
  if (GROUP_LEADS.includes(leadName)) {
    return false;
  }
  return true;
}

export function matchOrgStoresForTeam(stores, team) {
  const teamName = normalizeProductTeam(team);
  if (!teamName) {
    return [];
  }
  const lead = teamLeadName(teamName);
  const direct = teamName === "韩梦凯组";
  const seen = new Set();
  const items = [];
  (stores || []).forEach((row) => {
    const rowLead = String(row.lead || "").trim();
    if (isClosedStore(row)) {
      return;
    }
    if (direct) {
      if (!isHanDirectStore(row)) {
        return;
      }
    } else if (rowLead !== lead && rowLead !== teamName) {
      return;
    }
    const shop = String(row.storeName || row.store || row.name || "").trim();
    if (!shop || seen.has(shop)) {
      return;
    }
    seen.add(shop);
    items.push({
      id: row.id != null ? "org-" + row.id : "org-" + shop,
      team: teamName,
      store: shop,
      source: "org",
    });
  });
  return items;
}

export function mergeTeamShops(orgItems, localItems) {
  const seen = new Set();
  const out = [];
  [].concat(orgItems || [], localItems || []).forEach((row) => {
    const shop = String(row.store || "").trim();
    if (!shop || seen.has(shop)) {
      return;
    }
    seen.add(shop);
    out.push(row);
  });
  return out;
}

export const HAN_DEFAULT_OWNER = DEFAULT_OWNER;
export const HAN_DEFAULT_STORE = DEFAULT_STORE;
export const HAN_STATUSES = STATUSES;
export const HAN_SELECTION_STATUSES = SELECTION_STATUSES;
export const HAN_TRAINING_STATUSES = TRAINING_STATUSES;
export const HAN_PRODUCT_LAYERS = PRODUCT_LAYERS;
export const HAN_PRODUCT_TEAMS = PRODUCT_TEAMS;
