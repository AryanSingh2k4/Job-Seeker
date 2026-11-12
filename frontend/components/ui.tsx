"use client";

/*
 * UI kit v5 — the small vocabulary every screen speaks. Buttons carry a light
 * sweep, panels carry a cursor spotlight, chips carry tone. All tokens live in
 * globals.css so this stays thin.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import {
  useMemo,
  useRef,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { RevealText, SPRING } from "@/components/motion";

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
};
const SIZES: Record<Size, string> = { sm: "btn-sm", md: "btn-md", lg: "btn-lg" };

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: { variant?: Variant; size?: Size } & ComponentProps<"button">) {
  return (
    <button className={cn("btn", VARIANTS[variant], SIZES[size], className)} {...rest}>
      {variant === "primary" && <span className="sheen" aria-hidden />}
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

export function ButtonLink({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: { variant?: Variant; size?: Size } & ComponentProps<typeof Link>) {
  return (
    <Link className={cn("btn", VARIANTS[variant], SIZES[size], className)} {...rest}>
      {variant === "primary" && <span className="sheen" aria-hidden />}
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------- Panel */

export function Panel({
  children,
  className,
  hover = false,
  spot = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  spot?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      style={style}
      onMouseMove={
        spot
          ? (e) => {
              const el = ref.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              el.style.setProperty("--mx", `${e.clientX - r.left}px`);
              el.style.setProperty("--my", `${e.clientY - r.top}px`);
            }
          : undefined
      }
      className={cn(
        "panel",
        spot && "spot",
        hover && "transition-transform duration-300 hover:-translate-y-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- Chip */

type Tone = "neutral" | "accent" | "pos" | "warn" | "neg";

const CHIP_TONES: Record<Tone, string> = {
  neutral: "border-border bg-surface-2 text-muted",
  accent: "border-accent/35 bg-accent-soft text-accent",
  pos: "border-pos/30 bg-pos/10 text-pos",
  warn: "border-warn/30 bg-warn/10 text-warn",
  neg: "border-neg/30 bg-neg/10 text-neg",
};

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Eyebrow */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-faint",
        className,
      )}
    >
      <span className="inline-block h-px w-6 bg-gradient-to-r from-accent/70 to-transparent" />
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- PageHeader */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-10 gap-y-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <h1 className="display text-[clamp(2.3rem,4.2vw,3.5rem)] leading-[0.98] text-text">
          <RevealText text={title} />
        </h1>
        {subtitle && (
          <p className="mt-3.5 max-w-2xl text-[14.5px] leading-relaxed text-muted balance">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------ SectionTitle */

export function SectionTitle({
  children,
  hint,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-faint">
        {children}
      </h2>
      {hint && <div className="text-[11px] text-faint">{hint}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
        {label}
      </span>
      <span className="hero-num mt-2 text-[clamp(2.4rem,3.4vw,3.2rem)] leading-none text-text">
        {value}
      </span>
      {hint && <span className="mt-2 text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

/* --------------------------------------------------------------- Sparkline */

export function Sparkline({
  data,
  width = 132,
  height = 40,
  tone = "var(--color-accent)",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: string;
  className?: string;
}) {
  const { line, area } = useMemo(() => {
    if (data.length < 2) return { line: "", area: "" };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const step = width / (data.length - 1);
    const pts = data.map((d, i) => {
      const x = i * step;
      const y = height - 4 - ((d - min) / span) * (height - 10);
      return [x, y] as const;
    });
    const l = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const a = `${l} L${width},${height} L0,${height} Z`;
    return { line: l, area: a };
  }, [data, width, height]);

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={`spark-${tone.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${tone.replace(/[^a-z]/gi, "")})`} />
      <motion.path
        d={line}
        fill="none"
        stroke={tone}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ Meter */

export function Meter({
  label,
  value,
  max,
  tone = "var(--color-accent)",
  delay = 0,
}: {
  label: string;
  value: number;
  max: number;
  tone?: string;
  delay?: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tnum text-text">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone, boxShadow: `0 0 14px -2px ${tone}` }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ ...SPRING, damping: 30, delay }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-center justify-center px-8 py-16 text-center",
        className,
      )}
    >
      <div className="relative flex size-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-accent">
        <span className="absolute inset-0 rounded-2xl bg-accent/10 blur-md" aria-hidden />
        <span className="relative">{icon}</span>
      </div>
      <h3 className="display mt-5 text-[22px] leading-tight text-text">{title}</h3>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted balance">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
