"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useInView } from "framer-motion";
import GithubStarButton from "@/app/components/GithubStarButton";
import { Figtree, JetBrains_Mono } from "next/font/google";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Menu,
  Moon,
  MessageSquare,
  PencilLine,
  Route,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

const BRAND = "Vanguard";
const DISCLAIMER =
  `${BRAND} records and reports the numbers you give it. It is not a bank, ` +
  `not a broker, and does not provide financial, tax or investment advice.`;

const CURRENCY = "USD";

function useLocale() {
  const [locale, setLocale] = useState("en-US");
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language)
      setLocale(navigator.language);
  }, []);
  return locale;
}

function money(value: number, locale: string, decimals = 0) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

type NavItem = { label: string; href: string };
type Message = { from: "you" | "bot"; text: string };
type FeedEntry = {
  merchant: string;
  amount: string;
  category: string;
  via: "text" | "manual";
};
type Capability = { title: string; body: string; icon: typeof MessageSquare };
type Step = { title: string; body: string; time: string };

const NAV: NavItem[] = [
  { label: "How it works", href: "#how" },
  { label: "What it tracks", href: "#tracks" },
  { label: "Your data", href: "#data" },
];

const THREAD: Message[] = [
  { from: "you", text: "42 groceries" },
  {
    from: "bot",
    text: "Logged — $42.00 to Groceries. That's $340 in Groceries this week.",
  },
  { from: "you", text: "how much dining this month?" },
  {
    from: "bot",
    text: "$182.00 across 9 entries. Your dining limit is $200, so $18.00 remains with 9 days left in the month.",
  },
];

const FEED: FeedEntry[] = [
  {
    merchant: "Corner shop",
    amount: "-$42.00",
    category: "Groceries",
    via: "text",
  },
  {
    merchant: "Bus pass",
    amount: "-$18.40",
    category: "Transport",
    via: "text",
  },
  {
    merchant: "Freelance invoice",
    amount: "+$650.00",
    category: "Income",
    via: "manual",
  },
  { merchant: "Coffee", amount: "-$6.75", category: "Dining", via: "text" },
  {
    merchant: "Phone bill",
    amount: "-$29.00",
    category: "Bills",
    via: "manual",
  },
  { merchant: "Cinema", amount: "-$24.00", category: "Fun", via: "text" },
  { merchant: "Rent", amount: "-$850.00", category: "Housing", via: "manual" },
  {
    merchant: "Refund",
    amount: "+$62.00",
    category: "Shopping",
    via: "manual",
  },
];

const CAPABILITIES: Capability[] = [
  {
    icon: MessageSquare,
    title: "Text it in the moment",
    body: "Send 42 groceries while you're still at the counter. It reads the number, files the category, and replies with the running total. No form, no app switch.",
  },
  {
    icon: PencilLine,
    title: "Or type it in yourself",
    body: "The web app has a plain entry table for anything you'd rather do sitting down — rent, invoices, a whole week logged at once. Edit or delete any entry later.",
  },
  {
    icon: Clock,
    title: "It reports, it doesn't advise",
    body: "Set a monthly limit per category and you'll hear where you stand — spent, remaining, days left. What you do with that is your call, not ours.",
  },
];

const STEPS: Step[] = [
  {
    title: "Message the number",
    body: "Send one WhatsApp message to start. No download, no bank login, no card details.",
    time: "30 sec",
  },
  {
    title: "Log your first few expenses",
    body: "Text them as they happen, or open the web app and type in a week at once. It learns your categories as you go.",
    time: "2 min",
  },
  {
    title: "Name your limits",
    body: "Pick the categories you care about and a monthly ceiling for each. You can change them whenever.",
    time: "3 min",
  },
];

type Theme = "dark" | "light";

// ── CHANGE: theme hook now flips the DOM attribute synchronously, and
// briefly disables all CSS transitions on the whole tree so the switch is
// instant instead of every bordered/shadowed element cross-fading at once.
function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    setTheme(attr === "light" ? "light" : "dark");
    setReady(true);
  }, []);

  // Persist only — the DOM attribute itself is set eagerly inside toggle(),
  // not here, so the paint doesn't have to wait on a React re-render.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem("vg-theme", theme);
    } catch {
      /* storage blocked */
    }
  }, [theme, ready]);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next: Theme =
      root.getAttribute("data-theme") === "light" ? "dark" : "light";

    // Kill transitions for one frame so nothing cross-fades.
    root.classList.add("theme-switch");
    root.setAttribute("data-theme", next);
    setTheme(next);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("theme-switch");
      });
    });
  }, []);

  return { theme, toggle };
}

export default function LandingPage() {
  const router = useRouter();
  const locale = useLocale();
  const { theme, toggle } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetPresent, setSheetPresent] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const headerRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) closeMenu();
    };
    const onScroll = () => closeMenu();
    const onResize = () => window.innerWidth > 720 && closeMenu();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (menuOpen) setSheetPresent(true);
  }, [menuOpen]);

  useEffect(() => {
    if (!sheetPresent) return;
    const node = sheetRef.current;
    if (!node) return;
    const SEL =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(SEL));
    items()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        menuBtnRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetPresent, closeMenu]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    await new Promise((r) => setTimeout(r, 400));
    setStatus("done");
  };

  const handleEarlyAccess = () => {
    document
      .getElementById("waitlist-section")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className={`${figtree.variable} ${mono.variable} page`}>
      <style>{GLOBAL_CSS}</style>

      <div className="aurora" aria-hidden="true" />
      <div className="grid-field" aria-hidden="true" />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="header" ref={headerRef}>
        <div className="shell header-inner">
          <a href="#top" className="brand">
            <Logo theme={theme} />
          </a>

          <nav className="nav-links" aria-label="Main">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <ThemeToggle theme={theme} onToggle={toggle} />

            {isLoggedIn ? (
              <button
                className="btn btn-quiet nav-login"
                onClick={() => router.push("/dashboard")}
              >
                Dashboard
              </button>
            ) : (
              <button
                className="btn btn-quiet nav-login"
                onClick={() => router.push("/login")}
              >
                Log in
              </button>
            )}

            <button className="btn btn-solid" onClick={handleEarlyAccess}>
              Get early access
            </button>

            <button
              ref={menuBtnRef}
              className="icon-btn menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>

        <AnimatePresence
          initial={false}
          onExitComplete={() => {
            const active = document.activeElement;
            if (
              !active ||
              active === document.body ||
              sheetRef.current?.contains(active)
            ) {
              menuBtnRef.current?.focus();
            }
            setSheetPresent(false);
          }}
        >
          {menuOpen && (
            <motion.div
              id="mobile-menu"
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="mobile-sheet"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="mobile-sheet-inner">
                {NAV.map((n) => (
                  <a key={n.href} href={n.href} onClick={closeMenu}>
                    {n.label}
                    <ArrowUpRight size={15} />
                  </a>
                ))}

                <div className="mobile-sheet-actions">
                  {isLoggedIn ? (
                    <button
                      className="btn btn-quiet"
                      onClick={() => {
                        closeMenu();
                        router.push("/dashboard");
                      }}
                    >
                      Dashboard
                    </button>
                  ) : (
                    <button
                      className="btn btn-quiet"
                      onClick={() => {
                        closeMenu();
                        router.push("/login");
                      }}
                    >
                      Log in
                    </button>
                  )}

                  <button
                    className="btn btn-solid"
                    onClick={() => {
                      closeMenu();
                      handleEarlyAccess();
                    }}
                  >
                    Get early access
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section id="top" className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <motion.span
              className="tag"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <span className="tag-dot" />
              Early access — limited spots
            </motion.span>

            <h1 className="display">
              <Reveal delay={0.05}>Text it what</Reveal>
              <Reveal delay={0.18}>you spent.</Reveal>
              <Reveal delay={0.31}>
                <em>It keeps the record.</em>
              </Reveal>
            </h1>

            <motion.p
              className="lede"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {BRAND} is an expense log you talk to. Send a WhatsApp message
              like "42 groceries" and it files the amount, sorts the category,
              and tells you what&apos;s left of your limit. Prefer typing? Add
              entries in the web app instead.
            </motion.p>

            <motion.div
              className="hero-cta"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.62 }}
            >
              <button
                className="btn btn-solid btn-lg"
                onClick={() => router.push("/login")}
              >
                Start logging
                <ArrowRight size={16} />
              </button>
              <GithubStarButton repo="hassanj-dev/Vanguard-Finance-Ai" />
            </motion.div>

            <motion.dl
              className="hero-facts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <div>
                <dt>To log an expense</dt>
                <dd>One message</dd>
              </div>
              <div>
                <dt>Bank login needed</dt>
                <dd>None</dd>
              </div>
              <div>
                <dt>Where it lives</dt>
                <dd>WhatsApp &amp; web</dd>
              </div>
            </motion.dl>

            <p className="disclaimer">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>{DISCLAIMER}</span>
            </p>
          </div>

          <div className="hero-demo">
            <Conversation />
            <p className="demo-note">Example conversation</p>
          </div>
        </div>
      </section>

      {/* ── SAMPLE FEED ────────────────────────────────────────────────── */}
      <section className="feed-wrap" aria-labelledby="feed-caption">
        <div className="feed">
          <div className="feed-label">Logged this week</div>
          <div className="feed-track">
            {[0, 1].map((dup) => (
              <div className="feed-row" key={dup} aria-hidden={dup === 1}>
                {FEED.map((f) => (
                  <span className="feed-item" key={`${dup}-${f.merchant}`}>
                    <span className={`via via-${f.via}`}>
                      {f.via === "text" ? (
                        <MessageSquare size={11} />
                      ) : (
                        <PencilLine size={11} />
                      )}
                    </span>
                    <span className="feed-merchant">{f.merchant}</span>
                    <span className="feed-cat">{f.category}</span>
                    <span
                      className={`feed-amt num ${f.amount.startsWith("+") ? "up" : ""}`}
                    >
                      {f.amount}
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
          <span className="feed-scroll-hint" aria-hidden="true">
            scroll <ArrowRight size={12} />
          </span>
        </div>
        <p className="shell feed-caption" id="feed-caption">
          Example data — not a real account. The icon shows whether an entry
          arrived by message or was typed in.
        </p>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section id="how" className="section section-alt">
        <div className="shell">
          <div className="section-head">
            <h2 className="h2">
              Nothing to connect. You tell it what you spent, and it does the
              arithmetic you keep meaning to do.
            </h2>
          </div>

          <ol className="setup">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <div className="setup-marker">
                  <span className="num">{i + 1}</span>
                </div>
                <div className="setup-body">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
                <span className="setup-time num">{s.time}</span>
              </li>
            ))}
          </ol>

          <div className="roadmap">
            <span className="roadmap-icon" aria-hidden="true">
              <Route size={15} />
            </span>
            <span className="roadmap-tag">On the roadmap</span>
            <p>
              Automatic bank sync isn&apos;t built yet. Today every entry comes
              from you — by message or by hand. When connected accounts arrive,
              they&apos;ll be optional and read-only, and manual logging will
              keep working exactly as it does now.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT IT TRACKS ─────────────────────────────────────────────── */}
      <section id="tracks" className="section">
        <div className="shell">
          <div className="section-head">
            <h2 className="h2">
              A running total, a category breakdown, and how much of your limit
              is left.
            </h2>
          </div>

          <div className="cap-list">
            {CAPABILITIES.map((c) => (
              <SpotlightCard className="cap" key={c.title}>
                <span className="cap-icon">
                  <c.icon size={16} />
                </span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </SpotlightCard>
            ))}
          </div>

          <div className="bento">
            <SpotlightCard className="bento-card bento-wide">
              <h3>Your month, added up</h3>
              <p className="muted">
                Every entry you&apos;ve logged, grouped by category. Example
                data.
              </p>
              <MonthSummary locale={locale} />
            </SpotlightCard>

            <SpotlightCard className="bento-card">
              <h3>Limits you set yourself</h3>
              <p className="muted">
                It reports where you stand. It won&apos;t block a purchase or
                tell you to skip one.
              </p>
              <Limits />
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* ── YOUR DATA ──────────────────────────────────────────────────── */}
      <section id="data" className="section section-alt">
        <div className="shell security">
          <div>
            <h2 className="h2">
              We never ask for a bank login, because there&apos;s nothing here
              to log into.
            </h2>
            <p className="lede lede-sm">
              {BRAND} only ever holds what you typed or texted: an amount, a
              category, a date and a note. No credentials, no card numbers, no
              read access to any account of yours.
            </p>
            <ul className="sec-list">
              {[
                "No bank credentials or card numbers are collected",
                "Export everything you've logged as CSV, any time",
                "Delete your account and its entries from settings",
                "Your entries are never sold or used for advertising",
              ].map((s) => (
                <li key={s}>
                  <Check size={14} />
                  {s}
                </li>
              ))}
            </ul>
            <p className="fineprint">
              Full detail is in the <a href="/privacy">privacy policy</a>.
            </p>
          </div>

          <div className="vault">
            <ShieldCheck size={22} />
            <p className="vault-title">You enter it. You own it.</p>
            <p className="vault-sub">
              Export or delete everything in two clicks
            </p>
          </div>
        </div>
      </section>

      {/* ── WAITLIST ───────────────────────────────────────────────────── */}
      <section id="waitlist-section" className="section">
        <div className="shell">
          <div className="cta">
            <div>
              <h2 className="h2 h2-cta">Open to a small group at a time.</h2>
              <p className="muted cta-sub">
                Leave an email and we&apos;ll send an invite when the next batch
                opens. One message, no newsletter.
              </p>
            </div>

            {status === "done" ? (
              <motion.p
                className="joined"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                role="status"
              >
                <Check size={16} /> You&apos;re on the list. Watch your inbox.
              </motion.p>
            ) : (
              <form className="waitlist" onSubmit={submit} noValidate={false}>
                <label className="sr-only" htmlFor="wl-email">
                  Email address
                </label>
                <input
                  id="wl-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  placeholder="you@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={status === "error" ? "wl-error" : undefined}
                />
                <button
                  type="submit"
                  className="btn btn-solid"
                  disabled={status === "sending"}
                >
                  {status === "sending" ? "Sending…" : "Request an invite"}
                </button>
                {status === "error" && (
                  <p className="form-error" id="wl-error" role="alert">
                    That didn&apos;t send. Check the address and try again.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="shell footer-inner">
          <div className="footer-top">
            <a href="#top" className="brand">
              <Logo theme={theme} />
            </a>
            <nav className="footer-links" aria-label="Footer">
              <a href="#how">How it works</a>
              <a href="#tracks">What it tracks</a>
              <a href="#data">Your data</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </nav>
          </div>
          <p className="footer-legal">
            {DISCLAIMER} © {new Date().getFullYear()} {BRAND}.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ── SMALL PIECES ────────────────────────────────────────────────────────── */

function Logo({ theme }: { theme: Theme }) {
  const src =
    theme === "light" ? "/vanguard-logo-black.png" : "/vanguard-logo-white.png";
  return (
    <img
      src={src}
      alt={`${BRAND} Finance AI`}
      className="logo-img"
      draggable={false}
    />
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="icon-btn theme-btn"
      onClick={onToggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 10, opacity: 0, rotate: -35 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -10, opacity: 0, rotate: 35 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{ display: "flex" }}
        >
          {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <span className="reveal-line">
      <motion.span
        initial={{ y: "105%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function SpotlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 0 });
  const [lit, setLit] = useState(false);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div
      ref={ref}
      className={`spot ${className}`}
      onMouseMove={onMove}
      onMouseEnter={() => setLit(true)}
      onMouseLeave={() => setLit(false)}
    >
      <span
        className="spot-glow"
        aria-hidden="true"
        style={{
          opacity: lit ? 1 : 0,
          background: `radial-gradient(260px circle at ${pos.x}px ${pos.y}px, var(--spot), transparent 72%)`,
        }}
      />
      <div className="spot-content">{children}</div>
    </div>
  );
}

function Conversation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.4,
  });
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setShown(THREAD.length);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 450;
    THREAD.forEach((m, i) => {
      const late = i >= 2;
      if (m.from === "bot") {
        timers.push(setTimeout(() => setTyping(true), t));
        t += late ? 520 : 750;
        timers.push(
          setTimeout(() => {
            setTyping(false);
            setShown(i + 1);
          }, t),
        );
        t += late ? 700 : 1000;
      } else {
        timers.push(setTimeout(() => setShown(i + 1), t));
        t += late ? 500 : 700;
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div className="phone" ref={ref}>
      <div className="phone-bar">
        <span className="phone-avatar">
          <MessageSquare size={14} />
        </span>
        <span className="phone-meta">
          <strong>{BRAND}</strong>
          <small>on WhatsApp</small>
        </span>
      </div>

      <div className="phone-body">
        {THREAD.slice(0, shown).map((m, i) => (
          <motion.div
            key={i}
            className={`bubble ${m.from}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {m.text}
          </motion.div>
        ))}

        <AnimatePresence mode="popLayout">
          {typing && (
            <motion.div
              className="bubble bot typing"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="phone-input">
        <span>Type an amount and a category…</span>
        <span className="phone-send">
          <ArrowRight size={14} />
        </span>
      </div>
    </div>
  );
}

function Counter({ to, locale }: { to: number; locale: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.6,
  });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setVal(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref} className="num">
      {money(val, locale)}
    </span>
  );
}

function MonthSummary({ locale }: { locale: string }) {
  const categories = [
    { name: "Housing", amount: 850, pct: 39, tone: "a" },
    { name: "Groceries", amount: 524, pct: 24, tone: "b" },
    { name: "Transport", amount: 386, pct: 18, tone: "c" },
    { name: "Dining", amount: 182, pct: 8, tone: "d" },
    { name: "Everything else", amount: 242, pct: 11, tone: "e" },
  ];
  const total = categories.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="balance">
      <p className="balance-total">
        <Counter to={total} locale={locale} />
      </p>
      <p className="balance-delta">logged across 46 entries this month</p>

      <div
        className="stack"
        role="img"
        aria-label="Share of logged spending by category"
      >
        {categories.map((c) => (
          <motion.span
            key={c.name}
            className={`stack-seg tone-${c.tone}`}
            initial={{ flexGrow: 0 }}
            whileInView={{ flexGrow: c.pct }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>

      <ul className="acct-list">
        {categories.map((c) => (
          <li key={c.name}>
            <span className={`dot tone-${c.tone}`} />
            {c.name}
            <b className="num">{money(c.amount, locale)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Limits() {
  const limits = [
    { name: "Fun", used: 112, left: "$14 over" },
    { name: "Dining", used: 91, left: "$18 left" },
    { name: "Groceries", used: 66, left: "$276 left" },
    { name: "Transport", used: 31, left: "$207 left" },
  ];

  const stateOf = (used: number) =>
    used >= 100 ? "over" : used >= 80 ? "warn" : "ok";

  return (
    <ul className="budgets">
      {limits.map((b) => {
        const state = stateOf(b.used);
        const isOver = state === "over";

        return (
          <li key={b.name} className={`budget budget-${state}`}>
            <div className="budget-head">
              <span>{b.name}</span>
              <span
                className="num budget-left"
                style={isOver ? { color: "#ef4444" } : {}}
              >
                {b.left}
              </span>
            </div>
            <div
              className="bar"
              role="progressbar"
              aria-valuenow={b.used}
              aria-valuemin={0}
              aria-valuemax={Math.max(100, b.used)}
              aria-valuetext={`${b.used}% of the ${b.name} limit — ${b.left}`}
              aria-label={`${b.name} limit used`}
            >
              <motion.span
                className={state}
                style={
                  isOver
                    ? { backgroundColor: "#ef4444", backgroundImage: "none" }
                    : {}
                }
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(b.used, 100)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── STYLES ──────────────────────────────────────────────────────────────── */

const GLOBAL_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── CHANGE: kills every transition tree-wide while the theme is flipping.
   Toggled on/off via classList in useTheme() so the switch is one instant
   paint instead of dozens of elements cross-fading their own transitions. */
html.theme-switch,
html.theme-switch *,
html.theme-switch *::before,
html.theme-switch *::after {
  transition: none !important;
  animation-duration: 0.01ms !important;
}

:root {
  --bg: #060010;
  --bg-2: #0B0616;
  --panel: #120F17;
  --panel-2: #17121F;
  --line: rgba(255,255,255,0.09);
  --line-strong: rgba(255,255,255,0.16);
  --text: #F2EEFF;
  --muted: #B3ABC4;
  --accent: #5227FF;
  --accent-soft: #B19EEF;
  --accent-wash: rgba(82,39,255,0.14);
  --up: #3BEDB0;
  --warn: #FFB020;
  --over: #FF6B6B;
  --spot: rgba(177,158,239,0.14);
  --shadow: 0 30px 80px rgba(0,0,0,0.55);
  color-scheme: dark;
}

[data-theme="light"] {
  --bg: #FFFFFF;
  --bg-2: #F6F4FC;
  --panel: #FFFFFF;
  --panel-2: #F6F4FC;
  --line: rgba(18,15,23,0.13);
  --line-strong: rgba(18,15,23,0.24);
  --text: #15121C;
  --muted: #5B5468;
  --accent: #5227FF;
  --accent-soft: #4620DB;
  --accent-wash: rgba(82,39,255,0.08);
  --up: #0B8A5F;
  --warn: #C2650B;
  --over: #D6362A;
  --spot: rgba(82,39,255,0.06);
  --shadow: 0 20px 45px rgba(18,15,23,0.09), 0 2px 10px rgba(18,15,23,0.05);
  color-scheme: light;

  --tone-a: #5227FF;
  --tone-b: #0EA5A0;
  --tone-c: #16A34A;
  --tone-d: #D97706;
  --tone-e: #8B85A0;
}
[data-theme="light"] .tone-a { background: var(--tone-a); }
[data-theme="light"] .tone-b { background: var(--tone-b); }
[data-theme="light"] .tone-c { background: var(--tone-c); }
[data-theme="light"] .tone-d { background: var(--tone-d); }
[data-theme="light"] .tone-e { background: var(--tone-e); }

[data-theme="light"] .spot,
[data-theme="light"] .roadmap,
[data-theme="light"] .feed-item,
[data-theme="light"] .phone,
[data-theme="light"] .vault,
[data-theme="light"] .cta {
  box-shadow: 0 1px 2px rgba(18,15,23,0.05), 0 12px 28px rgba(18,15,23,0.07);
  border-color: var(--line-strong);
}

[data-theme="light"] .bar {
  background: #EFEDF6;
  border-color: var(--line-strong);
}

[data-theme="light"] .bar span.warn {
  background: var(--warn);
}

[data-theme="light"] .budget-warn .budget-left {
  color: var(--warn);
  font-weight: 600;
}

[data-theme="light"] .phone-body {
  background-image: radial-gradient(circle at 1px 1px, rgba(18,15,23,0.10) 1px, transparent 0);
}

[data-theme="light"] .feed-track {
  mask-image: linear-gradient(90deg, transparent, #000 5%, #000 88%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 5%, #000 88%, transparent);
}

html { scroll-behavior: smooth; }

.page {
  position: relative;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  transition: background 0.18s ease, color 0.18s ease;
}

.num { font-family: var(--font-mono), ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.shell { width: 100%; max-width: 1140px; margin: 0 auto; padding: 0 24px; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

a { color: inherit; }

:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 3px;
  border-radius: 6px;
}
[data-theme="light"] :focus-visible { outline-color: var(--accent); }

/* ── CHANGE: removed the 20px blur filter — the radial gradients are soft
   enough on their own, and filter: blur() on a full-viewport fixed layer is
   one of the most expensive things a browser repaints, especially on theme
   flips and on mobile GPUs. will-change hints the compositor instead. */
.aurora {
  position: fixed; inset: -20% -10% auto -10%; height: 70vh; z-index: 0; pointer-events: none;
  background:
    radial-gradient(48% 55% at 22% 18%, rgba(82,39,255,0.30), transparent 70%),
    radial-gradient(42% 50% at 78% 8%, rgba(177,158,239,0.18), transparent 70%);
  will-change: opacity;
}
[data-theme="light"] .aurora { opacity: 0.5; }

.grid-field {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(70% 55% at 50% 0%, #000 0%, transparent 78%);
  -webkit-mask-image: radial-gradient(70% 55% at 50% 0%, #000 0%, transparent 78%);
  opacity: 0.6;
}

.page > * { position: relative; z-index: 1; }
.page > .aurora, .page > .grid-field { position: fixed; z-index: 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 0 18px; border-radius: 10px;
  font: inherit; font-size: 14px; font-weight: 600; letter-spacing: -0.01em;
  border: 1px solid transparent; cursor: pointer; text-decoration: none;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
}
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: 0.6; cursor: default; }
.btn-lg { height: 48px; padding: 0 24px; font-size: 15px; border-radius: 12px; }

.btn-solid { background: var(--accent); color: #fff; }
.btn-solid:hover:not(:disabled) { background: #4620DB; }

.btn-quiet { background: transparent; color: var(--text); border-color: var(--line-strong); }
.btn-quiet:hover { background: var(--accent-wash); border-color: var(--accent-soft); }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 10px;
  background: transparent; border: 1px solid var(--line-strong);
  color: var(--text); cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.icon-btn:hover { background: var(--accent-wash); border-color: var(--accent-soft); }

.page > .header {
  position: sticky; top: 0; z-index: 60;
  background: var(--bg);
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  will-change: background-color;
}
.header-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; }

.brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 700; font-size: 16px; letter-spacing: -0.02em; text-decoration: none;
}
.logo-img {
  height: 42px;
  width: auto;
  object-fit: contain;
  display: block;
  user-select: none;
}
.footer .logo-img { height: 36px; }

.nav-links { display: flex; gap: 28px; }
.nav-links a { font-size: 14px; font-weight: 500; color: var(--muted); text-decoration: none; transition: color 0.2s; }
.nav-links a:hover { color: var(--text); }

.header-actions { display: flex; align-items: center; gap: 8px; }
.menu-btn { display: none; }

.mobile-sheet { overflow: hidden; border-top: 1px solid var(--line); background: var(--bg); }
.mobile-sheet-inner { padding: 12px 24px 20px; display: flex; flex-direction: column; gap: 4px; }
.mobile-sheet-inner a {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 4px; font-size: 15px; font-weight: 500;
  text-decoration: none; border-bottom: 1px solid var(--line); color: var(--text);
}
.mobile-sheet-inner a:last-of-type { border-bottom: 0; }
.mobile-sheet-actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line);
}
.mobile-sheet-actions .btn { width: 100%; }

.hero { padding: 92px 0 68px; }
.hero-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 72px; align-items: center; }

.tag {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 13px 6px 10px; border-radius: 100px;
  border: 1px solid var(--line-strong); background: var(--accent-wash);
  font-size: 12.5px; font-weight: 500; color: var(--text);
  margin-bottom: 26px;
}
.tag-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--up);
  box-shadow: 0 0 0 4px rgba(59,237,176,0.22);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--up) 22%, transparent);
}

.display { font-size: clamp(38px, 5.1vw, 62px); line-height: 1.04; letter-spacing: -0.04em; font-weight: 800; margin-bottom: 26px; }
.display em { font-style: normal; color: var(--accent-soft); }
[data-theme="light"] .display em { color: var(--accent); }

.reveal-line { display: block; overflow: hidden; padding-bottom: 0.06em; }
.reveal-line > span { display: block; }

.lede { font-size: 17px; line-height: 1.68; color: var(--muted); max-width: 52ch; margin-bottom: 32px; }
.lede-sm { font-size: 16px; margin-bottom: 26px; }

.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 44px; }

.hero-facts { display: flex; gap: 44px; flex-wrap: wrap; padding-top: 26px; border-top: 1px solid var(--line); }
.hero-facts dt { font-size: 12.5px; color: var(--muted); margin-bottom: 5px; }
.hero-facts dd { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; }

.disclaimer {
  display: flex; gap: 10px; align-items: flex-start;
  margin-top: 26px; padding: 12px 0 12px 14px;
  border-left: 2px solid var(--line-strong);
  font-size: 13.5px; line-height: 1.6; max-width: 58ch;
  color: var(--text); opacity: 0.86;
}
.disclaimer svg { flex-shrink: 0; margin-top: 3px; color: var(--accent-soft); }
[data-theme="light"] .disclaimer svg { color: var(--accent); }

.demo-note { margin-top: 12px; font-size: 12px; color: var(--muted); text-align: right; }

.phone {
  border: 1px solid var(--line-strong); border-radius: 22px;
  background: var(--panel); box-shadow: var(--shadow);
  overflow: hidden; max-width: 400px; margin-left: auto;
}
.phone-bar { display: flex; align-items: center; gap: 11px; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel-2); }
.phone-avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: #fff; }
.phone-meta { display: flex; flex-direction: column; line-height: 1.3; }
.phone-meta strong { font-size: 14px; font-weight: 600; }
.phone-meta small { font-size: 11.5px; color: var(--muted); }

.phone-body {
  padding: 18px 16px; min-height: 320px;
  display: flex; flex-direction: column; gap: 9px; justify-content: flex-end;
  background-image: radial-gradient(circle at 1px 1px, var(--line) 1px, transparent 0);
  background-size: 22px 22px;
}
.bubble { max-width: 84%; padding: 10px 14px; font-size: 13.5px; line-height: 1.55; border-radius: 14px; }
.bubble.you { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
.bubble.bot { align-self: flex-start; background: var(--panel-2); border: 1px solid var(--line-strong); border-bottom-left-radius: 4px; }
.bubble.typing { display: flex; gap: 4px; padding: 14px; }
.bubble.typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: blink 1.1s infinite ease-in-out; }
.bubble.typing i:nth-child(2) { animation-delay: 0.16s; }
.bubble.typing i:nth-child(3) { animation-delay: 0.32s; }
@keyframes blink { 0%,60%,100% { opacity: 0.25; } 30% { opacity: 1; } }

.phone-input { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-top: 1px solid var(--line); background: var(--panel-2); font-size: 13px; color: var(--muted); }
.phone-input > span:first-child { flex: 1; padding: 9px 14px; border-radius: 100px; background: var(--bg-2); border: 1px solid var(--line); }
.phone-send { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: #fff; flex-shrink: 0; }

.feed-wrap { padding-bottom: 8px; }
.feed { display: flex; align-items: center; gap: 18px; border-block: 1px solid var(--line); padding: 14px 0; overflow: hidden; background: var(--bg-2); }
.feed-label { flex-shrink: 0; padding-left: 24px; font-size: 12px; font-weight: 600; color: var(--muted); }

.feed-track {
  display: flex; min-width: 0;
  mask-image: linear-gradient(90deg, transparent, #000 5%, #000 88%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 5%, #000 88%, transparent);
}
.feed-row { display: flex; gap: 12px; padding-right: 12px; animation: marquee 44s linear infinite; }
.feed:hover .feed-row, .feed:focus-within .feed-row { animation-play-state: paused; }
@keyframes marquee { to { transform: translateX(-100%); } }

.feed-item {
  display: inline-flex; align-items: center; gap: 9px; white-space: nowrap;
  padding: 7px 14px 7px 9px; border: 1px solid var(--line); border-radius: 100px;
  background: var(--panel); font-size: 13px;
}
.via { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; }
.via-text { background: var(--accent-wash); color: var(--accent-soft); }
[data-theme="light"] .via-text { color: var(--accent); }
.via-manual {
  background: rgba(150,143,168,0.16);
  background: color-mix(in srgb, var(--muted) 16%, transparent);
  color: var(--muted);
}
.feed-merchant { font-weight: 500; }
.feed-cat { font-size: 12px; color: var(--muted); }
.feed-amt { font-size: 12.5px; color: var(--muted); }
.feed-amt.up, .up { color: var(--up); }

.feed-scroll-hint { display: none; }

.feed-caption { padding-top: 12px; font-size: 12.5px; color: var(--muted); max-width: 70ch; }

.section { padding: 100px 0; }
.section-alt { background: var(--bg-2); border-block: 1px solid var(--line); }

.section-head { max-width: 34ch; margin-bottom: 48px; }
.h2 { font-size: clamp(27px, 3.4vw, 40px); line-height: 1.16; letter-spacing: -0.035em; font-weight: 700; max-width: 22ch; }
.section-head .h2 { max-width: none; }

.muted { color: var(--muted); }

.fineprint { margin-top: 20px; font-size: 13px; color: var(--muted); }
.fineprint a { color: var(--accent-soft); }
[data-theme="light"] .fineprint a { color: var(--accent); }

.cap-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; }
.cap { padding: 28px 26px 30px; }
.cap-icon {
  display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px;
  background: var(--accent-wash); color: var(--accent-soft);
  border: 1px solid var(--line-strong); margin-bottom: 18px;
}
[data-theme="light"] .cap-icon { color: var(--accent); }
.cap h3 { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.3; margin-bottom: 10px; }
.cap p { font-size: 14.5px; color: var(--muted); }

.spot { position: relative; overflow: hidden; border-radius: 16px; border: 1px solid var(--line); background: var(--panel); transition: border-color 0.3s ease, box-shadow 0.3s ease; }
.spot:hover { border-color: var(--line-strong); }
.spot:focus-within { border-color: var(--accent-soft); }
.spot:focus-within::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(320px circle at 50% 0%, var(--spot), transparent 70%);
}
@media (hover: none) {
  .spot::before {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(320px circle at 50% 0%, var(--spot), transparent 70%);
  }
}
.spot-glow { position: absolute; inset: 0; transition: opacity 0.35s ease; pointer-events: none; }
.spot-content { position: relative; }

.bento { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; }
.bento-card { padding: 30px 28px 32px; }
.bento-card h3 { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 8px; }
.bento-card > .spot-content > p { font-size: 14.5px; margin-bottom: 26px; }

.balance-total { font-size: clamp(30px, 4vw, 42px); font-weight: 500; letter-spacing: -0.03em; }
.balance-delta { font-size: 13px; color: var(--muted); margin-bottom: 22px; }

.stack { display: flex; gap: 4px; height: 10px; margin-bottom: 20px; }
.stack-seg { flex: 0 1 0%; border-radius: 100px; min-width: 6px; }
.tone-a { background: var(--accent); }
.tone-b { background: var(--accent-soft); }
.tone-c { background: var(--up); }
.tone-d { background: var(--warn); }
.tone-e { background: var(--muted); }

.acct-list { list-style: none; display: grid; gap: 10px; }
.acct-list li { display: flex; align-items: center; gap: 9px; font-size: 14px; color: var(--muted); padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.acct-list li:last-child { border-bottom: 0; padding-bottom: 0; }
.acct-list b { margin-left: auto; font-weight: 500; color: var(--text); font-size: 13.5px; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.budgets { list-style: none; display: grid; gap: 20px; }
.budget-head { display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 9px; }
.budget-left { font-size: 12px; color: var(--muted); }
.bar { height: 7px; border-radius: 100px; background: var(--bg-2); border: 1px solid var(--line); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--accent); }
.bar span.warn { background: var(--warn); }
.bar span.over { background: var(--over); }

.budget-over .bar {
  border-color: var(--over);
  background: rgba(255,107,107,0.12);
  background: color-mix(in srgb, var(--over) 14%, transparent);
}
.budget-over .budget-left { color: var(--over); font-weight: 600; }
.budget-warn .budget-left { color: var(--warn); }
.budget-over .bar span.over {
  background-image: repeating-linear-gradient(
    115deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 9px
  );
  background-color: var(--over);
}

.setup { list-style: none; border-top: 1px solid var(--line); margin-bottom: 36px; }
.setup li { display: flex; align-items: flex-start; gap: 22px; padding: 26px 0; border-bottom: 1px solid var(--line); }
.setup-marker {
  display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0;
  border-radius: 10px; border: 1px solid var(--line-strong);
  background: var(--accent-wash); font-size: 13px; color: var(--accent-soft);
}
[data-theme="light"] .setup-marker { color: var(--accent); }
.setup-body { flex: 1; }
.setup-body h3 { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 5px; }
.setup-body p { font-size: 14.5px; color: var(--muted); max-width: 60ch; }
.setup-time { font-size: 12.5px; color: var(--muted); flex-shrink: 0; padding-top: 4px; }

.roadmap {
  display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap;
  padding: 22px 24px; border-radius: 16px;
  border: 1px solid var(--line); background: var(--panel);
}
.roadmap-icon {
  display: grid; place-items: center; width: 30px; height: 30px; flex-shrink: 0;
  border-radius: 9px; border: 1px solid var(--line-strong);
  background: var(--accent-wash); color: var(--accent-soft);
}
[data-theme="light"] .roadmap-icon { color: var(--accent); }
.roadmap-tag { font-size: 12px; font-weight: 600; color: var(--accent-soft); flex-shrink: 0; padding-top: 7px; }
[data-theme="light"] .roadmap-tag { color: var(--accent); }
.roadmap p { font-size: 14px; color: var(--muted); flex: 1; min-width: 260px; max-width: 70ch; }

.security { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 64px; align-items: center; }
.sec-list { list-style: none; display: grid; gap: 12px; }
.sec-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 14.5px; color: var(--muted); }
.sec-list svg { color: var(--up); flex-shrink: 0; margin-top: 4px; }

.vault {
  display: grid; justify-items: center; text-align: center; gap: 6px;
  padding: 44px 28px; border-radius: 18px;
  border: 1px solid var(--line); background: var(--panel); box-shadow: var(--shadow);
}
.vault svg { color: var(--accent-soft); margin-bottom: 10px; }
[data-theme="light"] .vault svg { color: var(--accent); }
.vault-title { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
.vault-sub { font-size: 13px; color: var(--muted); max-width: 24ch; }

.cta {
  display: flex; flex-wrap: wrap; gap: 36px; align-items: center; justify-content: space-between;
  padding: 52px 44px; border-radius: 22px; border: 1px solid var(--line-strong);
  background: radial-gradient(90% 140% at 8% 0%, var(--accent-wash), transparent 60%), var(--panel);
}
.h2-cta { max-width: 16ch; margin-bottom: 10px; }
.cta-sub { font-size: 14.5px; max-width: 42ch; }

.waitlist { display: flex; gap: 10px; flex-wrap: wrap; }
.waitlist input {
  height: 48px; min-width: 250px; padding: 0 18px; border-radius: 12px;
  border: 1px solid var(--line-strong); background: var(--bg);
  color: var(--text); font: inherit; font-size: 14.5px;
}
.waitlist input::placeholder { color: var(--muted); }
.waitlist input:focus { outline: none; border-color: var(--accent); }
.waitlist .btn { height: 48px; padding: 0 22px; border-radius: 12px; }
.form-error { width: 100%; font-size: 13px; color: var(--warn); }

.joined {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 14px 20px; border-radius: 12px; font-size: 14.5px; font-weight: 500;
  color: var(--up);
  border: 1px solid rgba(59,237,176,0.35);
  border-color: color-mix(in srgb, var(--up) 35%, transparent);
  background: rgba(59,237,176,0.10);
  background: color-mix(in srgb, var(--up) 10%, transparent);
}
[data-theme="light"] .joined { border-color: color-mix(in srgb, var(--up) 35%, transparent); background: color-mix(in srgb, var(--up) 10%, transparent); }

.footer { border-top: 1px solid var(--line); padding: 40px 0; }
.footer-inner { display: grid; gap: 22px; }
.footer-top { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; justify-content: space-between; }
.footer-links { display: flex; flex-wrap: wrap; gap: 22px; }
.footer-links a { font-size: 13.5px; color: var(--muted); text-decoration: none; transition: color 0.2s; }
.footer-links a:hover { color: var(--text); }
.footer-legal { font-size: 12.5px; color: var(--muted); max-width: 90ch; padding-top: 20px; border-top: 1px solid var(--line); }

@media (max-width: 960px) {
  .hero-grid { grid-template-columns: 1fr; gap: 48px; }
  .phone { margin-left: 0; }
  .demo-note { text-align: left; }
  .cap-list { grid-template-columns: 1fr; }
  .bento { grid-template-columns: 1fr; }
  .security { grid-template-columns: 1fr; gap: 36px; }
}

@media (max-width: 720px) {
  .nav-links, .nav-login { display: none; }
  .menu-btn { display: inline-flex; }
  .hero { padding: 60px 0 52px; }
  .section { padding: 72px 0; }
  .hero-facts { gap: 26px; }
  .cta { padding: 36px 26px; }
  .setup li { flex-wrap: wrap; gap: 16px; }
  .setup-time { order: 3; width: 100%; padding-left: 56px; }
  .waitlist, .waitlist input { width: 100%; }
}

@media (max-width: 520px) {
  .header-actions > .btn-solid { display: none; }
  .mobile-sheet-actions { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .feed-row, .bubble.typing i { animation: none !important; }
  .feed-row:nth-child(2) { display: none; }
  .feed-track {
    overflow-x: auto;
    scrollbar-width: thin;
    mask-image: linear-gradient(90deg, #000 88%, transparent);
    -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent);
  }
  .feed-track::-webkit-scrollbar { height: 5px; }
  .feed-track::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 100px; }
  .feed-scroll-hint {
    display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
    padding-right: 24px; font-size: 11.5px; color: var(--muted);
  }
  .bubble.typing i { opacity: 0.5; }
  .aurora { display: none; }
  html { scroll-behavior: auto; }
}
`;