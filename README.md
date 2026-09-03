# yunyingbu · Operations Dashboard (运营部)

A small full-stack **operations dashboard** for tracking a team's operational tasks
from intake to done. It is intentionally lightweight so the whole thing runs with a
single `npm` command and no external services.

- **Client** — Vite + React + TypeScript single-page app (`client/`)
- **Server** — Express + TypeScript REST API with JSON-file persistence (`server/`)
- **Monorepo** — npm workspaces tie the two packages together

## Prerequisites

- Node.js >= 20 (developed on Node 22)
- npm 10+

## Quick start

```bash
npm ci        # install all workspace dependencies
npm run dev   # start the API (http://localhost:3001) and client (http://localhost:5173)
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the
Express API on port 3001, so no CORS or extra config is needed in development.

## Available scripts (run from the repo root)

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and client together (via `concurrently`). |
| `npm run dev:server` | Run only the API in watch mode. |
| `npm run dev:client` | Run only the Vite client. |
| `npm run build` | Type-check + build both packages. |
| `npm run typecheck` | Type-check both packages. |
| `npm run lint` | Lint the client. |
| `npm run test` | Run the server unit tests. |
| `npm start` | Run the compiled API (`npm run build` first). |

## API

Base URL: `http://localhost:3001`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness probe. |
| GET | `/api/tasks` | List tasks (newest first). |
| POST | `/api/tasks` | Create a task. Body: `{ title, owner, status?, priority? }`. |
| PATCH | `/api/tasks/:id` | Update a task's fields. |
| DELETE | `/api/tasks/:id` | Delete a task. |
| GET | `/api/metrics` | Summary counts + completion rate. |

Data is persisted to `server/data/tasks.json` (git-ignored, seeded on first run).
Override the location with the `DATA_FILE` env var and the port with `PORT`.

## Project layout

```
.
├── client/            # Vite + React + TS front end
├── server/            # Express + TS REST API
├── .cursor/           # Cloud Agent environment config + install script
└── package.json       # npm workspaces root
```

## Cloud Agent environment

`.cursor/environment.json` bootstraps dependencies via `.cursor/install.sh`
(`npm ci` + type-check) and launches two long-running terminals, `api` and `web`,
for the API and client dev servers.
