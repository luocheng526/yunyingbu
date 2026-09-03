import { join } from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { TaskStore, ValidationError } from "./store";

const PORT = Number(process.env.PORT ?? 3001);
const DATA_FILE = process.env.DATA_FILE ?? join(__dirname, "..", "data", "tasks.json");

export function createApp(store: TaskStore = new TaskStore(DATA_FILE)) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "yunyingbu-api", time: new Date().toISOString() });
  });

  app.get("/api/tasks", (_req: Request, res: Response) => {
    res.json(store.list());
  });

  app.get("/api/metrics", (_req: Request, res: Response) => {
    res.json(store.metrics());
  });

  app.post("/api/tasks", (req: Request, res: Response) => {
    const task = store.create(req.body ?? {});
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id", (req: Request, res: Response) => {
    const updated = store.update(req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json(updated);
  });

  app.delete("/api/tasks/:id", (req: Request, res: Response) => {
    const removed = store.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.status(204).end();
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: "validation failed", details: err.errors });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`yunyingbu API listening on http://localhost:${PORT}`);
  });
}
