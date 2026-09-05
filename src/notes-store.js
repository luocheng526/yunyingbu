/**
 * In-memory notes store used by the notes API.
 * Contents are lost when the server process restarts.
 */
export function createNotesStore() {
  const notes = [];
  let nextId = 1;

  return {
    list() {
      return notes.slice();
    },
    create(text) {
      const note = {
        id: nextId++,
        text,
        createdAt: new Date().toISOString(),
      };
      notes.push(note);
      return note;
    },
  };
}
