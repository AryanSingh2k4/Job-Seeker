"use client";

/*
 * App shell v2 — aurora backdrop, glass sidebar with icons, topbar with
 * telemetry pill, ⌘K palette, sonner toasts bridged from the WS store.
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
      ? "text-score-high border-score-high/25"
      : status === "connecting"
        ? "text-score-mid border-score-mid/25"
        : status === "closed"
          ? "text-gate-fail border-gate-fail/25"
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
            className="rounded-full border border-prov-llm/40 bg-prov-llm/10 px-2.5 py-1 text-[11px] font-medium text-prov-llm"
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

/** Forwards store toasts to sonner exactly once. */
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
      <div className="aurora-layer" aria-hidden />
      <div className="grain-layer" aria-hidden />

      {/* sidebar */}
      <aside className="glass sticky top-0 z-40 flex h-screen w-[232px] shrink-0 flex-col border-r border-white/5">
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#7c5bff] text-sm font-bold text-white shadow-glow-accent">
            JS
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight tracking-tight">JobSeeker</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">apply with proof</div>
          </div>
        </div>

        <div className="px-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="mb-4 flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-muted transition-colors hover:border-accent/30 hover:text-text"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-white/10 px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href.replace(/\/$/, ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                  active ? "text-text" : "text-muted hover:bg-white/[0.04] hover:text-text",
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
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 px-4 py-3.5 text-[10px] uppercase tracking-widest text-muted/70">
          local · private · yours
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-soft sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 px-8">
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
            background: "rgba(13,20,32,0.92)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            color: "#e8eef6",
          },
        }}
      />
    </div>
  );
}
