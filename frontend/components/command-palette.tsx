"use client";

/*
 * ⌘K command palette — navigation + actions (cmdk). Opening is decoupled via a
 * window event so the shell's search button and the global hotkey both reach it.
 */

import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Briefcase, ClipboardCheck, Radar, History, UserRound,
  Settings, Sparkles, RefreshCw, MonitorPlay,
} from "lucide-react";

const PALETTE_EVENT = "js:palette";

/** Open the palette from anywhere (shell button, screens, hotkeys). */
export function openPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PALETTE_EVENT));
}

const ITEMS = [
  { group: "Navigate", icon: LayoutDashboard, label: "Dashboard", hint: "overview & caps", href: "/dashboard/" },
  { group: "Navigate", icon: Briefcase, label: "Job Inbox", hint: "triage discovered roles", href: "/jobs/" },
  { group: "Navigate", icon: ClipboardCheck, label: "Review Queue", hint: "human-in-the-loop", href: "/review/" },
  { group: "Navigate", icon: Radar, label: "Run Monitor", hint: "stages & receipts", href: "/runs/" },
  { group: "Navigate", icon: History, label: "Applications", hint: "history & audit", href: "/applications/" },
  { group: "Navigate", icon: UserRound, label: "Master Profile", hint: "verified facts", href: "/profile/" },
  { group: "Navigate", icon: Settings, label: "Settings", hint: "caps · modes · opt-ins", href: "/settings/" },
  { group: "Actions", icon: RefreshCw, label: "Trigger discovery sweep", hint: "POST /jobs/crawl", action: "crawl" },
  { group: "Actions", icon: MonitorPlay, label: "Open automation browser", hint: "POST /browser/launch", action: "browser" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener(PALETTE_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(PALETTE_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const run = async (item: (typeof ITEMS)[number]) => {
    setOpen(false);
    if ("href" in item && item.href) router.push(item.href);
    if ("action" in item && item.action) {
      try {
        const { apiFetch } = await import("@/lib/api/client");
        if (item.action === "crawl") await apiFetch("/jobs/crawl", { method: "POST", body: "{}" });
        if (item.action === "browser") await apiFetch("/browser/launch", { method: "POST" });
      } catch {
        /* offline / fixture mode — the palette still navigates */
      }
    }
  };

  const groups = ["Navigate", "Actions"] as const;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="panel-glass ring-conic relative w-[600px] max-w-full overflow-hidden"
          >
            <Command label="Command palette" className="w-full">
              <div className="flex items-center gap-3 border-b border-border/70 px-4">
                <Sparkles className="size-4 text-accent" />
                <Command.Input
                  autoFocus
                  placeholder="Search jobs, jump to a screen, run an action…"
                  className="h-13 w-full bg-transparent py-4 text-sm outline-none placeholder:text-faint"
                />
                <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint">
                  ESC
                </kbd>
              </div>
              <Command.List className="max-h-[340px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
                  Nothing matches that.
                </Command.Empty>
                {groups.map((g) => (
                  <Command.Group
                    key={g}
                    heading={g}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-faint"
                  >
                    {ITEMS.filter((i) => i.group === g).map((item) => (
                      <Command.Item
                        key={item.label}
                        value={`${item.label} ${item.hint}`}
                        onSelect={() => void run(item)}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text transition-colors data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                      >
                        <item.icon className="size-4" />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-[11px] text-faint">{item.hint}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
              <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-faint">
                <span>JobSeeker</span>
                <span className="flex items-center gap-3">
                  <span>↑↓ move</span>
                  <span>↵ select</span>
                </span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
