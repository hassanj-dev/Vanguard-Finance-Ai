"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SubscriptionIcon from "@/app/components/SubscriptionIcon";
import {
  CalendarDays,
  CreditCard,
  DollarSign,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  ChevronRight,
} from "lucide-react";

interface Subscription {
  id: number;
  user_id: string;
  name: string;
  cost: number;
  renewal_date: string;
  created_at?: string;
}

// FIXED (Code quality): this file used to define its own local `ServiceLogo`
// component that duplicated SubscriptionIcon.tsx almost line-for-line (and
// was hardcoded to light-mode colors). It now reuses the shared, theme-aware
// SubscriptionIcon component instead of maintaining two copies of the same
// logic.

export default function Subscriptions() {
  const [userId, setUserId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // =========================================
  // RESOLVE CURRENT USER
  // =========================================
  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setErrorMessage("Your session expired. Please log in again.");
        return;
      }
      setUserId(data.user.id);
    });
  }, []);

  // =========================================
  // FETCH + REALTIME (this user's rows only)
  // =========================================
  useEffect(() => {
    if (!userId) return;

    const fetchSubscriptions = async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching subscriptions:", error.message);
        setErrorMessage("Couldn't load subscriptions. Please refresh.");
        return;
      }

      setSubscriptions(data || []);
    };

    fetchSubscriptions();

    const channel = supabase
      .channel("subscriptions_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSubscriptions((prev) => {
              if (prev.some((sub) => sub.id === (payload.new as Subscription).id)) {
                return prev;
              }
              return [payload.new as Subscription, ...prev];
            });
          }

          if (payload.eventType === "DELETE") {
            setSubscriptions((prev) =>
              prev.filter((sub) => sub.id !== payload.old.id)
            );
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Subscription;
            setSubscriptions((prev) =>
              prev.map((sub) => (sub.id === updated.id ? updated : sub))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // =========================================
  // ADD SUBSCRIPTION
  // =========================================
  const handleAddSubscription = async () => {
    const parsedCost = Number(cost);
    if (!userId || !name.trim() || !cost || Number.isNaN(parsedCost) || isAdding) return;

    setIsAdding(true);
    setErrorMessage(null);

    const { error } = await supabase.from("subscriptions").insert([
      {
        user_id: userId,
        name: name.trim(),
        cost: parsedCost,
        renewal_date: renewalDate || new Date().toISOString().split("T")[0],
      },
    ]);

    if (error) {
      console.error("Error adding subscription:", error.message);
      setErrorMessage("Couldn't add that subscription. Please try again.");
      setIsAdding(false);
      return;
    }

    setName("");
    setCost("");
    setRenewalDate("");
    setIsAdding(false);
  };

  // =========================================
  // DELETE SUBSCRIPTION
  // =========================================
  const handleDeleteSubscription = async (id: number) => {
    const previousSubscriptions = subscriptions;
    setSubscriptions((prev) => prev.filter((sub) => sub.id !== id));

    const { error } = await supabase.from("subscriptions").delete().eq("id", id);

    if (error) {
      console.error("Error deleting subscription:", error.message);
      setErrorMessage("Couldn't delete that subscription. Please try again.");
      setSubscriptions(previousSubscriptions);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddSubscription();
    }
  };

  // =========================================
  // CALCULATIONS
  // =========================================
  const totalMonthlyCost = subscriptions.reduce(
    (sum, sub) => sum + Number(sub.cost), 0
  );
  const yearlyCost = totalMonthlyCost * 12;
  const averageCost = subscriptions.length > 0 ? totalMonthlyCost / subscriptions.length : 0;

  // renewal_date is a date-only string ("YYYY-MM-DD"), which `new Date(...)`
  // parses as UTC midnight. Comparing it against a LOCAL midnight Date
  // caused off-by-one-day misclassification in negative-UTC-offset
  // timezones. Comparing the date strings directly sidesteps the timezone
  // conversion entirely.
  const upcomingSubscription = useMemo(() => {
    if (subscriptions.length === 0) return null;

    const todayStr = new Date().toISOString().split("T")[0];

    const upcoming = [...subscriptions]
      .filter((sub) => sub.renewal_date >= todayStr)
      .sort((a, b) => a.renewal_date.localeCompare(b.renewal_date));

    return upcoming[0] || subscriptions[0];
  }, [subscriptions]);

  const formatDate = (date: string) => {
    if (!date) return "No date";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC", // date-only string, display it as-typed, not shifted
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--muted)]">Personal finance</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
              Subscriptions
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Keep track of your recurring expenses.</p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Monthly spending</p>
              <p className="text-lg font-bold text-[var(--text)]">${totalMonthlyCost.toFixed(2)}</p>
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

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
              <DollarSign size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Monthly cost</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">${totalMonthlyCost.toFixed(2)}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]">
              <TrendingUp size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Yearly cost</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">${yearlyCost.toFixed(2)}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-[var(--warn)]">
              <CreditCard size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Active services</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">{subscriptions.length}</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--up)_14%,transparent)] text-[var(--up)]">
              <Wallet size={19} />
            </div>
            <p className="text-sm text-[var(--muted)]">Average / service</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">${averageCost.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">Your subscriptions</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">Manage your recurring payments.</p>
              </div>
              <span className="rounded-full bg-[var(--accent-wash)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-soft)]">
                {subscriptions.length} active
              </span>
            </div>

            <div className="mb-5 rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--panel-2)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-wash)] text-[var(--accent-soft)]">
                  <Plus size={16} />
                </div>
                <p className="text-xs font-semibold text-[var(--text)]">Add subscription</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Service name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={80}
                  className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)] focus:ring-2 focus:ring-[var(--accent-wash)]"
                />

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Monthly cost"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] py-2.5 pl-7 pr-3 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)] focus:ring-2 focus:ring-[var(--accent-wash)]"
                  />
                </div>

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={renewalDate}
                    onChange={(e) => setRenewalDate(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent-soft)] focus:ring-2 focus:ring-[var(--accent-wash)]"
                  />
                  <button
                    onClick={handleAddSubscription}
                    disabled={isAdding || !name.trim() || !cost || Number.isNaN(Number(cost))}
                    className="rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isAdding ? "..." : "Add"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {subscriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] py-14 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-wash)] text-[var(--accent-soft)]">
                    <CreditCard size={25} />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text)]">No subscriptions yet</h3>
                  <p className="mt-1 max-w-xs text-xs text-[var(--muted)]">
                    Add your recurring services above to start tracking your spending.
                  </p>
                </div>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="group flex items-center gap-3 rounded-2xl border border-transparent bg-[var(--panel-2)] p-4 transition hover:border-[var(--line)] hover:bg-[var(--panel)] hover:shadow-sm"
                  >
                    <SubscriptionIcon name={sub.name} sizeClassName="h-11 w-11" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{sub.name}</p>
                        <span className="hidden rounded-full bg-[color-mix(in_srgb,var(--up)_14%,transparent)] px-2 py-0.5 text-[9px] font-semibold text-[var(--up)] sm:block">
                          ACTIVE
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <CalendarDays size={11} className="text-[var(--muted)]" />
                        <p className="text-[11px] text-[var(--muted)]">
                          Renews {formatDate(sub.renewal_date)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-[var(--text)]">
                        ${Number(sub.cost).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[var(--muted)]">per month</p>
                    </div>

                    <button
                      onClick={() => handleDeleteSubscription(sub.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] opacity-0 transition hover:bg-[color-mix(in_srgb,var(--over)_12%,transparent)] hover:text-[var(--over)] group-hover:opacity-100"
                      aria-label={`Delete ${sub.name}`}
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
                <DollarSign size={23} />
              </div>
              <p className="text-xs font-medium text-white/70">MONTHLY SPENDING</p>
              <h3 className="mt-2 text-3xl font-bold">${totalMonthlyCost.toFixed(2)}</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                That&apos;s approximately{" "}
                <span className="font-bold text-white">${yearlyCost.toFixed(2)}</span> per year.
              </p>
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <TrendingUp size={15} />
                <span className="text-xs">Track your recurring expenses</span>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text)]">Next renewal</h3>
                <CalendarDays size={16} className="text-[var(--accent-soft)]" />
              </div>

              {upcomingSubscription ? (
                <div>
                  <div className="flex items-center gap-3">
                    <SubscriptionIcon name={upcomingSubscription.name} sizeClassName="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">
                        {upcomingSubscription.name}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">
                        {formatDate(upcomingSubscription.renewal_date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--panel-2)] px-3 py-3">
                    <span className="text-xs text-[var(--muted)]">Renewal amount</span>
                    <span className="text-sm font-bold text-[var(--text)]">
                      ${Number(upcomingSubscription.cost).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-5 text-center">
                  <p className="text-xs text-[var(--muted)]">No upcoming renewals</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}