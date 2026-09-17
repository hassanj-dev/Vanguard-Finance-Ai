import type { Metadata } from "next";
import Script from "next/script";
import { Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* Only the weights actually used across the app are requested. */
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

export const metadata: Metadata = {
  title: "Vanguard Finance AI",
  description:
    "Vanguard is an expense log you talk to. Send a WhatsApp message and it files the amount, sorts the category, and reports what's left of your limit. Not a bank, no bank login required.",
     icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  };

/**
 * Runs before hydration so a light-mode visitor never sees a dark frame.
 * Lives here (not on a single page) so every route gets the same theme on
 * first load. Keep this in sync with the fallback logic in useTheme().
 *
 * IMPORTANT: this must be rendered via next/script with
 * strategy="beforeInteractive", not a raw <script> tag — React never
 * executes a plain <script dangerouslySetInnerHTML> on the client, it just
 * drops an inert node into the DOM (and logs a console error doing it).
 * next/script's beforeInteractive strategy inlines this into the initial
 * HTML and runs it before any hydration, which is what an anti-flash
 * script actually requires.
 */
const NO_FLASH = `(function(){try{var t=localStorage.getItem("vg-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the inline script below sets data-theme
    // before React hydrates, which would otherwise cause a harmless but
    // noisy attribute mismatch warning on <html>.
    <html lang="en" className={`${figtree.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script
          id="theme-no-flash"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: NO_FLASH }}
        />
        {children}
      </body>
    </html>
  );
}