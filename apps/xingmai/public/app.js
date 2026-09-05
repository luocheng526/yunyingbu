const form = document.getElementById("note-form");
const input = document.getElementById("note-input");
const list = document.getElementById("note-list");
const emptyState = document.getElementById("empty-state");

function render(notes) {
  list.innerHTML = "";
  if (notes.length === 0) {
    emptyState.classList.remove("empty-state--hidden");
    return;
  }
  emptyState.classList.add("empty-state--hidden");
  for (const note of notes) {
    const item = document.createElement("li");
    item.className = "note-list__item";
    const text = document.createElement("span");
    text.textContent = note.text;
    const time = document.createElement("time");
    time.dateTime = note.createdAt;
    time.textContent = new Date(note.createdAt).toLocaleString();
    item.append(text, time);
    list.append(item);
  }
}

async function loadNotes() {
  const res = await fetch("/api/notes");
  render(await res.json());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (res.ok) {
    input.value = "";
    await loadNotes();
    input.focus();
  }
});

loadNotes();
