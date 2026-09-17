'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, AlertCircle } from 'lucide-react';

type EntryTab = 'sub' | 'todo' | 'weight';
type Recurrence = 'none' | 'daily' | 'weekly';

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful insert so the parent can refetch/refresh data. */
  onSuccess: () => void;
  /** Which tab to show when the modal opens. Defaults to 'sub'. */
  defaultTab?: EntryTab;
}

export default function AddEntryModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = 'sub',
}: AddEntryModalProps) {
  const [activeTab, setActiveTab] = useState<EntryTab>(defaultTab);
  const [subName, setSubName] = useState('');
  const [subCost, setSubCost] = useState('');
  const [taskName, setTaskName] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [weightVal, setWeightVal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep the active tab in sync if the parent opens the modal on a different tab
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setErrorMessage(null);
    }
  }, [isOpen, defaultTab]);

  const resetFields = () => {
    setSubName('');
    setSubCost('');
    setTaskName('');
    setRecurrence('none');
    setWeightVal('');
  };

  const handleClose = () => {
    resetFields();
    setErrorMessage(null);
    onClose();
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // RLS now requires every row to carry the owner's user_id (see the
      // 001_add_user_scoping migration) — without this, every insert below
      // gets silently rejected by Postgres's row-level security policies
      // rather than by any check in this component.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Your session expired. Please log in again.');
      }

      if (activeTab === 'sub') {
        const cost = parseFloat(subCost);
        if (!subName.trim() || Number.isNaN(cost)) {
          throw new Error('Enter a name and a valid cost.');
        }
        const { error } = await supabase
          .from('subscriptions')
          .insert([{ user_id: user.id, name: subName.trim(), cost }]);
        if (error) throw error;
      } else if (activeTab === 'todo') {
        if (!taskName.trim()) {
          throw new Error('Enter a task description.');
        }
        const { error } = await supabase
          .from('todos')
          .insert([{ user_id: user.id, task: taskName.trim(), is_completed: false, recurrence }]);
        if (error) throw error;
      } else if (activeTab === 'weight') {
        const weight = parseFloat(weightVal);
        if (Number.isNaN(weight) || weight <= 0) {
          throw new Error('Enter a valid weight.');
        }
        const { error } = await supabase
          .from('weight_logs')
          .insert([{ user_id: user.id, weight }]);
        if (error) throw error;
      }

      resetFields();
      onSuccess();
      onClose();
    } catch (err: any) {
      // Was a blocking alert() — replaced with inline UI so it doesn't
      // freeze the tab and so it matches the error pattern used elsewhere
      // (Subscriptions, TodoList, budget page).
      setErrorMessage(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      {/*
        FIXED (Dark mode consistency):
        This modal previously hardcoded bg-white / text-gray-900 / bg-gray-50 /
        border-gray-200 everywhere, so it always rendered as a bright white
        card even when the rest of the app was in dark mode. It now uses the
        same --panel / --panel-2 / --text / --muted / --line tokens the rest
        of the app already uses (see Subscriptions.tsx, TodoList.tsx).
      */}
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--line-strong)] bg-[var(--panel)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text)]">Add Entry</h3>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="cursor-pointer p-1 text-[var(--muted)] hover:text-[var(--text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex rounded-xl bg-[var(--panel-2)] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('sub')}
            className={`flex-1 cursor-pointer rounded-lg py-1.5 transition ${
              activeTab === 'sub'
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                : 'text-[var(--muted)]'
            }`}
          >
            Subscription
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('todo')}
            className={`flex-1 cursor-pointer rounded-lg py-1.5 transition ${
              activeTab === 'todo'
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                : 'text-[var(--muted)]'
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('weight')}
            className={`flex-1 cursor-pointer rounded-lg py-1.5 transition ${
              activeTab === 'weight'
                ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                : 'text-[var(--muted)]'
            }`}
          >
            Weight
          </button>
        </div>

        {errorMessage && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--over)_30%,transparent)] bg-[color-mix(in_srgb,var(--over)_10%,transparent)] px-3 py-2.5 text-xs text-[var(--over)]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleAddItem} className="space-y-3">
          {activeTab === 'sub' && (
            <>
              <input
                type="text"
                placeholder="Subscription Name (e.g. Netflix)"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                maxLength={80}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)]"
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Cost (e.g. 15.00)"
                value={subCost}
                onChange={(e) => setSubCost(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)]"
                required
              />
            </>
          )}

          {activeTab === 'todo' && (
            <>
              <input
                type="text"
                placeholder="Task Description"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                maxLength={200}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)]"
                required
              />

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[var(--muted)]">Repeats</p>
                <div className="flex gap-2">
                  {(['none', 'daily', 'weekly'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRecurrence(option)}
                      className={`flex-1 cursor-pointer rounded-xl py-2 text-xs font-semibold capitalize transition ${
                        recurrence === option
                          ? 'bg-[var(--accent)] text-white'
                          : 'border border-[var(--line)] bg-[var(--panel-2)] text-[var(--muted)]'
                      }`}
                    >
                      {option === 'none' ? 'One-time' : option}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'weight' && (
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="Weight in kg (e.g. 74.5)"
              value={weightVal}
              onChange={(e) => setWeightVal(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)]"
              required
            />
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-xl bg-[var(--accent)] py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Record'}
          </button>
        </form>
      </div>
    </div>
  );
}