function clone(row) {
  return { ...row };
}

export function createMemoryPool() {
  const tables = {
    xm_users: [],
    han_tasks: [],
    han_brief: [],
    shen_tasks: [],
    shen_brief: [],
    people: [],
    people_shops: [],
    people_grants: [],
    data_cards: [],
    data_events: [],
    notes: [],
    xm_sessions: []
  };
  const auto = {
    han_tasks: 1,
    shen_tasks: 1,
    people: 1,
    people_shops: 1,
    people_grants: 1,
    data_events: 1,
    notes: 1
  };

  function nextId(table) {
    const id = auto[table];
    auto[table] = id + 1;
    return id;
  }

  async function query(sql, params = []) {
    const s = String(sql).replace(/\s+/g, " ").trim();
    if (/^CREATE (TABLE|DATABASE)/i.test(s) || /^ALTER TABLE/i.test(s)) {
      return [{ affectedRows: 0 }, undefined];
    }

    function normalizePerson(row) {
      return {
        employee_no: "",
        department: "",
        manager_id: null,
        ...row
      };
    }

    function insertByColumns(table, sql, values) {
      const match = sql.match(/INSERT INTO (\w+) \(([^)]+)\)/i);
      if (!match) {
        return null;
      }
      const cols = match[2].split(",").map((item) => item.trim());
      const row = {};
      cols.forEach((col, index) => {
        row[col] = values[index];
      });
      if (row.id == null) {
        row.id = nextId(table);
      } else {
        auto[table] = Math.max(auto[table] || 1, Number(row.id) + 1);
      }
      tables[table].push(row);
      return Number(row.id);
    }

    if (s === "SELECT username, display_name, email, phone, password_hash FROM xm_users") {
      return [tables.xm_users.map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO xm_users")) {
      const [username, display_name, email, phone, password_hash, updated_at] = params;
      const existing = tables.xm_users.find((row) => row.username === username);
      const row = { username, display_name, email, phone, password_hash, updated_at };
      if (existing) {
        Object.assign(existing, row);
      } else {
        tables.xm_users.push(row);
      }
      return [{ affectedRows: 1, insertId: 0 }, undefined];
    }

    if (s === "SELECT id, title, status, owner, created_at FROM han_tasks ORDER BY id ASC") {
      return [tables.han_tasks.map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO han_tasks")) {
      const [title, status, owner, created_at] = params;
      const id = nextId("han_tasks");
      tables.han_tasks.push({ id, title, status, owner, created_at });
      return [{ affectedRows: 1, insertId: id }, undefined];
    }
    if (s === "SELECT text FROM han_brief WHERE id = 1") {
      return [tables.han_brief.filter((row) => Number(row.id) === 1).map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO han_brief")) {
      const text = params[0];
      const existing = tables.han_brief.find((row) => Number(row.id) === 1);
      if (existing) {
        existing.text = text;
      } else {
        tables.han_brief.push({ id: 1, text });
      }
      return [{ affectedRows: 1, insertId: 1 }, undefined];
    }

    if (s === "SELECT id, title, status, owner FROM shen_tasks ORDER BY id ASC") {
      return [tables.shen_tasks.map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO shen_tasks")) {
      const [title, status, owner] = params;
      const id = nextId("shen_tasks");
      tables.shen_tasks.push({ id, title, status, owner });
      return [{ affectedRows: 1, insertId: id }, undefined];
    }
    if (s === "SELECT text FROM shen_brief WHERE id = 1") {
      return [tables.shen_brief.filter((row) => Number(row.id) === 1).map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO shen_brief")) {
      const text = params[0];
      const existing = tables.shen_brief.find((row) => Number(row.id) === 1);
      if (existing) {
        existing.text = text;
      } else {
        tables.shen_brief.push({ id: 1, text });
      }
      return [{ affectedRows: 1, insertId: 1 }, undefined];
    }

    if (/^SELECT .+ FROM people ORDER BY id ASC$/.test(s)) {
      return [tables.people.map((row) => normalizePerson(clone(row))), undefined];
    }
    if (s.startsWith("INSERT INTO people ")) {
      const id = insertByColumns("people", s, params);
      return [{ affectedRows: 1, insertId: id }, undefined];
    }
    if (s.startsWith("UPDATE people SET name =")) {
      const id = Number(params[params.length - 1]);
      const row = tables.people.find((item) => Number(item.id) === id);
      if (row) {
        row.name = params[0];
        row.role = params[1];
        row.center = params[2];
        row.status = params[3];
        row.employee_no = params[4];
        row.department = params[5];
        row.manager_id = params[6];
      }
      return [{ affectedRows: row ? 1 : 0 }, undefined];
    }
    if (s.startsWith("UPDATE people SET role =")) {
      const id = Number(params[params.length - 1]);
      const row = tables.people.find((item) => Number(item.id) === id);
      if (row) {
        row.role = params[0];
        row.employee_no = params[1];
        row.department = params[2];
        row.manager_id = params[3];
      }
      return [{ affectedRows: row ? 1 : 0 }, undefined];
    }
    if (s === "SELECT id, name, kind, pack, bundle, demo FROM people_shops ORDER BY id ASC") {
      return [tables.people_shops.map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO people_shops ")) {
      const id = insertByColumns("people_shops", s, params);
      return [{ affectedRows: 1, insertId: id }, undefined];
    }
    if (s === "SELECT id, person_id, shop_id, role, start_on, end_on, revoked FROM people_grants ORDER BY id ASC") {
      return [tables.people_grants.map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO people_grants ")) {
      const id = insertByColumns("people_grants", s, params);
      return [{ affectedRows: 1, insertId: id }, undefined];
    }
    if (s.startsWith("UPDATE people_grants SET revoked")) {
      const onDay = params[0];
      const personId = Number(params[1]);
      let count = 0;
      tables.people_grants.forEach((row) => {
        if (Number(row.person_id) === personId && !Number(row.revoked)) {
          row.revoked = 1;
          if (!row.end_on) {
            row.end_on = onDay;
          }
          count += 1;
        }
      });
      return [{ affectedRows: count }, undefined];
    }

    if (s.startsWith("SELECT card_key, label, value, unit")) {
      return [tables.data_cards.map(clone).sort((a, b) => a.sort_n - b.sort_n), undefined];
    }
    if (s.startsWith("INSERT INTO data_cards")) {
      const [card_key, label, value, unit, sort_n] = params;
      tables.data_cards.push({ card_key, label, value, unit, sort_n });
      return [{ affectedRows: 1 }, undefined];
    }
    if (s.startsWith("SELECT event_time, event_type, summary")) {
      return [tables.data_events.map(clone).sort((a, b) => a.sort_n - b.sort_n), undefined];
    }
    if (s.startsWith("INSERT INTO data_events")) {
      const [event_time, event_type, summary, sort_n] = params;
      const id = nextId("data_events");
      tables.data_events.push({ id, event_time, event_type, summary, sort_n });
      return [{ affectedRows: 1, insertId: id }, undefined];
    }

    if (s === "SELECT id, text, created_at FROM notes ORDER BY id ASC") {
      return [tables.notes.map(clone), undefined];
    }
    if (s.startsWith("DELETE FROM han_tasks WHERE title")) {
      const title = params[0];
      const before = tables.han_tasks.length;
      tables.han_tasks = tables.han_tasks.filter((row) => row.title !== title);
      return [{ affectedRows: before - tables.han_tasks.length }, undefined];
    }
    if (s.startsWith("DELETE FROM notes WHERE text")) {
      const text = params[0];
      const before = tables.notes.length;
      tables.notes = tables.notes.filter((row) => row.text !== text);
      return [{ affectedRows: before - tables.notes.length }, undefined];
    }
    if (s.startsWith("DELETE FROM xm_sessions WHERE expires_at")) {
      const limit = Number(params[0]) || 0;
      const before = tables.xm_sessions.length;
      tables.xm_sessions = tables.xm_sessions.filter((row) => Number(row.expires_at) >= limit);
      return [{ affectedRows: before - tables.xm_sessions.length }, undefined];
    }
    if (s.startsWith("SELECT sid, username, created_at, expires_at FROM xm_sessions")) {
      const limit = Number(params[0]) || 0;
      return [
        tables.xm_sessions.filter((row) => Number(row.expires_at) >= limit).map(clone),
        undefined
      ];
    }
    if (s.startsWith("INSERT INTO xm_sessions")) {
      const [sid, username, created_at, expires_at] = params;
      const existing = tables.xm_sessions.find((row) => row.sid === sid);
      const row = { sid, username, created_at, expires_at };
      if (existing) {
        Object.assign(existing, row);
      } else {
        tables.xm_sessions.push(row);
      }
      return [{ affectedRows: 1 }, undefined];
    }
    if (s.startsWith("DELETE FROM xm_sessions WHERE sid")) {
      const sid = params[0];
      const before = tables.xm_sessions.length;
      tables.xm_sessions = tables.xm_sessions.filter((row) => row.sid !== sid);
      return [{ affectedRows: before - tables.xm_sessions.length }, undefined];
    }
    if (s.startsWith("INSERT INTO notes")) {
      const [text, created_at] = params;
      const id = nextId("notes");
      tables.notes.push({ id, text, created_at });
      return [{ affectedRows: 1, insertId: id }, undefined];
    }

    throw new Error(`memory pool cannot run: ${s}`);
  }

  return { query, execute: query };
}
