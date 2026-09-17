"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search, Heart, Sliders, Globe, ChevronLeft, ChevronRight, Crown, SquareCheckBig, Wallet, X } from "lucide-react";

// FIXED (UI consistency): "todo" was the only lowercase label in this list
// (Dashboard, Search, Subscriptions, Budget, Favorites, Settings are all
// capitalized). Renamed to "To-Do" to match.
const menuItems = [
  { name: "Dashboard", icon: LayoutGrid, path: "/dashboard" },
  { name: "Search", icon: Search, path: "/search" },
  { name: "Subscriptions", icon: Crown, path: "/subscriptions" },
  { name: "To-Do", icon: SquareCheckBig, path: "/todo" },
  { name: "Budget", icon: Wallet, path: "/budget" },
  { name: "Favorites", icon: Heart, path: "/favorites" },
  { name: "Settings", icon: Sliders, path: "/settings" },
];

interface SidebarProps {
  /** Whether the mobile drawer is open. Ignored at lg and above. */
  mobileOpen: boolean;
  /** Called to close the mobile drawer — on backdrop click or after a link tap. */
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  // Desktop-only collapse/expand. Mobile always shows full width in the drawer.
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  const content = (isDrawer: boolean) => (
    <>
      <div className={`flex w-full items-center ${isDrawer ? "justify-between" : isExpanded ? "justify-start" : "justify-center"} mb-6`}>
        {!isDrawer && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2.5 bg-[var(--panel)] border border-[var(--line)] text-[var(--muted)] rounded-full hover:bg-[var(--panel-2)] shadow-sm flex justify-center items-center transition"
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        {isDrawer && (
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--muted)] hover:bg-[var(--panel-2)]"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-4 w-full">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          const showLabel = isDrawer || isExpanded;

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={isDrawer ? onClose : undefined}
              className={`flex items-center gap-4 p-2.5 rounded-full transition-all duration-200 ${
                showLabel ? "w-full px-4" : "justify-center"
              } ${
                isActive
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              }`}
            >
              <div className="flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              {showLabel && (
                <span className="font-medium text-sm whitespace-nowrap">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — normal in-flow column, hidden below lg */}
      <aside
        className={`hidden lg:flex min-h-screen bg-[var(--bg-2)] text-[var(--text)] border-r border-[var(--line)] transition-all duration-300 p-3 flex-col items-center ${
          isExpanded ? "w-64 items-start" : "w-20 items-center"
        }`}
      >
        {content(false)}
      </aside>

      {/* Mobile drawer — fixed overlay, only rendered/interactive below lg */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[var(--bg-2)] border-r border-[var(--line)] p-4 flex flex-col items-start transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        {content(true)}
      </aside>
    </>
  );
}