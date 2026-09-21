'use client';
import Link from 'next/link';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/useTheme';
import {
  LayoutDashboard,
  Layers,
  BarChart2,
  PieChart,
  Search,
  Bell,
  LogOut,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';

interface NavbarProps {
  /** Toggles the mobile Sidebar drawer. */
  onMenuClick: () => void;
}

function getInitials(email: string | null): string {
  if (!email) return '?';
  const local = email.split('@')[0];
  const parts = local.split(/[.\-_]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

// Renewal alert shown in the notifications dropdown.
interface SubscriptionAlert {
  id: number;
  name: string;
  cost: number;
  daysUntilRenewal: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ALERT_WINDOW_DAYS = 5;

const LOGO_SRC = '/favicon-96x96.png';

export default function Navbar({ onMenuClick }: NavbarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SubscriptionAlert[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme, mounted } = useTheme();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Analytics', icon: Layers, path: '/analytics' },
    { name: 'Charts', icon: BarChart2, path: '/charts' },
    { name: 'Budget', icon: PieChart, path: '/budget' },
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    });
  }, []);

  /**
   * Renewal alerts — now live.
   *
   * Before: fetched once when userId resolved, so adding/editing a
   * subscription never updated the bell until a full page reload.
   *
   * Now:
   *  1) loads on mount,
   *  2) re-loads on any change to this user's subscriptions (Supabase realtime),
   *  3) re-loads when the tab becomes visible again (covers day rollover).
   *
   * Requires realtime on the table:
   *   alter publication supabase_realtime add table subscriptions;
   */
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadAlerts = async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, name, cost, renewal_date')
        .eq('user_id', userId)
        .not('renewal_date', 'is', null);

      if (cancelled) return;
      if (error) {
        console.error('Renewal alerts fetch error:', error.message);
        return;
      }
      if (!data) return;

      // renewal_date is a date-only string ("YYYY-MM-DD"). Parsing it with
      // `new Date()` treats it as UTC midnight, which shifts the day in
      // negative-UTC-offset timezones — so we build a local Date explicitly.
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const soon = data
        .map((sub: { id: number; name: string; cost: number; renewal_date: string }) => {
          const [y, m, d] = sub.renewal_date.split('-').map(Number);
          const due = new Date(y, (m || 1) - 1, d || 1);
          due.setHours(0, 0, 0, 0);
          const daysUntilRenewal = Math.round((due.getTime() - today.getTime()) / DAY_MS);
          return { id: sub.id, name: sub.name, cost: sub.cost, daysUntilRenewal };
        })
        .filter((s) => s.daysUntilRenewal >= 0 && s.daysUntilRenewal <= ALERT_WINDOW_DAYS)
        .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

      setAlerts(soon);
    };

    // 1) Initial load
    loadAlerts();

    // 2) Refresh whenever a subscription changes
    const channel = supabase
      .channel(`navbar-alerts-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        () => loadAlerts()
      )
      .subscribe();

    // 3) Refresh when the tab regains focus (e.g. day changed overnight)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAlerts();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const runSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setShowMobileSearch(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') runSearch(searchQuery);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showProfileMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu, showNotifications]);

  return (
    <header className="relative w-full bg-[var(--bg-2)] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-[var(--line)] gap-3">
      {/* Left: hamburger (mobile) + logo + tabs (desktop) */}
      <div className="flex items-center gap-3 sm:gap-8 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-full text-[var(--muted)] hover:bg-[var(--panel-2)] shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/dashboard" className="flex items-center shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="Vanguard Finance AI" className="h-8 w-auto" draggable={false} />
        </Link>

        {/* Tab nav — desktop only; Sidebar covers navigation on mobile */}
        <nav className="hidden lg:flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.name}
                href={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[var(--muted)]'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: search, theme toggle, bell, avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden md:flex relative items-center">
          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search"
            aria-label="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 pr-4 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-full text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--line-strong)] w-44 transition-all"
          />
        </div>

        <button
          onClick={() => setShowMobileSearch((v) => !v)}
          className="md:hidden w-8 h-8 rounded-full bg-[var(--panel)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Theme toggle — before mount we render a neutral placeholder rather
            than defaulting to the Moon icon, which flashed the wrong icon on
            every load for dark-mode users. */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full bg-[var(--panel)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          aria-label={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
        >
          {!mounted ? (
            <span className="w-4 h-4" aria-hidden="true" />
          ) : theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* Notifications — subscription-renewal alerts */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="relative w-8 h-8 rounded-full bg-[var(--panel)] border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--over)] text-[9px] font-bold text-white">
                {alerts.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-64 bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-[var(--shadow-lg)] p-2 z-50">
              <p className="px-2 pb-2 pt-1 text-[11px] font-semibold text-[var(--text)]">Alerts</p>

              {alerts.length === 0 ? (
                <p className="px-2 py-3 text-[11px] text-[var(--muted)]">
                  Nothing renewing in the next {ALERT_WINDOW_DAYS} days.
                </p>
              ) : (
                <ul className="space-y-1">
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl px-2 py-2 text-[11px] text-[var(--text)] bg-[var(--panel-2)]"
                    >
                      <span className="font-semibold capitalize">{a.name}</span> renews{' '}
                      <span className="font-semibold">
                        {a.daysUntilRenewal === 0 ? 'today' : `in ${a.daysUntilRenewal}d`}
                      </span>{' '}
                      — ${a.cost}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="w-9 h-9 rounded-full overflow-hidden border border-[var(--line)] focus:ring-2 focus:ring-[var(--accent-ring)] flex items-center justify-center bg-[var(--accent-wash)] text-[11px] font-bold text-[var(--accent-soft)]"
            aria-label="Account menu"
            aria-expanded={showProfileMenu}
          >
            {getInitials(userEmail)}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-[var(--panel)] border border-[var(--line)] rounded-2xl shadow-[var(--shadow-lg)] p-2 z-50">
              {userEmail && (
                <p className="truncate px-2 pb-2 pt-1 text-[11px] text-[var(--muted)]">{userEmail}</p>
              )}
              <button
                onClick={handleLogout}
                className="w-full py-2 bg-[color-mix(in_srgb,var(--over)_14%,transparent)] text-[var(--over)] hover:bg-[color-mix(in_srgb,var(--over)_22%,transparent)] text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search row — appears under the header when toggled */}
      {showMobileSearch && (
        <div className="md:hidden absolute left-0 right-0 top-full z-40 bg-[var(--bg-2)] border-b border-[var(--line)] px-4 py-3">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search"
              aria-label="Search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-4 py-2 bg-[var(--panel)] border border-[var(--line)] rounded-full text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]"
            />
          </div>
        </div>
      )}
    </header>
  );
}