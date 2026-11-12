"use client";

/*
 * Motion primitives — every screen composes these so the whole app moves
 * with one physics. framer-motion springs, staggered children, count-ups.
 */

import { motion, useMotionValue, useSpring, useTransform, useInView } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

/** Container that staggers its children in. */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.055,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

/** Child of <Stagger> — rises + fades in. */
export function Rise({
  children,
  className,
  y = 14,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: SPRING },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Hover-lift glass card with a light sweep on the top edge. */
export function GlassCard({
  children,
  className,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      whileHover={hover ? { y: -3, transition: SPRING } : undefined}
      className={cn("glass edge-glow rounded-xl", className)}
    >
      {children}
    </motion.div>
  );
}

/** Animated number — springs from 0 (or `from`) to `value` on view. */
export function CountUp({
  value,
  decimals = 0,
  className,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-24px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const text = useTransform(spring, (v) => v.toFixed(decimals) + suffix);

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, mv, value]);

  return (
    <span ref={ref} className={cn("tnum", className)}>
      <motion.span>{text}</motion.span>
    </span>
  );
}

/** Circular progress ring with gradient stroke + glow. */
export function ProgressRing({
  value,
  max,
  size = 64,
  stroke = 6,
  tone = "var(--color-accent)",
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  tone?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone2 =
    pct >= 1 ? "var(--color-gate-fail)" : pct >= 0.8 ? "var(--color-score-mid)" : tone;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-border)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone2}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ ...SPRING, damping: 30 }}
          style={{ filter: `drop-shadow(0 0 6px ${tone2}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-sm font-semibold leading-none">{Math.round(pct * 100)}%</span>
        {label && <span className="mt-0.5 text-[9px] text-muted">{label}</span>}
      </div>
    </div>
  );
}

/** Page-level entrance wrapper. */
export function PageIn({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, stiffness: 220 }}
    >
      {children}
    </motion.div>
  );
}
