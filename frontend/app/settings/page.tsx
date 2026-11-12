"use client";

/*
 * Settings — automation limits wired to GET/POST /settings (crawl interval +
 * daily company cap per owner spec), modes and opt-ins listed with their gates.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Pencil, Gauge } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageIn, Rise } from "@/components/motion";
import { Button, Chip, PageHeader, Panel, SectionTitle } from "@/components/ui";

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

function Row({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-2/40 px-4 py-3">
      <div>
        <div className="text-[13px]">{label}</div>
        <div className="mt-0.5 text-[11px] text-faint">{hint}</div>
      </div>
      <Chip tone="accent" className="shrink-0 capitalize">{value}</Chip>
    </div>
  );
}

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
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="Discovery pace, safety gates and risk lanes. Limits are enforced in the database, not the UI."
      />

      <Rise className="mt-10 space-y-5">
        <Panel className="p-6">
          <div className="mb-1 text-sm font-semibold">Appearance</div>
          <div className="text-[11px] text-faint">Dark or light — applies instantly, remembered on this device.</div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 bg-surface-2/40 px-4 py-3">
            <span className="text-sm">Theme</span>
            <ThemeToggle />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent">
              <Gauge className="size-4" />
            </span>
            <div>
              <div className="text-sm font-semibold">Discovery pacing</div>
              <div className="text-[11px] text-faint">How often the crawler sweeps, and how many companies it may touch per day.</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="set-interval" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                Sweep interval (minutes)
              </label>
              <input
                id="set-interval"
                inputMode="numeric"
                className="field"
                value={interval}
                onChange={(e) => { setInterval_(e.target.value); setDirty(true); }}
              />
            </div>
            <div>
              <label htmlFor="set-cap" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                Companies per day
              </label>
              <input
                id="set-cap"
                inputMode="numeric"
                className="field"
                value={cap}
                onChange={(e) => { setCap(e.target.value); setDirty(true); }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <span className="text-[11px] leading-relaxed text-faint">
              Default 5 min · 50 companies. Lower = gentler on boards.
            </span>
            <Button variant="primary" size="md" onClick={() => void save()} disabled={!dirty || q.isLoading}>
              <Check className="size-3.5" /> Save
            </Button>
          </div>
        </Panel>

        <Panel className="p-6">
          <SectionTitle>Submission &amp; risk lanes</SectionTitle>
          <div className="mt-5 space-y-3">
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
          <div className="mt-5 flex items-center gap-1.5 text-[11px] text-faint">
            <Pencil className="size-3" /> editable controls land with F3 — values live via API now
          </div>
        </Panel>
      </Rise>
    </PageIn>
  );
}
