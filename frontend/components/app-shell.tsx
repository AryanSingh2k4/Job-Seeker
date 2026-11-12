"use client";

/*
 * App shell v5 — "command rail". The old glass sidebar is gone: navigation is
 * a centred segmented control, telemetry lives in a live ticker under the rail,
 * and a scroll-progress hairline rides the very top edge.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, Briefcase, ClipboardCheck, Radar, History, UserRound,
  Settings, Search, Command as CommandIcon,
} from "lucide-react";
import { CommandPalette, openPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { bindTelemetry, useLiveRun } from "@/lib/stores/liveRun";
import type { TelemetryEvent } from "@/lib/ws/client";
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

const DEFAULT_TICKER = [
  "crawler sweeps every 5 min",
  "50 companies / day cap",
  "scoring is deterministic + LLM",
  "nothing submits without your sign-off",
  "receipts and screenshots kept for every run",
];

function describe(e: TelemetryEvent): string {
  switch (e.type) {
    case "APPLICATION_STAGE_CHANGED":
      return `${e.payload.company} · ${e.payload.stage.replace(/_/g, " ").toLowerCase()} · ${e.payload.currentStep}/${e.payload.totalSteps}`;
    case "HITL_REVIEW_REQUIRED":
      return `review needed · ${e.payload.company} — ${e.payload.title}`;
    case "CAPTCHA_CHALLENGE_DETECTED":
      return `security check · ${e.payload.company} · ${e.payload.captchaType.replace(/_/g, " ").toLowerCase()}`;
    case "RATE_LIMIT_UPDATE":
      return `quota · linkedin ${e.payload.dailyLinkedInUsed}/${e.payload.dailyLinkedInLimit} · ats ${e.payload.dailyATSUsed}/${e.payload.dailyATSLimit}`;
    case "SWEEP_COMPLETED":
      return `sweep complete · +${e.payload.new_jobs} new · ${e.payload.filtered} filtered`;
    default:
      return "telemetry";
  }
}

function Wordmark() {
  return (
    <Link href="/dashboard/" className="group flex items-center gap-2.5">
      <span className="relative flex size-7 items-center justify-center">
        <span className="absolute inset-0 rounded-[9px] bg-gradient-to-br from-accent to-accent-hover shadow-glow transition-transform duration-500 group-hover:rotate-[18deg]" />
        <span className="absolute inset-[5px] rounded-[5px] bg-bg/80" />
        <span className="relative size-1.5 rounded-full bg-accent-strong" />
      </span>
      <span className="display text-[21px] leading-none text-text">JobSeeker</span>
    </Link>
  );
}

function TelemetryPill() {
  const status = useLiveRun((s) => s.wsStatus);
  const reviewPending = useLiveRun((s) => s.reviewPending);
  const tone =
    status === "open"
      ? "text-pos"
      : status === "connecting"
        ? "text-warn"
        : status === "closed"
          ? "text-neg"
          : "text-faint";
  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {reviewPending > 0 && (
          <motion.button
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            onClick={() => (window.location.href = "/review/")}
            className="hidden rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-semibold text-warn sm:inline-flex"
          >
            {reviewPending} to review
          </motion.button>
        )}
      </AnimatePresence>
      <span
        className={cn(
          "hidden items-center gap-2 rounded-full border border-border/70 bg-surface-2/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:flex",
          tone,
        )}
        title={`telemetry ${status}`}
      >
        <span className="relative flex size-1.5">
          {status === "open" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          )}
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
        {status}
      </span>
    </div>
  );
}

function Ticker() {
  const events = useLiveRun((s) => s.events);
  const live = events.slice(-6).map(describe).reverse();
  const items = live.length ? live : DEFAULT_TICKER;
  return (
    <div className="relative overflow-hidden border-b border-border/60 bg-surface/40">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent" />
      <div className="marquee gap-10 py-1.5">
        {[...items, ...items].map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] tracking-[0.02em] text-faint"
          >
            <span className={cn("size-1 rounded-full", live.length ? "bg-accent/70" : "bg-border-strong")} />
            {t}
          </span>
        ))}
      </div>
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
  const { scrollYProgress } = useScroll();

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
    <div className="relative min-h-screen">
      <div className="aurora" aria-hidden />
      <div className="grain" aria-hidden />

      <motion.div
        style={{ scaleX: scrollYProgress }}
        className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-gradient-to-r from-accent via-accent-strong to-accent"
        aria-hidden
      />

      <header className="sticky top-0 z-50">
        <div className="border-b border-border/70 bg-bg/75 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-5 sm:px-8">
            <Wordmark />

            <nav className="ml-5 hidden items-center gap-0.5 lg:flex">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href.replace(/\/$/, ""));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors",
                      active ? "text-text" : "text-muted hover:text-text",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="rail-nav"
                        className="absolute inset-0 rounded-full border border-accent/30 bg-accent-soft"
                        transition={SPRING}
                      />
                    )}
                    <item.icon
                      className={cn("relative z-10 size-[15px]", active && "text-accent")}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => openPalette()}
                className="group flex items-center gap-2 rounded-full border border-border bg-surface-2/50 py-1.5 pl-3 pr-2 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-text"
              >
                <Search className="size-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint sm:flex">
                  <CommandIcon className="size-2.5" />K
                </kbd>
              </button>
              <TelemetryPill />
              <ThemeToggle />
            </div>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto px-5 pb-2 sm:px-8 lg:hidden">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href.replace(/\/$/, ""));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                    active
                      ? "border-accent/35 bg-accent-soft text-accent"
                      : "border-border/70 text-muted",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Ticker />
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-5 py-10 sm:px-8 lg:py-14">
        {children}
      </main>

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
