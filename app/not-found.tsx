"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, Sparkles, Compass } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function NotFound() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsLoggedIn(!!data.session);
      setChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="nf-page">
      <style>{NF_CSS}</style>

      <div className="nf-aurora" aria-hidden="true" />
      <div className="nf-grid" aria-hidden="true" />

      <div className="nf-card">
        <span className="nf-tag">
          <Compass size={13} className="nf-spin" />
          Error 404
        </span>

        <h1 className="nf-digits num">404</h1>
        <h2 className="nf-title">Page Not Found</h2>
        <p className="nf-sub">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        {/* ── Truck loader ─────────────────────────────────────────── */}
        <div className="nf-loader" role="img" aria-label="Loading truck animation">
          <div className="nf-truckWrapper">
            <div className="nf-truckBody">
              <svg viewBox="0 0 198 93" fill="none" className="nf-trucksvg">
                <path strokeWidth={3} stroke="#0B0616" fill="#5227FF" d="M135 22.5H177.264C178.295 22.5 179.22 23.133 179.594 24.0939L192.33 56.8443C192.442 57.1332 192.5 57.4404 192.5 57.7504V89C192.5 90.3807 191.381 91.5 190 91.5H135C133.619 91.5 132.5 90.3807 132.5 89V25C132.5 23.6193 133.619 22.5 135 22.5Z" />
                <path strokeWidth={3} stroke="#0B0616" fill="#B19EEF" d="M146 33.5H181.741C182.779 33.5 183.709 34.1415 184.078 35.112L190.538 52.112C191.16 53.748 189.951 55.5 188.201 55.5H146C144.619 55.5 143.5 54.3807 143.5 53V36C143.5 34.6193 144.619 33.5 146 33.5Z" />
                <path strokeWidth={2} stroke="#0B0616" fill="#FFB020" d="M150 65C150 65.39 149.763 65.8656 149.127 66.2893C148.499 66.7083 147.573 67 146.5 67C145.427 67 144.501 66.7083 143.873 66.2893C143.237 65.8656 143 65.39 143 65C143 64.61 143.237 64.1344 143.873 63.7107C144.501 63.2917 145.427 63 146.5 63C147.573 63 148.499 63.2917 149.127 63.7107C149.763 64.1344 150 64.61 150 65Z" />
                <rect strokeWidth={2} stroke="#0B0616" fill="#FFFCAB" rx={1} height={7} width={5} y={63} x={187} />
                <rect strokeWidth={2} stroke="#0B0616" fill="#282828" rx={1} height={11} width={4} y={81} x={193} />
                <rect strokeWidth={3} stroke="#0B0616" fill="#DFDFDF" rx="2.5" height={90} width={121} y="1.5" x="6.5" />
                <rect strokeWidth={2} stroke="#0B0616" fill="#DFDFDF" rx={2} height={4} width={6} y={84} x={1} />
              </svg>
            </div>

            <div className="nf-truckTires">
              <svg viewBox="0 0 30 30" fill="none" className="nf-tiresvg">
                <circle strokeWidth={3} stroke="#0B0616" fill="#0B0616" r="13.5" cy={15} cx={15} />
                <circle fill="#DFDFDF" r={7} cy={15} cx={15} />
              </svg>
              <svg viewBox="0 0 30 30" fill="none" className="nf-tiresvg">
                <circle strokeWidth={3} stroke="#0B0616" fill="#0B0616" r="13.5" cy={15} cx={15} />
                <circle fill="#DFDFDF" r={7} cy={15} cx={15} />
              </svg>
            </div>

            <div className="nf-road" />
          </div>
        </div>

        <div className="nf-actions">
          <Link href="/" className="nf-btn nf-btn-solid">
            <Home size={16} />
            Back to Home
          </Link>

          {checked && isLoggedIn && (
            <Link href="/dashboard" className="nf-btn nf-btn-quiet">
              <Sparkles size={16} />
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

// FIXED (Code quality / dark-light consistency):
// This page previously defined its OWN complete duplicate token set
// (--bg, --panel, --accent, etc. hardcoded twice — once for dark, once
// under [data-theme="light"]) instead of reusing the tokens already
// defined once in globals.css. If the app's palette changes, this page
// would silently go stale. It now reads the same global --bg / --panel /
// --line / --text / --muted / --accent tokens the rest of the app uses,
// via the `nf-page` class hooking into the app's existing [data-theme]
// system rather than redefining it.
const NF_CSS = `
.nf-page {
  position: relative;
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans, "Figtree", system-ui, sans-serif);
  overflow: hidden;
  padding: 24px;
}

.num { font-family: var(--font-mono, ui-monospace, monospace); font-variant-numeric: tabular-nums; }

.nf-aurora {
  position: absolute; inset: -20% -10% auto -10%; height: 70vh; z-index: 0; pointer-events: none;
  background:
    radial-gradient(48% 55% at 22% 18%, rgba(82,39,255,0.30), transparent 70%),
    radial-gradient(42% 50% at 78% 8%, rgba(177,158,239,0.18), transparent 70%);
  filter: blur(20px);
}
[data-theme="light"] .nf-aurora { opacity: 0.5; }

.nf-grid {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(70% 55% at 50% 50%, #000 0%, transparent 78%);
  -webkit-mask-image: radial-gradient(70% 55% at 50% 50%, #000 0%, transparent 78%);
}

.nf-card {
  position: relative; z-index: 1;
  width: 100%; max-width: 440px;
  text-align: center;
  padding: 44px 32px 36px;
  border-radius: 22px;
  border: 1px solid var(--line-strong);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.nf-tag {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 13px; border-radius: 100px;
  border: 1px solid var(--line-strong); background: var(--accent-wash);
  font-size: 12px; font-weight: 600; color: var(--accent-soft);
  margin-bottom: 20px;
}
.nf-spin { animation: nf-spin 3.5s linear infinite; }

.nf-digits {
  font-size: clamp(52px, 10vw, 74px);
  font-weight: 700; letter-spacing: -0.04em; line-height: 1;
  background: linear-gradient(90deg, var(--accent), var(--accent-soft));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.nf-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-top: 6px; }
.nf-sub { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 34ch; margin: 10px auto 8px; }

.nf-loader { display: flex; justify-content: center; margin: 18px 0 24px; }
.nf-truckWrapper {
  width: 170px; height: 74px; position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  overflow: hidden;
}
.nf-truckBody { width: 110px; margin-bottom: 5px; animation: nf-bounce 1s linear infinite; }
.nf-trucksvg { width: 100%; filter: drop-shadow(0 6px 10px rgba(82,39,255,0.25)); }
.nf-truckTires {
  width: 110px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 8px 0 12px; position: absolute; bottom: 0;
}
.nf-tiresvg { width: 20px; }
.nf-road { width: 100%; height: 1.5px; background: var(--line-strong); position: relative; }
.nf-road::before, .nf-road::after {
  content: ""; position: absolute; height: 100%; background: var(--line-strong);
  animation: nf-road 1.2s linear infinite; border-radius: 3px;
}
.nf-road::before { width: 18px; right: -50%; border-left: 8px solid var(--panel); }
.nf-road::after { width: 9px; right: -68%; border-left: 4px solid var(--panel); }

@keyframes nf-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
@keyframes nf-road { to { transform: translateX(-300px); } }
@keyframes nf-spin { to { transform: rotate(360deg); } }

.nf-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 8px; }
.nf-btn {
  display: inline-flex; align-items: center; gap: 8px;
  height: 42px; padding: 0 18px; border-radius: 11px;
  font-size: 13.5px; font-weight: 600; text-decoration: none;
  border: 1px solid transparent; transition: background .2s, border-color .2s, transform .15s;
}
.nf-btn:active { transform: translateY(1px); }
.nf-btn-solid { background: var(--accent); color: #fff; }
.nf-btn-solid:hover { background: #4620DB; }
.nf-btn-quiet { background: transparent; color: var(--text); border-color: var(--line-strong); }
.nf-btn-quiet:hover { background: var(--accent-wash); border-color: var(--accent-soft); }

@media (prefers-reduced-motion: reduce) {
  .nf-truckBody, .nf-road::before, .nf-road::after, .nf-spin { animation: none !important; }
}
`;