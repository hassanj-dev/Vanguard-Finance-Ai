'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, AlertCircle } from 'lucide-react';

type EntryTab = 'sub' | 'todo' | 'weight';
type Recurrence = 'none' | 'daily' | 'weekly';

const TASK_MAX_LENGTH = 500;

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

  const taskRef = useRef<HTMLTextAreaElement>(null);

  // Keep the active tab in sync if the parent opens the modal on a different tab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setErrorMessage(null);
    }
  }, [isOpen, defaultTab]);

  // Escape closes the modal — it previously trapped the user with only the
  // X button, which is a basic dialog expectation.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // FIX #3 (input side) — the task field was a single-line <input> capped at
  // 200 characters, so a long task literally could not be typed in full.
  // It's now an auto-growing textarea with a 500-character budget.
  const autoGrow = () => {
    const el = taskRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  useEffect(() => {
    if (isOpen && activeTab === 'todo') autoGrow();
  }, [isOpen, activeTab, taskName]);

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
    if (submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // RLS requires every row to carry the owner's user_id — without this,
      // inserts are rejected by Postgres row-level security, not by any
      // check in this component.
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
        if (cost < 0) throw new Error('Cost cannot be negative.');

        const { error } = await supabase
          .from('subscriptions')
          .insert([{ user_id: user.id, name: subName.trim(), cost }]);
        if (error) throw error;
      } else if (activeTab === 'todo') {
        const task = taskName.trim();
        if (!task) throw new Error('Enter a task description.');
        if (task.length > TASK_MAX_LENGTH) {
          throw new Error(`Keep the task under ${TASK_MAX_LENGTH} characters.`);
        }

        const { error } = await supabase
          .from('todos')
          .insert([{ user_id: user.id, task, is_completed: false, recurrence }]);
        if (error) throw error;
      } else if (activeTab === 'weight') {
        const weight = parseFloat(weightVal);
        if (Number.isNaN(weight) || weight <= 0) {
          throw new Error('Enter a valid weight.');
        }
        if (weight > 500) throw new Error('That weight looks wrong. Check the number.');

        const { error } = await supabase
          .from('weight_logs')
          .insert([{ user_id: user.id, weight }]);
        if (error) throw error;
      }

      resetFields();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const taskRemaining = TASK_MAX_LENGTH - taskName.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add entry"
        className="relative w-full max-w-md rounded-3xl border border-[var(--line-strong)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]"
      >
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
          {(
            [
              ['sub', 'Subscription'],
              ['todo', 'Task'],
              ['weight', 'Weight'],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`flex-1 cursor-pointer rounded-lg py-1.5 transition ${
                activeTab === tab
                  ? 'bg-[var(--panel)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--muted)]'
              }`}
            >
              {label}
            </button>
          ))}
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
                placeholder="Cost (e.g. $15.00)"
                value={subCost}
                onChange={(e) => setSubCost(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)]"
                required
              />
            </>
          )}

          {activeTab === 'todo' && (
            <>
              <div>
                <textarea
                  ref={taskRef}
                  placeholder="What needs to be done?"
                  value={taskName}
                  onChange={(e) => {
                    setTaskName(e.target.value);
                    autoGrow();
                  }}
                  onKeyDown={(e) => {
                    // Cmd/Ctrl + Enter submits, plain Enter makes a new line.
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
                    }
                  }}
                  maxLength={TASK_MAX_LENGTH}
                  rows={3}
                  className="w-full resize-none overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-2.5 text-xs leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-soft)]"
                  required
                />
                <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
                  <span>Ctrl + Enter to save</span>
                  <span className={taskRemaining < 40 ? 'text-[var(--warn)]' : undefined}>
                    {taskRemaining} left
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[var(--muted)]">Time Duration</p>
                <div className="flex gap-2">
                  {(['none', 'daily', 'weekly'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRecurrence(option)}
                      aria-pressed={recurrence === option}
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
            className="w-full cursor-pointer rounded-xl bg-[var(--accent)] py-2.5 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Record'}
          </button>
        </form>
      </div>
    </div>
  );
}