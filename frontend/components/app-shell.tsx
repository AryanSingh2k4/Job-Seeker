"use client";

/*
 * App shell v5.1 — collapsible sidebar. The top command rail is gone: the
 * wordmark, navigation, search, telemetry and theme toggle now live in a
 * left sidebar that collapses to an icon rail (state persisted). The marquee
 * ticker was removed at the owner's request.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, Briefcase, ClipboardCheck, Radar, History, UserRound,
  Settings, Search, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { CommandPalette, openPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { bindTelemetry, useLiveRun } from "@/lib/stores/liveRun";
import { SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs/", label: "Inbox", icon: Briefcase },
  { href: "/review/", label: "Review", icon: ClipboardCheck },
  { href: "/runs/", label: "Runs", icon: Radar },
  { href: "/applications/", label: "Applications", icon: History },
  { href: "/profile/", label: "Profile", icon: UserRound },
  { href: "/settings/", label: "Settings", icon: Settings },
];

function ToastBridge() {
  const toasts = useLiveRun((s) => s.toasts);
  const lastShown = useRef(0);
  useEffect(() => {
    for (const t of toasts) {
      if (t.id <= lastShown.current) continue;
      lastShown.current = t.id;
      const fn =
        t.kind === "captcha" || t.kind === "error"
          ? toast.error
          : t.kind === "hitl"
            ? toast.warning
            : toast.info;
      fn(t.message, { id: String(t.id), duration: 6000 });
    }
  }, [toasts]);
  return null;
}

function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard/" className={cn("group flex items-center", collapsed ? "justify-center" : "gap-2.5 px-1")}>
      <span className="relative flex size-7 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-[9px] bg-gradient-to-br from-accent to-accent-hover shadow-glow transition-transform duration-500 group-hover:rotate-[18deg]" />
        <span className="absolute inset-[5px] rounded-[5px] bg-bg/80" />
        <span className="relative size-1.5 rounded-full bg-accent-strong" />
      </span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18 }}
            className="display text-[21px] leading-none text-text"
          >
            JobSeeker
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

function TelemetryStatus({ collapsed }: { collapsed: boolean }) {
  const status = useLiveRun((s) => s.wsStatus);
  const reviewPending = useLiveRun((s) => s.reviewPending);
  const tone =
    status === "open" ? "text-pos" : status === "connecting" ? "text-warn" : status === "closed" ? "text-neg" : "text-faint";

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-1">
        <span className={cn("relative flex size-2", tone)} title={`telemetry ${status}`}>
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-40 animate-breathe" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
        {reviewPending > 0 && (
          <motion.span
            initial={{ scale: 0.5 }}
            animate={{ scale: [1, 1.2, 1] }}
            className="tnum rounded-md border border-warn/40 bg-warn/10 px-1 text-[9px] font-semibold text-warn"
          >
            {reviewPending}
          </motion.span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-1">
      <span
        className={cn("flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]", tone)}
        title={`telemetry ${status}`}
      >
        <span className="relative flex size-1.5">
          {status === "open" && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />
          )}
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
        {status}
      </span>
      {reviewPending > 0 && (
        <button
          onClick={() => (window.location.href = "/review/")}
          className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] font-semibold text-warn"
        >
          {reviewPending} to review
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("js-sidebar") === "1");
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      localStorage.setItem("js-sidebar", c ? "0" : "1");
      return !c;
    });
  };

  useEffect(() => bindTelemetry(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || !!t?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-screen">
      <div className="aurora" aria-hidden />
      <div className="grain" aria-hidden />

      {/* collapsible sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 236 }}
        transition={SPRING}
        className="glass sticky top-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden border-r border-border/60"
      >
        <div className={cn("flex h-16 shrink-0 items-center pt-2", collapsed ? "justify-center px-0" : "px-4")}>
          <Wordmark collapsed={collapsed} />
        </div>

        <div className={cn("shrink-0 pb-4", collapsed ? "px-2" : "px-3")}>
          <button
            onClick={() => openPalette()}
            title="Search (⌘K)"
            className={cn(
              "group flex w-full items-center rounded-lg border border-border bg-surface-2/50 text-muted transition-colors hover:border-accent/40 hover:text-text",
              collapsed ? "justify-center py-2.5" : "gap-2 px-3 py-2 text-xs",
            )}
          >
            <Search className="size-3.5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Search…</span>
                <kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href.replace(/\/$/, ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-lg text-[13px] transition-colors",
                  collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2.5",
                  active ? "text-text" : "text-muted hover:bg-surface-2/70 hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="side-nav"
                    className="absolute inset-0 rounded-lg border border-accent/30 bg-accent-soft"
                    transition={SPRING}
                  />
                )}
                <item.icon className={cn("relative z-10 size-4 shrink-0", active && "text-accent")} />
                {!collapsed && <span className="relative z-10">{item.label}</span>}
                {active && collapsed && (
                  <span className="absolute -left-1 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent shadow-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className={cn("shrink-0 space-y-3 border-t border-border/60 py-3.5", collapsed ? "px-2" : "px-4")}>
          <TelemetryStatus collapsed={collapsed} />
          <div className={cn("flex items-center justify-between", collapsed && "flex-col gap-2")}>
            <ThemeToggle />
            <button
              onClick={toggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex size-7 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-accent/40 hover:text-text"
            >
              {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
            </button>
          </div>
        </div>
      </motion.aside>

      <main className="min-w-0 flex-1 px-6 py-10 sm:px-10 lg:px-14 lg:py-12">{children}</main>

      <CommandPalette />
      <ToastBridge />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "color-mix(in srgb, var(--color-surface) 94%, transparent)",
            border: "1px solid var(--color-border)",
            backdropFilter: "blur(14px)",
            color: "var(--color-text)",
            borderRadius: "14px",
          },
        }}
      />
    </div>
  );
}
