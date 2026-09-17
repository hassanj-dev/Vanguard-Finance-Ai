'use client';

import React, { useState } from 'react';
import { getSubscriptionLogoUrl } from '../../lib/subscriptionLogos';

interface SubscriptionIconProps {
  name: string;
  /** Tailwind size classes for the circle, e.g. "h-8 w-8". Defaults to h-8 w-8. */
  sizeClassName?: string;
}

// FIXED (Dark mode consistency): previously hardcoded bg-white /
// ring-neutral-100 / bg-neutral-50 / text-neutral-500, so every logo chip
// rendered as a light-mode element inside a dark UI. Now uses the shared
// --panel / --line / --panel-2 / --muted tokens.
export default function SubscriptionIcon({
  name,
  sizeClassName = 'h-8 w-8',
}: SubscriptionIconProps) {
  const logoUrl = getSubscriptionLogoUrl(name);
  const [imageFailed, setImageFailed] = useState(false);

  const showLogo = logoUrl && !imageFailed;

  if (showLogo) {
    return (
      <div
        className={`flex ${sizeClassName} shrink-0 items-center justify-center rounded-xl bg-[var(--panel)] shadow-sm ring-1 ring-[var(--line)] overflow-hidden`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-full w-full object-contain p-1.5"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  // Fallback: first-letter avatar, same as before
  return (
    <div
      className={`flex ${sizeClassName} shrink-0 items-center justify-center rounded-xl bg-[var(--panel-2)] text-[10px] font-bold uppercase text-[var(--muted)]`}
    >
      {(name.charAt(0) || '?').toUpperCase()}
    </div>
  );
}