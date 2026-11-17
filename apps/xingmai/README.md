# mengkai

A minimal starter web application: a notes API (Express) with a small static
frontend. It exists to give the project a runnable, testable baseline and a
working Cloud Agent development environment.

## Requirements

- Node.js >= 20 (Node 22 recommended)

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server with auto-reload on http://localhost:3000
npm start        # start the server without watch mode
npm test         # run the test suite (node:test)
npm run lint     # run ESLint
```

Then open http://localhost:3000 and add a note.

## API

| Method | Path         | Description                    |
| ------ | ------------ | ------------------------------ |
| GET    | `/api/health`| Health check (`{status:"ok"}`) |
| GET    | `/api/notes` | List all notes                 |
| POST   | `/api/notes` | Create a note (`{ "text": … }`)|

Notes are stored in memory and reset when the server restarts.

## Project layout

```
src/          Express app and server entry point
  app.js      builds the Express app (routes + static hosting)
  server.js   starts the HTTP server
  notes-store.js  in-memory notes store
public/       static frontend (HTML/CSS/JS)
test/         node:test API tests
```
