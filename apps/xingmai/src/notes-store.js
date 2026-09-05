let nextId = 1;
const notes = [];

export function listNotes() {
  return notes.slice();
}

export function addNote(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    throw new Error("Note text is required");
  }
  const note = { id: nextId++, text: trimmed, createdAt: new Date().toISOString() };
  notes.push(note);
  return note;
}

export function clearNotes() {
  notes.length = 0;
  nextId = 1;
}
