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

export interface Metrics {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  completionRate: number;
}

export interface NewTask {
  title: string;
  owner: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    try {
      const body = await res.json();
      if (body?.details) message = body.details.join("; ");
      else if (body?.error) message = body.error;
    } catch {
      // ignore parse errors, keep default message
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listTasks: () => fetch("/api/tasks").then((r) => handle<Task[]>(r)),
  metrics: () => fetch("/api/metrics").then((r) => handle<Metrics>(r)),
  createTask: (task: NewTask) =>
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    }).then((r) => handle<Task>(r)),
  updateTask: (id: string, patch: Partial<NewTask>) =>
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => handle<Task>(r)),
  deleteTask: (id: string) => fetch(`/api/tasks/${id}`, { method: "DELETE" }).then((r) => handle<void>(r)),
};
