"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Check,
  ChevronRight,
  Circle,
  Plus,
  Trash2,
  ListTodo,
  CheckCircle2,
  Clock3,
  Repeat,
} from "lucide-react";

interface Todo {
  id: number;
  user_id: string;
  task: string;
  is_completed: boolean;
  created_at?: string;
  recurrence: "none" | "daily" | "weekly";
  last_completed_at: string | null;
}

// FIXED (Critical logic bug): recurring-todo auto-reset previously only
// lived in the Dashboard page. A user who only ever visited /todo would
// see completed daily/weekly tasks stay checked off forever, since nothing
// on this page ever reopened them. The same reset logic from the Dashboard
// is now ported here (and the Todo interface now includes the
// `recurrence` / `last_completed_at` fields the DB actually has, which
// this file was previously missing).
export default function TodoList() {
  const [userId, setUserId] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -----------------------------
  // Resolve current user
  // -----------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setErrorMessage("Your session expired. Please log in again.");
        return;
      }
      setUserId(data.user.id);
    });
  }, []);

  // -----------------------------
  // Reopens completed recurring todos once their cycle (day/week) has passed.
  // -----------------------------
  const resetDueRecurringTodos = useCallback(async (currentTodos: Todo[]) => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const due = currentTodos.filter((todo) => {
      if (!todo.is_completed || todo.recurrence === "none" || !todo.last_completed_at) {
        return false;
      }
      const elapsed = now - new Date(todo.last_completed_at).getTime();
      if (todo.recurrence === "daily") return elapsed >= DAY_MS;
      if (todo.recurrence === "weekly") return elapsed >= 7 * DAY_MS;
      return false;
    });

    if (due.length === 0) return;

    setTodos((prev) =>
      prev.map((todo) => (due.some((d) => d.id === todo.id) ? { ...todo, is_completed: false } : todo))
    );

    await Promise.all(
      due.map((todo) => supabase.from("todos").update({ is_completed: false }).eq("id", todo.id))
    );
  }, []);

  // -----------------------------
  // Fetch todos + realtime (this user's rows only)
  // -----------------------------
  useEffect(() => {
    if (!userId) return;

    const fetchTodos = async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching todos:", error.message);
        setErrorMessage("Couldn't load your tasks. Please refresh.");
        return;
      }
      const fetched = (data as Todo[]) || [];
      setTodos(fetched);
      resetDueRecurringTodos(fetched);
    };

    fetchTodos();

    const channel = supabase
      .channel("todos_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTodos((prev) => {
              if (prev.some((t) => t.id === (payload.new as Todo).id)) return prev;
              return [payload.new as Todo, ...prev];
            });
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Todo;
            setTodos((prev) => prev.map((todo) => (todo.id === updated.id ? updated : todo)));
          }
          if (payload.eventType === "DELETE") {
            setTodos((prev) => prev.filter((todo) => todo.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, resetDueRecurringTodos]);

  // -----------------------------
  // Add todo (now surfaces errors instead of silently clearing the input)
  // -----------------------------
  const handleAddTodo = async () => {
    if (!userId || !newTask.trim() || isAdding) return;

    setIsAdding(true);
    setErrorMessage(null);
    const taskText = newTask.trim();

    const { error } = await supabase.from("todos").insert([
      {
        user_id: userId,
        task: taskText,
        is_completed: false,
        recurrence: "none",
      },
    ]);

    if (error) {
      console.error("Error adding todo:", error.message);
      setErrorMessage("Couldn't add that task. Please try again.");
      setIsAdding(false);
      return; // keep the text in the input so nothing is lost
    }

    setNewTask("");
    setIsAdding(false);
  };

  // -----------------------------
  // Toggle todo (optimistic, with rollback). Stamps last_completed_at so
  // recurring tasks know when their cycle started.
  // -----------------------------
  const handleToggleTodo = async (id: number, currentStatus: boolean) => {
    const previous = todos;
    const nowIso = new Date().toISOString();
    const markingComplete = !currentStatus;

    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, is_completed: markingComplete, last_completed_at: markingComplete ? nowIso : t.last_completed_at }
          : t
      )
    );

    const { error } = await supabase
      .from("todos")
      .update({ is_completed: markingComplete, ...(markingComplete ? { last_completed_at: nowIso } : {}) })
      .eq("id", id);

    if (error) {
      console.error("Error toggling todo:", error.message);
      setErrorMessage("Couldn't update that task. Please try again.");
      setTodos(previous);
    }
  };

  // -----------------------------
  // Delete todo (optimistic, with rollback)
  // -----------------------------
  const handleDeleteTodo = async (id: number) => {
    const previous = todos;
    setTodos((prev) => prev.filter((todo) => todo.id !== id));

    const { error } = await supabase.from("todos").delete().eq("id", id);

    if (error) {
      console.error("Error deleting todo:", error.message);
      setErrorMessage("Couldn't delete that task. Please try again.");
      setTodos(previous);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddTodo();
  };

  const completedTodos = todos.filter((todo) => todo.is_completed).length;
  const activeTodos = todos.filter((todo) => !todo.is_completed).length;
  const progress = todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0;

  const filteredTodos = useMemo(() => {
    if (activeTab === "active") return todos.filter((todo) => !todo.is_completed);
    if (activeTab === "completed") return todos.filter((todo) => todo.is_completed);
    return todos;
  }, [todos, activeTab]);

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-sm">
            <div className="relative h-11 w-11">
              <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4"
                  className="text-[var(--panel-2)]"
                />
                <circle
                  cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4"
                  strokeLinecap="round" strokeDasharray={`${progress * 1.13} 113`}
                  className="text-[var(--accent-soft)]"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--text)]">
                {progress}%
              </span>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Today&apos;s progress</p>
              <p className="text-sm font-semibold text-[var(--text)]">
                {completedTodos} of {todos.length} completed
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-[color-mix(in_srgb,var(--over)_30%,transparent)] bg-[color-mix(in_srgb,var(--over)_10%,transparent)] px-4 py-3 text-sm text-[var(--over)]">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-semibold text-[var(--over)] hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
              <ListTodo size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Total tasks</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">{todos.length}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-[var(--warn)]">
              <Clock3 size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Pending</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">{activeTodos}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--up)_14%,transparent)] text-[var(--up)]">
              <CheckCircle2 size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Completed</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">{completedTodos}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">Today&apos;s tasks</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">Stay focused and complete your goals.</p>
              </div>

              <div className="flex rounded-xl bg-[var(--panel-2)] p-1">
                {[
                  ["all", "All"],
                  ["active", "Active"],
                  ["completed", "Done"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value as "all" | "active" | "completed")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === value
                        ? "bg-[var(--panel)] text-[var(--text)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--panel-2)] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
                <Plus size={18} />
              </div>
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What needs to be done?"
                maxLength={200}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />
              <button
                onClick={handleAddTodo}
                disabled={isAdding || !newTask.trim()}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isAdding ? "Adding..." : "Add task"}
              </button>
            </div>

            <div className="space-y-2">
              {filteredTodos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] py-14 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
                    <CheckCircle2 size={26} />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text)]">
                    {activeTab === "completed" ? "No completed tasks" : "You're all caught up!"}
                  </h3>
                  <p className="mt-1 max-w-xs text-xs text-[var(--muted)]">
                    Add a task above and start making progress.
                  </p>
                </div>
              ) : (
                filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="group flex items-center gap-3 rounded-2xl border border-transparent bg-[var(--panel-2)] p-3 transition hover:border-[var(--line)] hover:bg-[var(--panel)] hover:shadow-sm"
                  >
                    <button
                      onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
                      className="shrink-0"
                      aria-label={todo.is_completed ? "Mark as incomplete" : "Mark as complete"}
                    >
                      {todo.is_completed ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      ) : (
                        <Circle size={24} className="text-[var(--muted)] transition group-hover:text-[var(--accent-soft)]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={`truncate text-sm font-medium transition ${
                            todo.is_completed ? "text-[var(--muted)] line-through" : "text-[var(--text)]"
                          }`}
                        >
                          {todo.task}
                        </p>
                        {todo.recurrence !== "none" && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--accent-wash)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--accent-soft)]">
                            <Repeat className="h-2 w-2" />
                            {todo.recurrence === "daily" ? "Daily" : "Weekly"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {todo.is_completed ? "Completed" : "Pending task"}
                      </p>
                    </div>

                    <span
                      className={`hidden rounded-full px-2.5 py-1 text-[10px] font-semibold sm:block ${
                        todo.is_completed
                          ? "bg-[color-mix(in_srgb,var(--up)_14%,transparent)] text-[var(--up)]"
                          : "bg-[var(--accent-wash)] text-[var(--accent-soft)]"
                      }`}
                    >
                      {todo.is_completed ? "Done" : "In progress"}
                    </span>

                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] opacity-0 transition hover:bg-[color-mix(in_srgb,var(--over)_12%,transparent)] hover:text-[var(--over)] group-hover:opacity-100"
                      aria-label="Delete task"
                    >
                      <Trash2 size={15} />
                    </button>

                    <ChevronRight size={15} className="hidden text-[var(--muted)] sm:block" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl bg-[var(--accent)] p-6 text-white shadow-sm">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <CheckCircle2 size={23} />
              </div>
              <p className="text-xs font-medium text-white/70">YOUR PRODUCTIVITY</p>
              <h3 className="mt-2 text-2xl font-bold">Keep going!</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                You&apos;ve completed{" "}
                <span className="font-bold text-white">{completedTodos}</span>{" "}
                {completedTodos === 1 ? "task" : "tasks"} today.
              </p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-white/70">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text)]">Quick overview</h3>
                <span className="text-xs text-[var(--muted)]">Today</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <span className="text-xs text-[var(--muted)]">All tasks</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--text)]">{todos.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[var(--warn)]" />
                    <span className="text-xs text-[var(--muted)]">Pending</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--text)]">{activeTodos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-[var(--up)]" />
                    <span className="text-xs text-[var(--muted)]">Completed</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--text)]">{completedTodos}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}