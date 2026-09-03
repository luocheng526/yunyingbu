import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  api,
  type Metrics,
  type NewTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "./api";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [nextTasks, nextMetrics] = await Promise.all([api.listTasks(), api.metrics()]);
    setTasks(nextTasks);
    setMetrics(nextMetrics);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [refresh]);

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const payload: NewTask = { title, owner, priority };
    setSubmitting(true);
    try {
      await api.createTask(payload);
      setTitle("");
      setOwner("");
      setPriority("medium");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (task: Task, status: TaskStatus) => {
    setError(null);
    try {
      await api.updateTask(task.id, { status });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update task");
    }
  };

  const removeTask = async (task: Task) => {
    setError(null);
    try {
      await api.deleteTask(task.id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete task");
    }
  };

  const grouped = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status,
      items: tasks.filter((t) => t.status === status),
    }));
  }, [tasks]);

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <p className="eyebrow">运营部 · Operations</p>
          <h1>Operations Dashboard</h1>
          <p className="subtitle">Track the team&apos;s operational tasks from intake to done.</p>
        </div>
        <div
          className="completion"
          aria-label="Completion rate"
          style={{ "--pct": metrics ? metrics.completionRate : 0 } as React.CSSProperties}
        >
          <div className="completion-inner">
            <span className="completion-value">{metrics ? `${metrics.completionRate}%` : "—"}</span>
            <span className="completion-label">complete</span>
          </div>
        </div>
      </header>

      {metrics && (
        <section className="metrics" aria-label="Summary metrics">
          <MetricCard label="Total tasks" value={metrics.total} tone="indigo" />
          <MetricCard label="To do" value={metrics.byStatus.todo} tone="slate" />
          <MetricCard label="In progress" value={metrics.byStatus.in_progress} tone="amber" />
          <MetricCard label="Done" value={metrics.byStatus.done} tone="green" />
          <MetricCard label="High priority" value={metrics.byPriority.high} tone="rose" />
        </section>
      )}

      <section className="composer" aria-label="Add task">
        <h2>Add a task</h2>
        <form onSubmit={addTask} className="composer-form">
          <label className="field">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare monthly ops review"
              required
            />
          </label>
          <label className="field">
            <span>Owner</span>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. Amara"
              required
            />
          </label>
          <label className="field field--narrow">
            <span>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add task"}
          </button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <section className="board" aria-label="Task board">
        {loading ? (
          <p className="muted">Loading tasks…</p>
        ) : (
          grouped.map(({ status, items }) => (
            <div className="column" key={status}>
              <div className="column-head">
                <h3>{STATUS_LABELS[status]}</h3>
                <span className="count">{items.length}</span>
              </div>
              <ul className="cards">
                {items.length === 0 && <li className="empty">Nothing here yet.</li>}
                {items.map((task) => (
                  <li key={task.id} className={`card priority-${task.priority}`}>
                    <div className="card-top">
                      <span className="card-title">{task.title}</span>
                      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                    </div>
                    <p className="card-owner">Owner: {task.owner}</p>
                    <div className="card-actions">
                      <select
                        value={task.status}
                        onChange={(e) => changeStatus(task, e.target.value as TaskStatus)}
                        aria-label={`Change status for ${task.title}`}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => removeTask(task)}
                        aria-label={`Delete ${task.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "indigo" | "slate" | "amber" | "green" | "rose";
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

export default App;
