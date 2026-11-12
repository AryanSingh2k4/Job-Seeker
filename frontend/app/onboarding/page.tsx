"use client";

/*
 * Onboarding wizard — 4 animated steps.
 * Wired: POST /profile on finish (fixture-mocked pre-M1; import-resume lands at M1).
 * Toggles are real switches; every input has an associated label.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  FileUp, ShieldCheck, SlidersHorizontal, Boxes, ArrowRight, ArrowLeft,
  Check, Upload, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { PageIn } from "@/components/motion";
import { Button, Eyebrow, Panel } from "@/components/ui";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Import", icon: FileUp, blurb: "Upload your resume — AI extracts a draft, you confirm every fact" },
  { label: "Facts", icon: ShieldCheck, blurb: "Contact, work authorization, sponsorship, salary floor" },
  { label: "Preferences", icon: SlidersHorizontal, blurb: "Target titles, locations, exclusions, daily caps" },
  { label: "Sources", icon: Boxes, blurb: "Pick discovery boards — LinkedIn stays OFF behind a typed opt-in" },
];

const SOURCES = [
  { key: "greenhouse", name: "Greenhouse boards", desc: "public application forms — safe default lane" },
  { key: "lever", name: "Lever boards", desc: "public application forms — safe default lane" },
  { key: "ashby", name: "Ashby boards", desc: "public application forms — safe default lane" },
  { key: "linkedin", name: "LinkedIn Easy Apply", desc: "⚠ automation violates LinkedIn's User Agreement — typed opt-in lives in Settings" },
];

function StepRail({ step }: { step: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ scale: active ? 1.08 : 1 }}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done
                    ? "border-pos/40 bg-pos/15 text-pos"
                    : active
                      ? "border-accent/50 bg-accent-soft text-accent shadow-glow"
                      : "border-border bg-surface-2 text-faint",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </motion.div>
              <span className={cn("hidden text-[12px] font-medium sm:block", active ? "text-text" : "text-faint")}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-3 h-px flex-1 bg-border">
                <motion.div
                  className="h-px bg-accent"
                  initial={false}
                  animate={{ width: i < step ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sources, setSources] = useState<Record<string, boolean>>({
    greenhouse: true, lever: true, ashby: true, linkedin: false,
  });
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", city: "", work_authorization: "US Citizen",
    requires_sponsorship: "No", salary_floor: "", notice_weeks: "2",
    target_titles: "", locations: "", excluded: "", daily_cap: "20",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/profile", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          city: form.city,
          work_authorization: form.work_authorization,
          requires_sponsorship: form.requires_sponsorship !== "No",
          target_salary_min: Number(form.salary_floor) || null,
          notice_period_weeks: Number(form.notice_weeks) || 2,
          target_preferences: {
            target_titles: form.target_titles.split(",").map((s) => s.trim()).filter(Boolean),
            locations: form.locations.split(",").map((s) => s.trim()).filter(Boolean),
            excluded_companies: form.excluded.split(",").map((s) => s.trim()).filter(Boolean),
            daily_cap: Number(form.daily_cap) || 20,
            sources,
          },
        }),
      });
      toast.success("Profile saved");
      router.push("/dashboard/");
    } catch {
      toast.error("Could not reach the backend — profile not saved. Start the sidecar or enable fixture mode.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-faint";

  return (
    <PageIn className="mx-auto max-w-3xl">
      <h1 className="display text-[clamp(2.2rem,4vw,3.2rem)] leading-[0.98] text-text">Set up JobSeeker</h1>
      <p className="mt-3 text-sm text-muted">Four steps, one-time. Nothing is trusted until you confirm it.</p>

      <div className="mt-8">
        <StepRail step={step} />
      </div>

      <Panel className="relative mt-8 min-h-[400px] overflow-hidden p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 28, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -28, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="mb-6 flex items-center gap-3">
              {(() => {
                const Icon = STEPS[step].icon;
                return (
                  <span className="flex size-10 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent">
                    <Icon className="size-5" />
                  </span>
                );
              })()}
              <div>
                <div className="text-sm font-semibold">{STEPS[step].label}</div>
                <div className="text-xs text-faint">{STEPS[step].blurb}</div>
              </div>
            </div>

            {step === 0 && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFileName(f.name);
                }}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-14 transition-colors",
                  dragOver ? "border-accent/60 bg-accent/5" : "border-border bg-surface-2/30",
                )}
              >
                <Upload className={cn("size-8", dragOver ? "text-accent" : "text-faint")} />
                <div className="mt-3 text-sm">
                  {fileName ? (
                    <span className="text-pos">{fileName} ready</span>
                  ) : (
                    <>Drop your resume here, or <span className="text-accent">browse</span></>
                  )}
                </div>
                <div className="mt-1.5 text-xs text-faint">PDF / DOCX → parsed into a draft you verify line by line</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() =>
                    fileName
                      ? toast.info("Resume parsing lands with backend M1 — your file is staged locally.")
                      : toast.info("Choose a file first (drag it in or use browse).")
                  }
                >
                  <Sparkles className="size-3.5" /> Parse draft
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="ob-name" className={labelCls}>Full name</label><input id="ob-name" className="field" placeholder="Ada Lovelace" value={form.full_name} onChange={set("full_name")} /></div>
                <div><label htmlFor="ob-email" className={labelCls}>Email</label><input id="ob-email" type="email" className="field" placeholder="ada@example.com" value={form.email} onChange={set("email")} /></div>
                <div><label htmlFor="ob-phone" className={labelCls}>Phone</label><input id="ob-phone" className="field" placeholder="+1 555 0100" value={form.phone} onChange={set("phone")} /></div>
                <div><label htmlFor="ob-city" className={labelCls}>City, State</label><input id="ob-city" className="field" placeholder="Austin, TX" value={form.city} onChange={set("city")} /></div>
                <div>
                  <label htmlFor="ob-auth" className={labelCls}>Work authorization</label>
                  <select id="ob-auth" className="field" value={form.work_authorization} onChange={set("work_authorization")}><option>US Citizen</option><option>Green Card</option><option>H-1B</option><option>OPT / STEM OPT</option><option>Other</option></select>
                </div>
                <div>
                  <label htmlFor="ob-sponsor" className={labelCls}>Requires sponsorship?</label>
                  <select id="ob-sponsor" className="field" value={form.requires_sponsorship} onChange={set("requires_sponsorship")}><option>No</option><option>Yes, now</option><option>Yes, in future</option></select>
                </div>
                <div><label htmlFor="ob-salary" className={labelCls}>Salary floor (USD)</label><input id="ob-salary" inputMode="numeric" className="field" placeholder="140000" value={form.salary_floor} onChange={set("salary_floor")} /></div>
                <div><label htmlFor="ob-notice" className={labelCls}>Notice period (weeks)</label><input id="ob-notice" inputMode="numeric" className="field" placeholder="2" value={form.notice_weeks} onChange={set("notice_weeks")} /></div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div><label htmlFor="ob-titles" className={labelCls}>Target titles (comma-separated)</label><input id="ob-titles" className="field" placeholder="Senior Backend Engineer, Platform Engineer" value={form.target_titles} onChange={set("target_titles")} /></div>
                <div><label htmlFor="ob-locs" className={labelCls}>Locations</label><input id="ob-locs" className="field" placeholder="US Remote, Austin TX" value={form.locations} onChange={set("locations")} /></div>
                <div><label htmlFor="ob-excl" className={labelCls}>Excluded companies</label><input id="ob-excl" className="field" placeholder="current employer…" value={form.excluded} onChange={set("excluded")} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label htmlFor="ob-cap" className={labelCls}>Global daily cap</label><input id="ob-cap" inputMode="numeric" className="field" value={form.daily_cap} onChange={set("daily_cap")} /></div>
                  <div><label htmlFor="ob-hours" className={labelCls}>Working hours</label><input id="ob-hours" className="field" defaultValue="08:30–18:30" /></div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                {SOURCES.map((src) => {
                  const on = sources[src.key];
                  return (
                    <button
                      key={src.key}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => {
                        if (src.key === "linkedin") {
                          toast.warning("LinkedIn requires the typed risk acknowledgment in Settings — kept OFF here.");
                          return;
                        }
                        setSources((s) => ({ ...s, [src.key]: !s[src.key] }));
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-surface-2/30 px-4 py-3.5 text-left transition-colors hover:border-accent/40"
                    >
                      <span>
                        <span className="block text-sm">{src.name}</span>
                        <span className="block text-[11px] text-faint">{src.desc}</span>
                      </span>
                      <span className={cn("h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors", on ? "bg-accent/40" : "bg-surface-3")}>
                        <motion.span
                          animate={{ x: on ? 20 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 32 }}
                          className={cn("block size-5 rounded-full", on ? "bg-accent" : "bg-faint")}
                        />
                      </span>
                    </button>
                  );
                })}
                <div className="pt-1 text-[11px] text-faint">You can change all of this later in Settings.</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-5">
          <Button variant="ghost" size="sm" onClick={back} disabled={step === 0}>
            <ArrowLeft className="size-3.5" /> Back
          </Button>
          {step < 3 ? (
            <Button variant="primary" size="md" onClick={next}>
              Continue <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button variant="primary" size="md" disabled={submitting} onClick={() => void finish()}>
              <Check className="size-4" /> {submitting ? "Saving…" : "Save & enter JobSeeker"}
            </Button>
          )}
        </div>
      </Panel>
    </PageIn>
  );
}
