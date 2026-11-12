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

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <motion.div
            animate={{ scale: i === step ? 1.08 : 1 }}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border text-xs font-medium",
              i < step
                ? "border-score-high/40 bg-score-high/15 text-score-high"
                : i === step
                  ? "border-accent/50 bg-accent/15 text-accent shadow-glow-accent"
                  : "border-border bg-surface-2 text-muted",
            )}
          >
            {i < step ? <Check className="size-4" /> : i + 1}
          </motion.div>
          {i < STEPS.length - 1 && (
            <motion.div
              animate={{ backgroundColor: i < step ? "#34d39955" : "#1d2836" }}
              className="h-px w-10"
            />
          )}
        </div>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:bg-white/[0.05]";

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

  return (
    <PageIn className="mx-auto max-w-2xl">
      <h1 className="text-[26px] font-semibold tracking-tight">Set up JobSeeker</h1>
      <p className="mt-1 text-sm text-muted">Four steps, one-time. Nothing is trusted until you confirm it.</p>

      <div className="mt-8 flex justify-center">
        <StepDots step={step} />
      </div>

      <div className="glass edge-glow relative mt-8 min-h-[380px] overflow-hidden rounded-2xl p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="mb-5 flex items-center gap-2.5">
              {(() => {
                const Icon = STEPS[step].icon;
                return <Icon className="size-5 text-accent" />;
              })()}
              <div>
                <div className="text-sm font-semibold">{STEPS[step].label}</div>
                <div className="text-xs text-muted">{STEPS[step].blurb}</div>
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
                  "flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-14 transition-colors",
                  dragOver ? "border-accent/60 bg-accent/5" : "border-white/10 bg-white/[0.02]",
                )}
              >
                <Upload className={cn("size-8", dragOver ? "text-accent" : "text-muted")} />
                <div className="mt-3 text-sm">
                  {fileName ? (
                    <span className="text-score-high">{fileName} ready</span>
                  ) : (
                    <>Drop your resume here, or <span className="text-accent">browse</span></>
                  )}
                </div>
                <div className="mt-1.5 text-xs text-muted">PDF / DOCX → parsed into a draft you verify line by line</div>
                <button
                  className="mt-5 flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                  onClick={() =>
                    fileName
                      ? toast.info("Resume parsing lands with backend M1 — your file is staged locally.")
                      : toast.info("Choose a file first (drag it in or use browse).")
                  }
                >
                  <Sparkles className="size-3.5" /> Parse draft
                </button>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="ob-name" className="mb-1.5 block text-xs text-muted">Full name</label><input id="ob-name" className={inputCls} placeholder="Ada Lovelace" value={form.full_name} onChange={set("full_name")} /></div>
                <div><label htmlFor="ob-email" className="mb-1.5 block text-xs text-muted">Email</label><input id="ob-email" type="email" className={inputCls} placeholder="ada@example.com" value={form.email} onChange={set("email")} /></div>
                <div><label htmlFor="ob-phone" className="mb-1.5 block text-xs text-muted">Phone</label><input id="ob-phone" className={inputCls} placeholder="+1 555 0100" value={form.phone} onChange={set("phone")} /></div>
                <div><label htmlFor="ob-city" className="mb-1.5 block text-xs text-muted">City, State</label><input id="ob-city" className={inputCls} placeholder="Austin, TX" value={form.city} onChange={set("city")} /></div>
                <div>
                  <label htmlFor="ob-auth" className="mb-1.5 block text-xs text-muted">Work authorization</label>
                  <select id="ob-auth" className={inputCls} value={form.work_authorization} onChange={set("work_authorization")}><option>US Citizen</option><option>Green Card</option><option>H-1B</option><option>OPT / STEM OPT</option><option>Other</option></select>
                </div>
                <div>
                  <label htmlFor="ob-sponsor" className="mb-1.5 block text-xs text-muted">Requires sponsorship?</label>
                  <select id="ob-sponsor" className={inputCls} value={form.requires_sponsorship} onChange={set("requires_sponsorship")}><option>No</option><option>Yes, now</option><option>Yes, in future</option></select>
                </div>
                <div><label htmlFor="ob-salary" className="mb-1.5 block text-xs text-muted">Salary floor (USD)</label><input id="ob-salary" inputMode="numeric" className={inputCls} placeholder="140000" value={form.salary_floor} onChange={set("salary_floor")} /></div>
                <div><label htmlFor="ob-notice" className="mb-1.5 block text-xs text-muted">Notice period (weeks)</label><input id="ob-notice" inputMode="numeric" className={inputCls} placeholder="2" value={form.notice_weeks} onChange={set("notice_weeks")} /></div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div><label htmlFor="ob-titles" className="mb-1.5 block text-xs text-muted">Target titles (comma-separated)</label><input id="ob-titles" className={inputCls} placeholder="Senior Backend Engineer, Platform Engineer" value={form.target_titles} onChange={set("target_titles")} /></div>
                <div><label htmlFor="ob-locs" className="mb-1.5 block text-xs text-muted">Locations</label><input id="ob-locs" className={inputCls} placeholder="US Remote, Austin TX" value={form.locations} onChange={set("locations")} /></div>
                <div><label htmlFor="ob-excl" className="mb-1.5 block text-xs text-muted">Excluded companies</label><input id="ob-excl" className={inputCls} placeholder="current employer…" value={form.excluded} onChange={set("excluded")} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label htmlFor="ob-cap" className="mb-1.5 block text-xs text-muted">Global daily cap</label><input id="ob-cap" inputMode="numeric" className={inputCls} value={form.daily_cap} onChange={set("daily_cap")} /></div>
                  <div><label htmlFor="ob-hours" className="mb-1.5 block text-xs text-muted">Working hours</label><input id="ob-hours" className={inputCls} defaultValue="08:30–18:30" /></div>
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
                      className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/15"
                    >
                      <span>
                        <span className="block text-sm">{src.name}</span>
                        <span className="block text-[11px] text-muted">{src.desc}</span>
                      </span>
                      <span className={cn("h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors", on ? "bg-accent/40" : "bg-surface-2")}>
                        <motion.span
                          animate={{ x: on ? 20 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 32 }}
                          className={cn("block size-5 rounded-full", on ? "bg-accent" : "bg-muted/60")}
                        />
                      </span>
                    </button>
                  );
                })}
                <div className="pt-1 text-[11px] text-muted">
                  You can change all of this later in Settings.
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-7 flex items-center justify-between border-t border-white/5 pt-5">
          <button
            onClick={back}
            disabled={step === 0}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-xs text-muted transition-colors enabled:hover:text-text disabled:opacity-30"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
          {step < 3 ? (
            <button
              onClick={next}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
              style={{ boxShadow: "0 0 20px -6px #5b8cff88" }}
            >
              Continue <ArrowRight className="size-3.5" />
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={() => void finish()}
              className="flex items-center gap-1.5 rounded-lg bg-score-high/90 px-4 py-2 text-xs font-medium text-[#06281c] transition-colors hover:bg-score-high disabled:opacity-60"
            >
              <Check className="size-4" /> {submitting ? "Saving…" : "Save & enter JobSeeker"}
            </button>
          )}
        </div>
      </div>
    </PageIn>
  );
}
