"use client";

/*
 * App shell v3 — editorial warm-ink shell. Fraunces wordmark, glass sidebar,
 * theme toggle, ⌘K palette, telemetry pill.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, Briefcase, ClipboardCheck, History, UserRound, Settings,
  Search, Radio,
} from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { bindTelemetry, useLiveRun } from "@/lib/stores/liveRun";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs/", label: "Jobs", icon: Briefcase },
  { href: "/review/", label: "Review", icon: ClipboardCheck },
  { href: "/applications/", label: "Applications", icon: History },
  { href: "/profile/", label: "Profile", icon: UserRound },
  { href: "/settings/", label: "Settings", icon: Settings },
];

function TelemetryPill() {
  const status = useLiveRun((s) => s.wsStatus);
  const reviewPending = useLiveRun((s) => s.reviewPending);
  const tone =
    status === "open"
      ? "text-pos border-pos/30"
      : status === "connecting"
        ? "text-warn border-warn/30"
        : status === "closed"
          ? "text-neg border-neg/30"
          : "text-muted border-border";
  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {reviewPending > 0 && (
          <motion.button
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [1, 1.12, 1], opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-medium text-warn"
          >
            {reviewPending} to review
          </motion.button>
        )}
      </AnimatePresence>
      <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]", tone)}>
        <Radio className={cn("size-3", status === "open" && "animate-breathe")} />
        {status}
      </span>
    </div>
  );
}

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const unbind = bindTelemetry();
    return unbind;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-screen">
      <div className="glow-layer" aria-hidden />
      <div className="grain-layer" aria-hidden />

      <aside className="glass sticky top-0 z-40 flex h-screen w-[236px] shrink-0 flex-col border-r border-border/60">
        <div className="px-6 pb-7 pt-7">
          <div className="display text-[22px] leading-none font-semibold">JobSeeker</div>
          <div className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-muted">apply with proof</div>
        </div>

        <div className="px-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="mb-5 flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted transition-colors hover:border-accent/40 hover:text-text"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href.replace(/\/$/, ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                  active ? "text-text" : "text-muted hover:bg-surface-2/70 hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg border border-accent/25 bg-accent/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <item.icon className={cn("relative z-10 size-4", active && "text-accent")} />
                <span className="relative z-10">{item.label}</span>
                {active && (
                  <span className="relative z-10 ml-auto size-1 rounded-full bg-accent shadow-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3.5">
          <span className="text-[9px] uppercase tracking-[0.2em] text-muted/80">local · yours</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-soft sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 px-8">
          <div className="text-xs text-muted">
            <span className="tnum text-text">Week 0</span> · pipeline scaffolding live
          </div>
          <TelemetryPill />
        </header>
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </div>

      <CommandPalette />
      <ToastBridge />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "color-mix(in srgb, var(--color-surface) 94%, transparent)",
            border: "1px solid var(--color-border)",
            backdropFilter: "blur(12px)",
            color: "var(--color-text)",
          },
        }}
      />
    </div>
  );
}
