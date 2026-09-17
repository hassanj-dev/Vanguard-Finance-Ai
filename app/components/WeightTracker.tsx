"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface WeightLog {
  id?: number;
  user_id?: string;
  weight: number;
  created_at?: string;
}

/**
 * FIXED (Critical / Security):
 * This component previously fetched `weight_logs` and inserted new rows
 * with NO `user_id` scoping at all — unlike every other data component in
 * the app (Budget, Subscriptions, TodoList, Dashboard). Depending on your
 * RLS policy that meant either:
 *   - every signed-in user could see every other user's weight logs, or
 *   - every insert from this component silently failed RLS.
 *
 * Both are now fixed by resolving the current user first and scoping every
 * query/insert/realtime-filter to `user_id`, matching the pattern used
 * elsewhere in the app (see Subscriptions.tsx / TodoList.tsx).
 *
 * NOTE: The Dashboard already has its own, more complete weight tracker
 * (chart, highest/lowest/change stats). This standalone component is kept
 * only in case it's mounted elsewhere; if it isn't used anywhere, it's
 * safe to delete instead.
 */
export default function WeightTracker() {
  const [userId, setUserId] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [history, setHistory] = useState<WeightLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setErrorMessage("Your session expired. Please log in again.");
        return;
      }
      setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("weight_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading weight history:", error.message);
        setErrorMessage("Couldn't load your weight history.");
        return;
      }
      setHistory(data || []);
    };

    fetchHistory();

    const channel = supabase
      .channel("weight_tracker_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "weight_logs" },
        (payload) => {
          const row = payload.new as WeightLog;
          if (row.user_id !== userId) return; // extra client-side guard
          setHistory((prev) => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleAddWeight = async () => {
    const parsed = Number(weight);
    if (!userId || !weight || Number.isNaN(parsed) || parsed <= 0 || saving) return;

    setSaving(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("weight_logs")
      .insert([{ user_id: userId, weight: parsed }]);

    if (error) {
      console.error("Error saving weight:", error.message);
      setErrorMessage("Couldn't save your weight. Please try again.");
    } else {
      setWeight("");
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAddWeight();
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-[var(--muted)]">My Weight Tracker</h2>

      {errorMessage && (
        <p className="text-xs text-[var(--over)]">{errorMessage}</p>
      )}

      <div className="text-2xl font-bold text-[var(--text)]">
        {history.length > 0 ? `${history[history.length - 1].weight} kg` : "-- kg"}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 70"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-soft)]"
        />
        <button
          onClick={handleAddWeight}
          disabled={saving || !userId || !weight}
          className="rounded-lg bg-[var(--accent)] px-3 py-1 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}