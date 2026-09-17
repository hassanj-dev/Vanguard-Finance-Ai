'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // FIXED (Dark mode consistency): this previously hardcoded
  // border-gray-200 / bg-white / text-gray-400, so it always rendered as a
  // light-mode pill even when the rest of the app was dark. Now uses the
  // same --panel / --line / --muted / --text tokens as everything else.
  if (!time) {
    return (
      <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2 text-[11px] font-medium text-[var(--muted)] shadow-sm">
        <Clock className="w-3.5 h-3.5 animate-pulse" />
        <span>--:--:-- --</span>
      </div>
    );
  }

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2 text-[11px] font-medium text-[var(--text)] shadow-sm">
      <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />
      <span>{formattedTime}</span>
      <span className="text-[var(--line-strong)]">•</span>
      <span className="text-[var(--muted)]">{formattedDate}</span>
    </div>
  );
}