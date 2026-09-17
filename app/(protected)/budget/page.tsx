"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Wallet,
  PiggyBank,
  Home,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Plus,
  Target,
} from "lucide-react";

interface BudgetRow {
  id: number;
  user_id: string;
  income: number;
  housing: number;
  food: number;
  transport: number;
  utilities: number;
  other: number;
  savings_goal: number;
}

export default function BudgetPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [budgetId, setBudgetId] = useState<number | null>(null);
  const [income, setIncome] = useState("");
  const [housing, setHousing] = useState("");
  const [food, setFood] = useState("");
  const [transport, setTransport] = useState("");
  const [utilities, setUtilities] = useState("");
  const [other, setOther] = useState("");
  const [savingsGoal, setSavingsGoal] = useState("");

  // Live total pulled from the subscriptions table (read-only here)
  const [subscriptionsCost, setSubscriptionsCost] = useState(0);
  const [subscriptionsCount, setSubscriptionsCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  // =========================================
  // RESOLVE CURRENT USER FIRST
  // =========================================
  // Every query below depends on this. ProtectedLayout already guarantees
  // a session exists by the time this page renders, so `user` should never
  // be null here in practice — but we still guard for it defensively.
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setErrorMessage("Your session expired. Please log in again.");
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
    });
  }, []);

  // =========================================
  // LOAD EXISTING BUDGET (this user's row only)
  // =========================================
  useEffect(() => {
    if (!userId) return;

    const fetchBudget = async () => {
      // One row per user (enforced by a unique constraint on user_id in
      // the DB migration), so no more order-by-updated_at/.limit(1) hack.
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading budget:", error.message);
        setErrorMessage("Couldn't load your saved budget.");
        setLoading(false);
        return;
      }

      if (data) {
        const row = data as BudgetRow;
        setBudgetId(row.id);
        setIncome(String(row.income ?? ""));
        setHousing(String(row.housing ?? ""));
        setFood(String(row.food ?? ""));
        setTransport(String(row.transport ?? ""));
        setUtilities(String(row.utilities ?? ""));
        setOther(String(row.other ?? ""));
        setSavingsGoal(String(row.savings_goal ?? ""));
      }

      setLoading(false);
    };

    fetchBudget();
  }, [userId]);

  // =========================================
  // SYNC SUBSCRIPTIONS TOTAL (LIVE, this user's rows only)
  // =========================================
  useEffect(() => {
    if (!userId) return;

    const fetchSubscriptionsTotal = async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("cost")
        .eq("user_id", userId);

      if (error) {
        console.error("Error loading subscriptions total:", error.message);
        return;
      }

      const total = (data || []).reduce(
        (sum, sub) => sum + Number(sub.cost || 0),
        0
      );
      setSubscriptionsCost(total);
      setSubscriptionsCount((data || []).length);
    };

    fetchSubscriptionsTotal();

    // Refetch whenever a subscription is added, edited, or removed elsewhere
    // in the app. RLS means this channel only ever receives this user's rows.
    const channel = supabase
      .channel("budget-subscriptions-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        () => fetchSubscriptionsTotal()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // =========================================
  // CLAMPED SETTERS (no negative values, no NaN)
  // =========================================
  const setClamped =
    (setter: (v: string) => void) => (value: string) => {
      if (value === "") {
        setter("");
        return;
      }
      const num = Number(value);
      if (Number.isNaN(num)) return; // reject non-numeric input silently
      setter(num < 0 ? "0" : value);
    };

  // =========================================
  // SAVE (upsert on user_id, not id)
  // =========================================
  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    setErrorMessage(null);
    setSavedMessage(false);

    const payload = {
      user_id: userId,
      income: Number(income) || 0,
      housing: Number(housing) || 0,
      food: Number(food) || 0,
      transport: Number(transport) || 0,
      utilities: Number(utilities) || 0,
      other: Number(other) || 0,
      savings_goal: Number(savingsGoal) || 0,
      updated_at: new Date().toISOString(),
    };

    // Upsert on the unique user_id constraint added in the migration —
    // this is the correct "one row per user" pattern, replacing the old
    // budgetId-presence check which relied on already having fetched the
    // (globally-shared) latest row.
    const { data, error } = await supabase
      .from("budgets")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("Error saving budget:", error.message);
      setErrorMessage("Couldn't save your budget. Please try again.");
      setSaving(false);
      return;
    }

    if (data) {
      setBudgetId((data as BudgetRow).id);
    }

    setSaving(false);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  // =========================================
  // CALCULATIONS
  // =========================================
  const budget = useMemo(() => {
    const monthlyIncome = Number(income) || 0;
    const housingCost = Number(housing) || 0;
    const foodCost = Number(food) || 0;
    const transportCost = Number(transport) || 0;
    const utilitiesCost = Number(utilities) || 0;
    const otherCost = Number(other) || 0;
    const savings = Number(savingsGoal) || 0;

    const totalExpenses =
      housingCost +
      foodCost +
      transportCost +
      utilitiesCost +
      otherCost +
      subscriptionsCost;

    const remaining = monthlyIncome - totalExpenses;
    const availableAfterSavings = remaining - savings;

    const percentage =
      monthlyIncome > 0
        ? Math.min(
            Math.round(((totalExpenses + savings) / monthlyIncome) * 100),
            100
          )
        : 0;

    return {
      monthlyIncome,
      housingCost,
      foodCost,
      transportCost,
      utilitiesCost,
      otherCost,
      subscriptionsCost,
      totalExpenses,
      remaining,
      savings,
      availableAfterSavings,
      percentage,
    };
  }, [income, housing, food, transport, utilities, other, savingsGoal, subscriptionsCost]);

  // =========================================
  // HELPERS
  // =========================================
  const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;

  const expensePercentage = (amount: number) => {
    if (!budget.monthlyIncome) return 0;
    return Math.min((amount / budget.monthlyIncome) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* ========================================= */}
        {/* HEADER */}
        {/* ========================================= */}
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--muted)]">Personal finance</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Monthly Budget
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Plan your income, expenses, and savings.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Available this month</p>
              <p
                className={`text-lg font-bold ${
                  budget.remaining < 0 ? "text-[var(--over)]" : "text-[var(--text)]"
                }`}
              >
                {formatMoney(budget.remaining)}
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

        {/* ========================================= */}
        {/* STATS */}
        {/* ========================================= */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--up)_14%,transparent)] text-[var(--up)]">
              <DollarSign size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Monthly income</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">
              {formatMoney(budget.monthlyIncome)}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-[var(--warn)]">
              <ShoppingCart size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Total expenses</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">
              {formatMoney(budget.totalExpenses)}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]">
              <PiggyBank size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Savings goal</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">
              {formatMoney(budget.savings)}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
              <TrendingUp size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Left after savings</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                budget.availableAfterSavings < 0 ? "text-[var(--over)]" : "text-[var(--text)]"
              }`}
            >
              {formatMoney(budget.availableAfterSavings)}
            </p>
          </div>
        </div>

        {/* ========================================= */}
        {/* MAIN GRID */}
        {/* ========================================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
                  <Plus size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text)]">Budget allocation</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Enter your expected monthly amounts.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={loading || saving || !userId}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : savedMessage ? "Saved!" : "Save budget"}
              </button>
            </div>

            {loading && (
              <p className="mb-4 text-xs text-[var(--muted)]">Loading your saved budget...</p>
            )}

            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold text-[var(--text)]">
                Monthly income
              </label>
              <div className="relative">
                <DollarSign
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={income}
                  onChange={(e) => setClamped(setIncome)(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] py-3 pl-9 pr-4 text-sm font-medium text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)] focus:bg-[var(--panel)] focus:ring-2 focus:ring-[var(--accent-wash)]"
                />
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Monthly expenses</h3>
              <span className="text-xs text-[var(--muted)]">
                {formatMoney(budget.totalExpenses)} total
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--line-strong)] bg-[var(--accent-wash)] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent-soft)]">
                  <Wallet size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[var(--text)]">Subscriptions</p>
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-2 py-0.5 text-[9px] font-semibold text-[var(--accent-soft)]">
                      AUTO-SYNCED
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {subscriptionsCount} active service{subscriptionsCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--text)]">
                  {formatMoney(subscriptionsCost)}
                </span>
                <span className="text-xs text-[var(--muted)]">/ month</span>
              </div>

              <BudgetInput
                icon={<Home size={17} />}
                iconClass="bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                label="Housing"
                placeholder="Rent, mortgage..."
                value={housing}
                onChange={setClamped(setHousing)}
              />
              <BudgetInput
                icon={<ShoppingCart size={17} />}
                iconClass="bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-[var(--warn)]"
                label="Food & groceries"
                placeholder="Food expenses..."
                value={food}
                onChange={setClamped(setFood)}
              />
              <BudgetInput
                icon={<TrendingUp size={17} />}
                iconClass="bg-[color-mix(in_srgb,var(--up)_14%,transparent)] text-[var(--up)]"
                label="Transportation"
                placeholder="Fuel, rides..."
                value={transport}
                onChange={setClamped(setTransport)}
              />
              <BudgetInput
                icon={<Wallet size={17} />}
                iconClass="bg-[var(--accent-wash)] text-[var(--accent-soft)]"
                label="Utilities"
                placeholder="Electricity, internet..."
                value={utilities}
                onChange={setClamped(setUtilities)}
              />
              <BudgetInput
                icon={<Plus size={17} />}
                iconClass="bg-[var(--panel-2)] text-[var(--muted)]"
                label="Other"
                placeholder="Other expenses..."
                value={other}
                onChange={setClamped(setOther)}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--line-strong)] bg-[var(--accent-wash)] p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel)] text-[var(--accent-soft)] shadow-sm">
                  <Target size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">Monthly savings goal</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    How much would you like to save?
                  </p>
                </div>
              </div>
              <div className="relative">
                <DollarSign
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--accent-soft)]"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={savingsGoal}
                  onChange={(e) => setClamped(setSavingsGoal)(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--panel)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent-soft)] focus:ring-2 focus:ring-[var(--accent-wash)]"
                />
              </div>
            </div>
          </div>

          {/* ========================================= */}
          {/* SIDEBAR */}
          {/* ========================================= */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl bg-[var(--accent)] p-6 text-white shadow-sm">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <PiggyBank size={23} />
              </div>
              <p className="text-xs font-medium text-white/70">BUDGET HEALTH</p>
              <h3 className="mt-2 text-2xl font-bold">
                {budget.availableAfterSavings >= 0 ? "Looking good!" : "Over budget"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                You&apos;ve allocated{" "}
                <span className="font-bold text-white">{budget.percentage}%</span> of your
                income to expenses and savings.
              </p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${budget.percentage}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-white/70">
                <span>Expenses + savings</span>
                <span>{budget.percentage}%</span>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text)]">Expense breakdown</h3>
                <span className="text-xs text-[var(--muted)]">This month</span>
              </div>
              <div className="space-y-5">
                <ExpenseBar
                  label="Subscriptions"
                  value={budget.subscriptionsCost}
                  percentage={expensePercentage(budget.subscriptionsCost)}
                  amount={formatMoney(budget.subscriptionsCost)}
                />
                <ExpenseBar
                  label="Housing"
                  value={budget.housingCost}
                  percentage={expensePercentage(budget.housingCost)}
                  amount={formatMoney(budget.housingCost)}
                />
                <ExpenseBar
                  label="Food & groceries"
                  value={budget.foodCost}
                  percentage={expensePercentage(budget.foodCost)}
                  amount={formatMoney(budget.foodCost)}
                />
                <ExpenseBar
                  label="Transportation"
                  value={budget.transportCost}
                  percentage={expensePercentage(budget.transportCost)}
                  amount={formatMoney(budget.transportCost)}
                />
                <ExpenseBar
                  label="Utilities"
                  value={budget.utilitiesCost}
                  percentage={expensePercentage(budget.utilitiesCost)}
                  amount={formatMoney(budget.utilitiesCost)}
                />
                <ExpenseBar
                  label="Other"
                  value={budget.otherCost}
                  percentage={expensePercentage(budget.otherCost)}
                  amount={formatMoney(budget.otherCost)}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-[var(--text)]">Monthly summary</h3>
              <div className="space-y-3">
                <SummaryRow label="Income" value={formatMoney(budget.monthlyIncome)} />
                <SummaryRow label="Expenses" value={formatMoney(budget.totalExpenses)} />
                <SummaryRow label="Savings" value={formatMoney(budget.savings)} />
                <div className="my-3 border-t border-[var(--line)]" />
                <SummaryRow
                  label="Remaining"
                  value={formatMoney(budget.availableAfterSavings)}
                  bold
                  negative={budget.availableAfterSavings < 0}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetInput({
  icon,
  iconClass,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)] p-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-semibold text-[var(--text)]">{label}</p>
        <input
          type="number"
          min="0"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
        />
      </div>
      <span className="text-xs text-[var(--muted)]">/ month</span>
    </div>
  );
}

function ExpenseBar({
  label,
  value,
  percentage,
  amount,
}: {
  label: string;
  value: number;
  percentage: number;
  amount: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="text-xs font-semibold text-[var(--text)]">{amount}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent-soft)] transition-all"
          style={{ width: `${value > 0 ? Math.max(percentage, 3) : 0}%` }}
        />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold = false,
  negative = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? "font-semibold text-[var(--text)]" : "text-[var(--muted)]"}`}>
        {label}
      </span>
      <span
        className={`text-xs ${bold ? "font-bold" : "font-medium"} ${
          negative ? "text-[var(--over)]" : "text-[var(--text)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}