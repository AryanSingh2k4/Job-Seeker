"use client";

/*
 * Settings — automation limits wired to GET/POST /settings (crawl interval +
 * daily company cap per owner spec), modes and opt-ins listed with their gates.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { GlassCard, PageIn, Rise } from "@/components/motion";

interface SettingsShape {
  mode: string;
  autonomous_opt_in: boolean;
  linkedin_opt_in: boolean;
  daily_caps: { linkedin: number; ats: number; global: number };
  working_hours: { start: string; end: string; days: number[] };
  company_cooldown_days: number;
  crawl_interval_minutes: number;
  crawl_max_companies_per_day: number;
}

const inputCls =
  "w-full rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-sm outline-none transition-colors focus:border-accent/50";

export default function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery<SettingsShape>({
    queryKey: ["settings"],
    queryFn: () => apiFetch<SettingsShape>("/settings"),
  });
  const [interval, setInterval_] = useState<string>("");
  const [cap, setCap] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data) {
      setInterval_(String(q.data.crawl_interval_minutes));
      setCap(String(q.data.crawl_max_companies_per_day));
    }
  }, [q.data]);

  const save = async () => {
    try {
      await apiFetch("/settings", {
        method: "POST",
        body: JSON.stringify({
          crawl_interval_minutes: Math.max(1, Number(interval) || 5),
          crawl_max_companies_per_day: Math.max(1, Number(cap) || 50),
        }),
      });
      toast.success("Crawl limits saved");
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      toast.error("Could not save — backend unreachable");
    }
  };

  return (
    <PageIn className="mx-auto max-w-3xl">
      <h1 className="display text-[30px] font-semibold">Settings</h1>
      <p className="mt-1.5 text-sm text-muted">Discovery pace, safety gates, risk lanes.</p>

      <Rise className="mt-7 space-y-5">
        <GlassCard hover={false} className="p-6">
          <div className="mb-1 text-sm font-semibold">Discovery pacing</div>
          <p className="mb-5 text-xs text-muted">
            How often the crawler sweeps, and how many companies it may touch per day.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="set-interval" className="mb-1.5 block text-xs text-muted">
                Sweep interval (minutes)
              </label>
              <input
                id="set-interval"
                inputMode="numeric"
                className={inputCls}
                value={interval}
                onChange={(e) => { setInterval_(e.target.value); setDirty(true); }}
              />
            </div>
            <div>
              <label htmlFor="set-cap" className="mb-1.5 block text-xs text-muted">
                Companies per day
              </label>
              <input
                id="set-cap"
                inputMode="numeric"
                className={inputCls}
                value={cap}
                onChange={(e) => { setCap(e.target.value); setDirty(true); }}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-muted">
              Default 5 min · 50 companies. Lower = gentler on boards.
            </span>
            <button
              onClick={() => void save()}
              disabled={!dirty || q.isLoading}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg transition-opacity disabled:opacity-40"
            >
              <Check className="size-3.5" /> Save
            </button>
          </div>
        </GlassCard>

        <GlassCard hover={false} className="p-6">
          <div className="mb-4 text-sm font-semibold">Submission & risk lanes</div>
          <div className="space-y-3 text-sm">
            <Row label="Submission mode" value={q.data?.mode ?? "assisted"} hint="Assisted = you click Submit" />
            <Row label="Autonomous mode" value={q.data?.autonomous_opt_in ? "on" : "off"} hint="needs ≥95 match + 100% deterministic + opt-in" />
            <Row label="LinkedIn lane" value={q.data?.linkedin_opt_in ? "opted in" : "off"} hint="typed acknowledgment required" />
            <Row label="Company cooldown" value={`${q.data?.company_cooldown_days ?? 14} days`} hint="one application per company per window" />
            <Row
              label="Daily caps"
              value={q.data ? `LI ${q.data.daily_caps.linkedin} · ATS ${q.data.daily_caps.ats} · global ${q.data.daily_caps.global}` : "—"}
              hint="hard limits, DB-enforced"
            />
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted">
            <Pencil className="size-3" /> editable controls land with F3 — values live via API now
          </div>
        </GlassCard>
      </Rise>
    </PageIn>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-2/40 px-4 py-2.5">
      <div>
        <div>{label}</div>
        <div className="text-[11px] text-muted">{hint}</div>
      </div>
      <span className="tnum rounded-md border border-border px-2 py-1 text-xs capitalize text-accent">{value}</span>
    </div>
  );
}
