import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  owner: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  title: string;
  owner: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

const SEED: NewTask[] = [
  { title: "Publish weekly growth report", owner: "Amara", status: "in_progress", priority: "high" },
  { title: "Review Q3 channel budget", owner: "Chen", status: "todo", priority: "medium" },
  { title: "Onboard new community moderators", owner: "Diego", status: "done", priority: "low" },
  { title: "Launch referral campaign A/B test", owner: "Priya", status: "todo", priority: "high" },
];

/**
 * A tiny JSON-file backed store. Persistence lives outside the build output so
 * it survives dev restarts but stays out of version control. The in-memory copy
 * is the source of truth for a single running process; every mutation is flushed
 * to disk so a restart resumes from the same state.
 */
export class TaskStore {
  private tasks: Task[] = [];

  constructor(private readonly filePath: string) {
    this.load();
  }

  private load(): void {
    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, "utf8");
        const parsed = JSON.parse(raw) as Task[];
        if (Array.isArray(parsed)) {
          this.tasks = parsed;
          return;
        }
      } catch {
        // Corrupt file: fall through to reseeding.
      }
    }
    this.tasks = SEED.map((t) => this.materialize(t));
    this.flush();
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.tasks, null, 2), "utf8");
  }

  private materialize(input: NewTask): Task {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      title: input.title.trim(),
      owner: input.owner.trim(),
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      createdAt: now,
      updatedAt: now,
    };
  }

  list(): Task[] {
    return [...this.tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  create(input: NewTask): Task {
    const errors = validateNewTask(input);
    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
    const task = this.materialize(input);
    this.tasks.push(task);
    this.flush();
    return task;
  }

  update(id: string, patch: Partial<NewTask>): Task | undefined {
    const task = this.get(id);
    if (!task) return undefined;
    if (patch.status && !STATUSES.includes(patch.status)) {
      throw new ValidationError([`status must be one of ${STATUSES.join(", ")}`]);
    }
    if (patch.priority && !PRIORITIES.includes(patch.priority)) {
      throw new ValidationError([`priority must be one of ${PRIORITIES.join(", ")}`]);
    }
    Object.assign(task, {
      title: patch.title?.trim() ?? task.title,
      owner: patch.owner?.trim() ?? task.owner,
      status: patch.status ?? task.status,
      priority: patch.priority ?? task.priority,
      updatedAt: new Date().toISOString(),
    });
    this.flush();
    return task;
  }

  remove(id: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    const removed = this.tasks.length !== before;
    if (removed) this.flush();
    return removed;
  }

  metrics(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    completionRate: number;
  } {
    const byStatus = { todo: 0, in_progress: 0, done: 0 } as Record<TaskStatus, number>;
    const byPriority = { low: 0, medium: 0, high: 0 } as Record<TaskPriority, number>;
    for (const t of this.tasks) {
      byStatus[t.status] += 1;
      byPriority[t.priority] += 1;
    }
    const total = this.tasks.length;
    const completionRate = total === 0 ? 0 : Math.round((byStatus.done / total) * 100);
    return { total, byStatus, byPriority, completionRate };
  }
}

export class ValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "ValidationError";
  }
}

export function validateNewTask(input: Partial<NewTask>): string[] {
  const errors: string[] = [];
  if (!input.title || input.title.trim().length === 0) {
    errors.push("title is required");
  }
  if (!input.owner || input.owner.trim().length === 0) {
    errors.push("owner is required");
  }
  if (input.status && !STATUSES.includes(input.status)) {
    errors.push(`status must be one of ${STATUSES.join(", ")}`);
  }
  if (input.priority && !PRIORITIES.includes(input.priority)) {
    errors.push(`priority must be one of ${PRIORITIES.join(", ")}`);
  }
  return errors;
}
