'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import styles from './login.module.css';

/* Fonts and the no-flash theme script both live in app/layout.tsx now, so
   this file renders no <script> and no <style> of its own. Rendering a
   <script> inside a client component is what produced the console warning:
   React never executes it on the client, so it was dead markup anyway. */

const BRAND = 'Vanguard';

type Theme = 'dark' | 'light';

/** Reads the theme the layout script already decided, then keeps <html> and
 *  localStorage in sync. Same `vg-theme` key the landing page uses. */
function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    setTheme(attr === 'light' ? 'light' : 'dark');
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('vg-theme', theme);
    } catch {
      /* storage blocked — session-only theme is fine */
    }
  }, [theme, ready]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}

/* Same theme-aware wordmark used on the landing page.
   Dark background → white/purple wordmark. Light background → black wordmark. */
function Logo({ theme }: { theme: Theme }) {
  const src = theme === 'light' ? '/vanguard-logo-black.png' : '/vanguard-logo-white.png';
  return (
    <img
      src={src}
      alt={`${BRAND} Finance AI`}
      className={styles.logoImg}
      draggable={false}
    />
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  /* Presentation only — nothing below touches the auth call. */
  const { theme, toggle } = useTheme();
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <main className={styles.auth}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.gridField} aria-hidden="true" />

      {/* ── TOP BAR ───────────────────────────────────────────────────── */}
      <header className={styles.top}>
        <a href="/" className={styles.brand}>
          <Logo theme={theme} />
        </a>

        <div className={styles.topActions}>
          <a href="/" className={styles.backLink}>
            <ArrowLeft size={14} />
            <span className={styles.backLabel}>Back to site</span>
          </a>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        {/* ── LEFT: the card ─────────────────────────────────────────── */}
        <motion.section
          className={styles.card}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.sheen} aria-hidden="true" />

          <div className={styles.cardHead}>
            <span className={styles.cardIcon}>
              <ShieldCheck size={18} />
            </span>
            <h1 className={styles.cardTitle}>
              <span className={styles.revealLine}>
                <motion.span
                  initial={{ y: '105%' }}
                  animate={{ y: '0%' }}
                  transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  Personal access
                </motion.span>
              </span>
            </h1>
            <p className={styles.cardSub}>Sign in to open your dashboard.</p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <motion.div
              className={styles.alert}
              role="alert"
              id="login-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {errorMsg}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                Email address
              </label>
              <div className={styles.inputWrap}>
                <Mail className={styles.inputIcon} size={15} aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errorMsg}
                  aria-describedby={errorMsg ? 'login-error' : undefined}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
              <div className={`${styles.inputWrap} ${styles.hasToggle}`}>
                <Lock className={styles.inputIcon} size={15} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errorMsg}
                  aria-describedby={errorMsg ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className={styles.pwToggle}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  aria-pressed={showPw}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={styles.submit}>
              <span>{loading ? 'Authenticating…' : 'Sign in'}</span>
              {loading ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )}
            </button>

            <p className={styles.aside}>
              No account yet? <a href="/signup">Request early access</a>
            </p>
          </form>
        </motion.section>

        {/* ── RIGHT: reassurance panel ───────────────────────────────── */}
        <motion.aside
          className={styles.side}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.tag}>
            <span className={styles.tagDot} />
            Your data, your entries
          </span>

          <h2 className={styles.sideTitle}>
            Everything behind this screen is what <em>you</em> typed or texted.
          </h2>

          <ul className={styles.sideList}>
            {[
              'No bank credentials or card numbers are collected',
              'Export everything you\u2019ve logged as CSV, any time',
              'Delete your account and its entries from settings',
            ].map((s) => (
              <li key={s}>
                <ShieldCheck size={14} />
                {s}
              </li>
            ))}
          </ul>

          <div className={styles.mini}>
            <div className={styles.miniBar}>
              <span className={styles.miniAvatar}>
                <MessageSquare size={13} />
              </span>
              <span className={styles.miniMeta}>
                <strong>{BRAND}</strong>
                <small>on WhatsApp</small>
              </span>
            </div>
            <div className={styles.miniBody}>
              <motion.span
                className={`${styles.bubble} ${styles.you}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                42 groceries
              </motion.span>
              <motion.span
                className={`${styles.bubble} ${styles.bot}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.95 }}
              >
                Logged — <span className="num">$42.00</span> to Groceries.
              </motion.span>
            </div>
            <p className={styles.miniNote}>Example conversation</p>
          </div>

          <p className={styles.sideLegal}>
            {BRAND} records and reports the numbers you give it. It is not a bank, not a broker,
            and does not provide financial, tax or investment advice.
          </p>
        </motion.aside>
      </div>
    </main>
  );
}