"use client";

/*
 * ⌘K command palette — navigation + actions (cmdk), framer-motion animated.
 */

import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Briefcase, ClipboardCheck, History, UserRound, Settings,
  Sparkles, RefreshCw, MonitorPlay,
} from "lucide-react";

const ITEMS = [
  { group: "Navigate", icon: LayoutDashboard, label: "Dashboard", hint: "overview & caps", href: "/dashboard/" },
  { group: "Navigate", icon: Briefcase, label: "Job Inbox", hint: "triage discovered roles", href: "/jobs/" },
  { group: "Navigate", icon: ClipboardCheck, label: "Review Queue", hint: "HITL approvals", href: "/review/" },
  { group: "Navigate", icon: History, label: "Applications", hint: "history & receipts", href: "/applications/" },
  { group: "Navigate", icon: UserRound, label: "Master Profile", hint: "verified facts", href: "/profile/" },
  { group: "Navigate", icon: Settings, label: "Settings", hint: "caps · modes · opt-ins", href: "/settings/" },
  { group: "Actions", icon: RefreshCw, label: "Trigger discovery sweep", hint: "POST /jobs/crawl", action: "crawl" },
  { group: "Actions", icon: MonitorPlay, label: "Open automation browser", hint: "POST /browser/launch", action: "browser" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        /* offline / mock mode — palette still navigates */
      }
    }
  };

  const groups = ["Navigate", "Actions"] as const;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[16vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="glass relative w-[560px] max-w-[92vw] overflow-hidden rounded-2xl"
          >
            <Command label="Command palette" className="w-full">
              <div className="flex items-center gap-2 border-b border-white/5 px-4">
                <Sparkles className="size-4 text-accent" />
                <Command.Input
                  autoFocus
                  placeholder="Type a command or search…"
                  className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
                />
                <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
              </div>
              <Command.List className="max-h-[320px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
                  Nothing matches.
                </Command.Empty>
                {groups.map((g) => (
                  <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted/80">
                    {ITEMS.filter((i) => i.group === g).map((item) => (
                      <Command.Item
                        key={item.label}
                        value={`${item.label} ${item.hint}`}
                        onSelect={() => void run(item)}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                      >
                        <item.icon className="size-4" />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-xs text-muted">{item.hint}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
