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
    data_cards: [],
    data_events: [],
    notes: []
  };
  const auto = {
    han_tasks: 1,
    shen_tasks: 1,
    people: 1,
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
    if (/^CREATE (TABLE|DATABASE)/i.test(s)) {
      return [{ affectedRows: 0 }, undefined];
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

    if (s === "SELECT id, name, role, center, status, demo FROM people ORDER BY id ASC") {
      return [tables.people.map(clone), undefined];
    }
    if (s.startsWith("INSERT INTO people (id,")) {
      const [id, name, role, center, status, demo] = params;
      tables.people.push({ id, name, role, center, status, demo });
      auto.people = Math.max(auto.people, Number(id) + 1);
      return [{ affectedRows: 1, insertId: id }, undefined];
    }
    if (s.startsWith("INSERT INTO people (name,")) {
      const [name, role, center, status] = params;
      const id = nextId("people");
      tables.people.push({ id, name, role, center, status, demo: 0 });
      return [{ affectedRows: 1, insertId: id }, undefined];
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
