"use client";

/*
 * App shell: sidebar navigation + telemetry status + toast stack.
 * Screens live in the app route folders; this frame stays stable across the build.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { bindTelemetry, useLiveRun } from "@/lib/stores/liveRun";

const NAV = [
  { href: "/dashboard/", label: "Dashboard" },
  { href: "/jobs/", label: "Jobs" },
  { href: "/review/", label: "Review" },
  { href: "/applications/", label: "Applications" },
  { href: "/profile/", label: "Profile" },
  { href: "/settings/", label: "Settings" },
];

const PILL: Record<string, string> = {
  idle: "text-muted border-border",
  connecting: "text-score-mid border-score-mid/40",
  open: "text-score-high border-score-high/40",
  closed: "text-gate-fail border-gate-fail/40",
};

function WsPill() {
  const status = useLiveRun((s) => s.wsStatus);
  const reviewPending = useLiveRun((s) => s.reviewPending);
  return (
    <div className="flex items-center gap-2">
      {reviewPending > 0 && (
        <Link
          href="/review/"
          className="rounded-full border border-prov-llm/50 bg-prov-llm/10 px-2 py-0.5 text-xs text-prov-llm"
        >
          {reviewPending} to review
        </Link>
      )}
      <span className={`rounded-full border px-2 py-0.5 text-xs ${PILL[status]}`}>
        ● telemetry {status}
      </span>
    </div>
  );
}

function Toasts() {
  const toasts = useLiveRun((s) => s.toasts);
  const dismiss = useLiveRun((s) => s.dismissToast);
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => dismiss(toasts[0].id), 6000);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);
  if (toasts.length === 0) return null;
  const tone = {
    info: "border-border text-text",
    hitl: "border-prov-llm/50 text-prov-llm",
    captcha: "border-gate-fail/50 text-gate-fail",
    error: "border-gate-fail/50 text-gate-fail",
  } as const;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.slice(-3).map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`rounded-lg border bg-surface px-3 py-2 text-left text-sm shadow-lg ${tone[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const unbind = bindTelemetry();
    return unbind;
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5">
          <div className="text-lg font-semibold tracking-tight">JobSeeker</div>
          <div className="text-xs text-muted">Apply with proof</div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href.replace(/\/$/, ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-4 py-3">
          <WsPill />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      <Toasts />
    </div>
  );
}
