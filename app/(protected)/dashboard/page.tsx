'use client';
import Link from 'next/link';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Scale,
  CheckSquare,
  CreditCard,
  Activity,
  Wifi,
  Plus,
  ArrowUpRight,
  MoreHorizontal,
  Check,
  Trash2,
  Repeat,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronDown,
} from 'lucide-react';
import AddEntryModal from '../../components/AddEntryModal';
import LiveClock from '@/app/components/LiveClock';
import SubscriptionIcon from '../../components/SubscriptionIcon';

// Type Interfaces
interface WeightLog {
  id: number;
  weight: number;
  created_at: string;
}

interface Todo {
  id: number;
  task: string;
  is_completed: boolean;
  created_at: string;
  recurrence: 'none' | 'daily' | 'weekly';
  last_completed_at: string | null;
}

interface Subscription {
  id: number;
  name: string;
  cost: number;
  created_at: string;
}

interface BudgetRow {
  id: number;
  income: number;
  housing: number;
  food: number;
  transport: number;
  utilities: number;
  other: number;
  savings_goal: number;
}

// Sample card details shown on the Available Balance card
const CARD_HOLDER = 'Muhammad Hassan Jamshaid';
const CARD_EXPIRES = '02/30';
const CARD_LAST4 = '2030';

/* ═══════════════════════════════════════════════════════════════════════
   TodoRow — long task text can be expanded.

     - measures whether the text is actually overflowing (scrollWidth vs
       clientWidth, re-measured on resize via ResizeObserver), so the
       chevron only becomes active when something is hidden;
     - toggles between `truncate` (one clean line) and
       `whitespace-pre-wrap break-words` (full text, wrapped);
     - animates only the text wrapper's height (28px -> auto) with a simple
       tween. No `layout` prop, so there is no scale/bounce.
   ═══════════════════════════════════════════════════════════════════════ */
function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (id: number, currentStatus: boolean) => void;
  onDelete: (id: number) => void;
}) {
  // expanded = row is open (drives the height animation)
  // showFull = text is in wrap mode. True immediately on open, false only
  //            AFTER the close animation ends so the text doesn't jump.
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Only measure in collapsed (truncate) mode.
    if (showFull) return;

    const el = textRef.current;
    if (!el) return;

    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [todo.task, showFull]);

  const canExpand = overflowing || expanded;

  const toggleExpand = () => {
    if (expanded) {
      setExpanded(false); // showFull turns false when the animation completes
    } else {
      setShowFull(true);
      setExpanded(true);
    }
  };

  const shortLabel = todo.task.length > 48 ? `${todo.task.slice(0, 48)}…` : todo.task;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group flex items-start gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-2.5 hover:border-[var(--line-strong)] hover:bg-[var(--panel)]"
    >
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        <motion.div
          initial={false}
          animate={{ height: expanded ? 'auto' : 28 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => {
            if (!expanded) setShowFull(false);
          }}
          className="min-w-0 flex-1 overflow-hidden"
        >
          <span
            ref={textRef}
            onClick={() => canExpand && toggleExpand()}
            className={`block py-1.5 pl-1 text-xs leading-4 ${
              showFull ? 'whitespace-pre-wrap break-words' : 'truncate'
            } ${canExpand ? 'cursor-pointer' : ''} ${
              todo.is_completed
                ? 'text-[var(--muted)] line-through'
                : 'font-medium text-[var(--text)]'
            }`}
          >
            {todo.task}
          </span>
        </motion.div>

        {todo.recurrence !== 'none' && (
          <span className="mt-1.5 flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--accent-wash)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--accent-soft)]">
            <Repeat className="h-2 w-2" />
            {todo.recurrence === 'daily' ? 'Daily' : 'Weekly'}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={toggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide full task' : 'Show full task'}
          aria-hidden={!canExpand}
          tabIndex={canExpand ? 0 : -1}
          className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--line)] hover:text-[var(--text)] ${
            canExpand ? '' : 'invisible'
          }`}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        <button
          onClick={() => onToggle(todo.id, todo.is_completed)}
          aria-label={
            todo.is_completed ? `Mark "${shortLabel}" as not done` : `Mark "${shortLabel}" as done`
          }
          className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl transition ${
            todo.is_completed
              ? 'bg-[var(--up)] text-white'
              : 'border border-[var(--line-strong)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--up)] hover:text-[var(--up)]'
          }`}
        >
          <Check className="h-3 w-3" />
        </button>

        <button
          onClick={() => onDelete(todo.id)}
          aria-label={`Delete "${shortLabel}"`}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl border border-[var(--line-strong)] bg-[var(--panel)] text-[var(--muted)] transition hover:border-[var(--over)] hover:bg-[color-mix(in_srgb,var(--over)_14%,transparent)] hover:text-[var(--over)]"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

// NOTE ON AUTH: this page no longer runs its own getSession()/onAuthStateChange
// check. app/(dashboard)/layout.tsx (ProtectedLayout) already gates every route
// in this group behind an auth check and doesn't render children until it
// resolves.

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [budgetRow, setBudgetRow] = useState<BudgetRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'sub' | 'todo' | 'weight'>('sub');

  const openModal = (tab: 'sub' | 'todo' | 'weight') => {
    setModalTab(tab);
    setIsModalOpen(true);
  };

  // Resolve the current user once; every fetch below depends on it.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Reopens completed recurring todos once their cycle (day/week) has passed.
  const resetDueRecurringTodos = useCallback(async (currentTodos: Todo[]) => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const due = currentTodos.filter((todo) => {
      if (!todo.is_completed || todo.recurrence === 'none' || !todo.last_completed_at) {
        return false;
      }
      const elapsed = now - new Date(todo.last_completed_at).getTime();
      if (todo.recurrence === 'daily') return elapsed >= DAY_MS;
      if (todo.recurrence === 'weekly') return elapsed >= 7 * DAY_MS;
      return false;
    });

    if (due.length === 0) return;

    setTodos((prev) =>
      prev.map((todo) => (due.some((d) => d.id === todo.id) ? { ...todo, is_completed: false } : todo))
    );

    await Promise.all(
      due.map((todo) => supabase.from('todos').update({ is_completed: false }).eq('id', todo.id))
    );
  }, []);

  // Data Fetching — user-scoped, run once on mount (and once userId resolves)
  const fetchInitialData = useCallback(async () => {
    if (!userId) return;

    try {
      const [weightRes, todoRes, subRes, budgetRes] = await Promise.all([
        supabase
          .from('weight_logs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        supabase
          .from('todos')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('budgets').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      if (weightRes.error) console.error('Weight Logs Fetch Error:', weightRes.error.message);
      else setWeights((weightRes.data as WeightLog[]) || []);

      if (todoRes.error) console.error('Todos Fetch Error:', todoRes.error.message);
      else {
        const fetchedTodos = (todoRes.data as Todo[]) || [];
        setTodos(fetchedTodos);
        resetDueRecurringTodos(fetchedTodos);
      }

      if (subRes.error) console.error('Subscriptions Fetch Error:', subRes.error.message);
      else setSubscriptions((subRes.data as Subscription[]) || []);

      if (budgetRes.error) console.error('Budget Fetch Error:', budgetRes.error.message);
      else setBudgetRow((budgetRes.data as BudgetRow) || null);
    } catch (error) {
      console.error('Unexpected fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, resetDueRecurringTodos]);

  useEffect(() => {
    if (!userId) return;
    fetchInitialData();

    // Targeted realtime handlers instead of one fetchInitialData() call wired
    // to all four tables. Each channel is also explicitly filtered to this
    // user's rows — RLS already enforces it server-side, but the filter means
    // the socket doesn't even carry rows we'd throw away.
    const userFilter = `user_id=eq.${userId}`;

    const channel = supabase
      .channel(`db-changes-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weight_logs', filter: userFilter },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setWeights((prev) => [...prev, payload.new as WeightLog]);
          } else if (payload.eventType === 'DELETE') {
            setWeights((prev) => prev.filter((w) => w.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as WeightLog;
            setWeights((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos', filter: userFilter },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTodos((prev) => {
              if (prev.some((t) => t.id === (payload.new as Todo).id)) return prev;
              return [payload.new as Todo, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setTodos((prev) => prev.filter((t) => t.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Todo;
            setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: userFilter },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSubscriptions((prev) => {
              if (prev.some((s) => s.id === (payload.new as Subscription).id)) return prev;
              return [payload.new as Subscription, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setSubscriptions((prev) => prev.filter((s) => s.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Subscription;
            setSubscriptions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets', filter: userFilter },
        (payload) => {
          if (payload.eventType === 'DELETE') setBudgetRow(null);
          else setBudgetRow(payload.new as BudgetRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchInitialData]);

  const toggleTodoStatus = useCallback(
    async (id: number, currentStatus: boolean) => {
      const previousTodos = todos;
      const nowIso = new Date().toISOString();
      const markingComplete = !currentStatus;

      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                is_completed: markingComplete,
                last_completed_at: markingComplete ? nowIso : todo.last_completed_at,
              }
            : todo
        )
      );

      const { error } = await supabase
        .from('todos')
        .update({
          is_completed: markingComplete,
          ...(markingComplete ? { last_completed_at: nowIso } : {}),
        })
        .eq('id', id);

      if (error) {
        console.error('Error toggling todo status:', error.message);
        setTodos(previousTodos);
      }
    },
    [todos]
  );

  const deleteTodo = useCallback(
    async (id: number) => {
      const previousTodos = todos;
      setTodos((prev) => prev.filter((todo) => todo.id !== id));

      const { error } = await supabase.from('todos').delete().eq('id', id);

      if (error) {
        console.error('Error deleting todo:', error.message);
        setTodos(previousTodos);
      }
    },
    [todos]
  );

  const totalBalance = subscriptions.reduce(
    (sum: number, sub: Subscription) => sum + Number(sub.cost || 0),
    0
  );

  const budgetIncome = Number(budgetRow?.income) || 0;
  const manualExpensesTotal = budgetRow
    ? Number(budgetRow.housing || 0) +
      Number(budgetRow.food || 0) +
      Number(budgetRow.transport || 0) +
      Number(budgetRow.utilities || 0) +
      Number(budgetRow.other || 0)
    : 0;
  const totalMonthlyExpenses = manualExpensesTotal + totalBalance;
  const availableBalance = budgetIncome - totalMonthlyExpenses;
  const budgetUsagePercent =
    budgetIncome > 0 ? Math.min(Math.round((totalMonthlyExpenses / budgetIncome) * 100), 100) : 0;

  const chartData = weights.map((w) => ({
    date: new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: w.weight,
  }));

  const weightStats = (() => {
    if (weights.length === 0) return { highest: null, lowest: null, change: null };
    const round1 = (n: number) => Math.round(n * 10) / 10;
    const values = weights.map((w) => w.weight);
    const highest = round1(Math.max(...values));
    const lowest = round1(Math.min(...values));
    const change = weights.length > 1 ? round1(weights[weights.length - 1].weight - weights[0].weight) : 0;
    return { highest, lowest, change };
  })();

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight : null;
  const prevWeight = weights.length > 1 ? weights[weights.length - 2].weight : null;
  const lastDelta =
    latestWeight !== null && prevWeight !== null
      ? Math.round((latestWeight - prevWeight) * 10) / 10
      : null;
  const lastLoggedLabel =
    weights.length > 0
      ? new Date(weights[weights.length - 1].created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : null;

  const taskStats = (() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.is_completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const daily = todos.filter((t) => t.recurrence === 'daily').length;
    const weekly = todos.filter((t) => t.recurrence === 'weekly').length;
    const oneOff = total - daily - weekly;
    return { total, completed, percent, daily, weekly, oneOff };
  })();
  if (!userId || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      <div className="flex flex-1">
        <main className="flex-1 min-w-0 w-full">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <h1 className="text-2xl font-bold text-[var(--text)]">Dashboard</h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Welcome Back Hassan<span className="ml-1">👋</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <LiveClock />
                <div className="hidden sm:flex h-9 items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--panel)] px-3.5 text-xs font-medium text-[var(--accent-soft)] shadow-sm">
                  <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-wash)]">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-soft)] opacity-40" />
                    <Activity className="relative h-3 w-3 text-[var(--accent-soft)] animate-pulse" />
                  </div>
                  <span className="font-semibold text-[11px] tracking-wide">Realtime Sync</span>
                </div>
                <button
                  onClick={() => openModal('sub')}
                  className="group flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md"
                >
                  <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" />
                  <span>Add New</span>
                </button>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[1.35fr_0.85fr_0.85fr]">
              {/* ───────────── Weight Tracker ───────────── */}
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow)] sm:p-6 lg:col-span-2 xl:col-span-1"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Personal Analytics
                    </p>
                    <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                      Weight Tracker
                    </h2>
                  </div>
                  <button
                    aria-label="More weight tracker options"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-2)] text-[var(--muted)] transition hover:bg-[var(--line)] hover:text-[var(--text)]"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>

                {/* Hero stats: current weight — no chart here, avoids duplicating the graph below */}
                <div
                  className="relative mb-5 overflow-hidden rounded-[24px] border border-[var(--line)] p-6"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 62%), var(--panel-2)',
                  }}
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Current Weight
                    </p>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted)]">
                      <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--up)] opacity-50" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
                      </span>
                      Live
                    </span>
                  </div>

                  <p className="relative z-10 mt-3.5 flex items-baseline gap-1.5 leading-[0.9] tracking-[-0.04em] text-[var(--text)]">
                    <span className="text-[32px] font-bold">{latestWeight ?? '—'}</span>
                    <span className="text-base font-semibold text-[var(--muted)]">kg</span>
                  </p>

                  <div className="relative z-10 mt-2.5 flex items-center gap-2">
                    {lastDelta === null ? (
                      <span className="text-[10px] font-medium text-[var(--muted)]">
                        {weights.length === 0 ? 'No entries yet' : 'First entry'}
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          lastDelta === 0
                            ? 'text-[var(--muted)]'
                            : lastDelta > 0
                            ? 'text-[var(--over)]'
                            : 'text-[var(--up)]'
                        }`}
                      >
                        {lastDelta > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : lastDelta < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                        {lastDelta > 0 ? '+' : ''}
                        {lastDelta} kg
                      </span>
                    )}
                    {lastLoggedLabel && (
                      <span className="text-[10px] text-[var(--muted)]">Since {lastLoggedLabel}</span>
                    )}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                        Weight Progress
                      </h3>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">Recorded over time</p>
                    </div>
                    <button className="flex cursor-pointer items-center gap-1 rounded-full bg-[var(--panel-2)] px-2.5 py-1 text-[9px] font-medium text-[var(--muted)] transition hover:text-[var(--text)]">
                      All time
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  <div className="h-[230px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-soft)" stopOpacity={0.32} />
                            <stop offset="95%" stopColor="var(--accent-soft)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9, fill: 'var(--muted)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid var(--line)',
                            background: 'color-mix(in srgb, var(--panel) 90%, transparent)',
                            backdropFilter: 'blur(6px)',
                            boxShadow: 'var(--shadow)',
                            fontSize: '11px',
                            color: 'var(--text)',
                            padding: '8px 12px',
                          }}
                          labelStyle={{ fontSize: '10px', color: 'var(--muted)', marginBottom: 2 }}
                          itemStyle={{ padding: 0 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="weight"
                          stroke="var(--accent)"
                          strokeWidth={2}
                          fill="url(#colorWeight)"
                          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--panel)' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="border-t border-[var(--line)] pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Recent Logs
                    </h3>
                    <span className="text-[10px] text-[var(--muted)]">Latest entries</span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...weights]
                      .reverse()
                      .slice(0, 2)
                      .map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3 transition hover:border-[var(--line-strong)] hover:bg-[var(--panel)]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--panel)] shadow-sm">
                              <Scale className="h-3.5 w-3.5 text-[var(--accent-soft)]" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-[var(--text)]">Weight Log</p>
                              <p className="text-[9px] text-[var(--muted)]">Recorded</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-[var(--text)]">{w.weight} kg</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="mt-5 border-t border-[var(--line)] pt-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Insights
                  </h3>

                  {weights.length === 0 ? (
                    <div className="flex min-h-[80px] items-center justify-center rounded-2xl bg-[var(--panel-2)] text-center">
                      <p className="text-[10px] text-[var(--muted)]">
                        Log a few weights to see insights here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                        <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--panel)] shadow-sm">
                          <TrendingUp className="h-3.5 w-3.5 text-[var(--over)]" />
                        </div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">Highest</p>
                        <p className="mt-0.5 text-sm font-bold text-[var(--text)]">
                          {weightStats.highest} kg
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                        <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--panel)] shadow-sm">
                          <TrendingDown className="h-3.5 w-3.5 text-[var(--up)]" />
                        </div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">Lowest</p>
                        <p className="mt-0.5 text-sm font-bold text-[var(--text)]">
                          {weightStats.lowest} kg
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
                        <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--panel)] shadow-sm">
                          {weightStats.change === null || weightStats.change === 0 ? (
                            <Minus className="h-3.5 w-3.5 text-[var(--muted)]" />
                          ) : weightStats.change > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-[var(--over)]" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-[var(--up)]" />
                          )}
                        </div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
                          Net Change
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-bold ${
                            weightStats.change === null || weightStats.change === 0
                              ? 'text-[var(--text)]'
                              : weightStats.change > 0
                              ? 'text-[var(--over)]'
                              : 'text-[var(--up)]'
                          }`}
                        >
                          {weightStats.change !== null && weightStats.change > 0 ? '+' : ''}
                          {weightStats.change ?? 0} kg
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>

              {/* ───────────── Middle column: Budget + Tasks ───────────── */}
              <div className="flex min-w-0 flex-col gap-5">
                <motion.section
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  className="rounded-[26px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Overview
                      </p>
                      <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                        Monthly Budget
                      </h3>
                    </div>
                    <Link
                      href="/budget"
                      aria-label="Open budget page"
                      title="Open budget page"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--panel-2)] text-[var(--muted)] transition hover:bg-[var(--line)] hover:text-[var(--text)]"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="mb-3 flex items-end justify-between">
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-[var(--muted)]">
                        Total spent
                      </p>
                      <p className="text-[26px] font-bold tracking-[-0.05em] text-[var(--text)]">
                        ${totalMonthlyExpenses.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">Active</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                        {subscriptions.length}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 flex items-center justify-between text-[9px] text-[var(--muted)]">
                    <span>Subscriptions ${totalBalance.toLocaleString()}</span>
                    <span>Budget page ${manualExpensesTotal.toLocaleString()}</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-2)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${budgetUsagePercent}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className="h-full rounded-full bg-[var(--accent)]"
                    />
                  </div>

                  {budgetIncome === 0 && (
                    <p className="mt-2 text-[9px] text-[var(--muted)]">
                      Set your monthly income on the Budget page to see real usage.
                    </p>
                  )}
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex min-h-[360px] flex-1 flex-col rounded-[26px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--up)_14%,transparent)]">
                        <CheckSquare className="h-3.5 w-3.5 text-[var(--up)]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text)]">Tasks</h3>
                        <p className="text-[9px] text-[var(--muted)]">Stay on top of your day</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openModal('todo')}
                      className="cursor-pointer rounded-full border border-[color-mix(in_srgb,var(--up)_30%,transparent)] bg-[color-mix(in_srgb,var(--up)_14%,transparent)] px-3 py-1.5 text-[9px] font-semibold text-[var(--up)] transition hover:bg-[color-mix(in_srgb,var(--up)_22%,transparent)]"
                    >
                      {todos.filter((t) => !t.is_completed).length} Pending
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    <AnimatePresence>
                      {todos.length === 0 ? (
                        <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel-2)]">
                            <CheckSquare className="h-5 w-5 text-[var(--muted)]" />
                          </div>
                          <p className="text-xs font-medium text-[var(--muted)]">No pending tasks</p>
                          <p className="mt-1 max-w-[180px] text-[9px] leading-4 text-[var(--muted)]">
                            Add a task to keep your day organized.
                          </p>
                        </div>
                      ) : (
                        todos.map((todo) => (
                          <TodoRow
                            key={todo.id}
                            todo={todo}
                            onToggle={toggleTodoStatus}
                            onDelete={deleteTodo}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>

                  {todos.length > 0 && (
                    <div className="mt-4 border-t border-[var(--line)] pt-4">
                      <div className="mb-2 flex items-center justify-between text-[9px]">
                        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                          Completion
                        </span>
                        <span className="font-semibold text-[var(--text)]">
                          {taskStats.completed}/{taskStats.total} ({taskStats.percent}%)
                        </span>
                      </div>
                      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--panel-2)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${taskStats.percent}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="h-full rounded-full bg-[var(--up)]"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-[var(--muted)]">
                        <span className="flex items-center gap-1">
                          <Repeat className="h-2.5 w-2.5 text-[var(--accent-soft)]" />
                          {taskStats.daily} daily
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat className="h-2.5 w-2.5 text-[var(--accent-soft)]" />
                          {taskStats.weekly} weekly
                        </span>
                        <span>{taskStats.oneOff} one-off</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => openModal('todo')}
                    className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--line-strong)] py-3 text-[10px] font-semibold text-[var(--muted)] transition hover:border-[var(--accent-soft)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                  >
                    <Plus className="h-3 w-3" />
                    Add new task
                  </button>
                </motion.section>
              </div>

              {/* ───────────── Right column: Balance card + Subscriptions ───────────── */}
              <div className="flex min-w-0 flex-col gap-5">
                <motion.section
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="group relative min-h-[214px] overflow-hidden rounded-[26px] p-6 text-white shadow-[0_24px_50px_-18px_rgba(82,39,255,0.65)] ring-1 ring-white/15 transition-transform duration-300 hover:-translate-y-0.5"
                  style={{
                    background:
                      'linear-gradient(135deg, #6a45ff 0%, #4a1fe8 36%, #2a0f8f 70%, #160a4d 100%)',
                  }}
                >
                  {/* Softly glowing corners — subtle, not decorative */}
                  <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-[64px]" />
                  <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-cyan-300/10 blur-[64px]" />

                  {/* Thin concentric lines — max 2, low opacity */}
                  <svg
                    className="pointer-events-none absolute -bottom-20 -right-12 h-72 w-72 text-white/[0.08]"
                    viewBox="0 0 200 200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <circle cx="100" cy="100" r="55" />
                    <circle cx="100" cy="100" r="85" />
                  </svg>

                  {/* Shine sweep on hover */}
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full" />

                  <div className="relative z-10 flex h-full min-h-[166px] flex-col justify-between">
                    {/* Top: balance + VISA */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/60">
                          Available Balance
                        </p>
                        <p
  className={`mt-2 leading-none tracking-[-0.03em] ${
    availableBalance < 0 ? 'text-[#ffb4ab]' : 'text-white'
  }`}
>
  <span className="text-[27px] font-bold tabular-nums">
    {availableBalance < 0 ? '-$' : '$'}
    {Math.abs(availableBalance).toFixed(2)}
  </span>
</p>
                        {budgetIncome > 0 ? (
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/60">
                            <span>${budgetIncome.toLocaleString()} income</span>
                            <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
                            <span>{budgetUsagePercent}% used</span>
                          </div>
                        ) : (
                          <p className="mt-1.5 text-[10px] text-white/60">Set income on Budget page</p>
                        )}
                      </div>
                      <span className="text-[14px] font-bold italic tracking-[0.08em] text-white/60">
                        VISA
                      </span>
                    </div>

                    {/* Middle: chip + contactless */}
                    <div className="my-3 flex items-center gap-4">
                      <div className="relative h-6 w-8 overflow-hidden rounded-[6px] bg-gradient-to-br from-amber-100/90 via-amber-200/90 to-amber-400/80 shadow-inner">
                        <span className="absolute inset-x-0 top-1/3 h-px bg-black/20" />
                        <span className="absolute inset-x-0 top-2/3 h-px bg-black/20" />
                        <span className="absolute inset-y-0 left-1/3 w-px bg-black/20" />
                        <span className="absolute inset-y-0 left-2/3 w-px bg-black/20" />
                      </div>
                      <Wifi className="h-4 w-4 rotate-90 text-white/45" />
                    </div>

                    {/* Bottom: number + holder + expiry */}
                    <div>
                      <p className="mb-3 font-mono text-[12px] tracking-[0.18em] text-white/70">
                        •••• •••• •••• {CARD_LAST4}
                      </p>
                      <div className="flex items-end justify-between">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-wider text-white/50">Card holder</p>
                          <p className="mt-0.5 truncate text-[12px] font-semibold text-white/95">
                            {CARD_HOLDER}
                          </p>
                        </div>
                        <div className="shrink-0 pl-4 text-right">
                          <p className="text-[9px] uppercase tracking-wider text-white/50">Expires</p>
                          <p className="mt-0.5 text-[12px] font-semibold text-white/95">{CARD_EXPIRES}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>

                <motion.section
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex min-h-[360px] flex-1 flex-col rounded-[26px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-wash)]">
                        <CreditCard className="h-3.5 w-3.5 text-[var(--accent-soft)]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text)]">Subscriptions</h3>
                        <p className="text-[9px] text-[var(--muted)]">Recurring expenses</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openModal('sub')}
                      aria-label="Add new subscription"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[var(--panel-2)] text-[var(--muted)] transition hover:bg-[var(--accent-wash)] hover:text-[var(--accent-soft)]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mb-4 rounded-2xl bg-[var(--panel-2)] p-3.5">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
                          Monthly total
                        </p>
                        <p className="mt-1 text-xl font-bold tracking-[-0.04em] text-[var(--text)]">
                          ${totalBalance.toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[9px] font-medium text-[var(--muted)] shadow-sm">
                        {subscriptions.length} active
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {subscriptions.length === 0 ? (
                      <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel-2)]">
                          <CreditCard className="h-5 w-5 text-[var(--muted)]" />
                        </div>
                        <p className="text-xs font-medium text-[var(--muted)]">No subscriptions</p>
                        <p className="mt-1 text-[9px] text-[var(--muted)]">
                          Your recurring expenses will appear here.
                        </p>
                      </div>
                    ) : (
                      subscriptions.map((sub) => (
                        <div
                          key={sub.id}
                          className="group flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 transition hover:border-[var(--line-strong)] hover:bg-[var(--panel-2)]"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <SubscriptionIcon name={sub.name} sizeClassName="h-8 w-8" />
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold capitalize text-[var(--text)]">
                                {sub.name}
                              </p>
                              <p className="mt-0.5 text-[8px] text-[var(--muted)]">Debit Card</p>
                            </div>
                          </div>
                          <span className="ml-3 shrink-0 rounded-xl bg-[var(--accent-wash)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--accent-soft)]">
                            ${sub.cost}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => openModal('sub')}
                    className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3 text-[10px] font-semibold text-white transition hover:opacity-90"
                  >
                    <Plus className="h-3 w-3" />
                    Add New Subscription
                  </button>
                </motion.section>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-5 flex flex-col gap-3 rounded-[22px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5 shadow-[var(--shadow)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--up)_14%,transparent)]">
                  <Activity className="h-3 w-3 text-[var(--up)]" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text)]">Everything is up to date</p>
                  <p className="text-[8px] text-[var(--muted)]">
                    Dashboard is synced with your latest data
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-[var(--muted)]">
                <span>{weights.length} weight logs</span>
                <span className="hidden h-1 w-1 rounded-full bg-[var(--line-strong)] sm:inline-block" />
                <span>{todos.length} tasks</span>
                <span className="hidden h-1 w-1 rounded-full bg-[var(--line-strong)] sm:inline-block" />
                <span>{subscriptions.length} subscriptions</span>
              </div>
            </motion.div>
          </div>
        </main>
      </div>

      <AddEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchInitialData}
        defaultTab={modalTab}
      />
    </div>
  );
}