"use client";

/*
 * Motion primitives — one physics for the whole app. Every screen composes
 * these so entrances, hovers and count-ups feel like one product.
 */

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;
export const SOFT_SPRING = { type: "spring", stiffness: 180, damping: 24 } as const;
export const EASE = [0.22, 1, 0.36, 1] as const;

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

/** Child of <Stagger> — rises, fades and de-blurs in. */
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
        hidden: { opacity: 0, y, filter: "blur(6px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: SPRING },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Reveals in only when scrolled into view (used for below-the-fold bands). */
export function InView({
  children,
  className,
  y = 18,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={{ ...SOFT_SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Word-by-word masked reveal for display headings. */
export function RevealText({
  text,
  className,
  delay = 0,
  wordGap = 0.06,
  as: As = "span",
}: {
  text: string;
  className?: string;
  delay?: number;
  wordGap?: number;
  as?: "span" | "h1" | "h2";
}) {
  const words = text.split(" ");
  return (
    <As className={cn("inline-block", className)}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "115%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: delay + i * wordGap }}
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </As>
  );
}

/** Hover-lift surface with a cursor spotlight. */
export function GlassCard({
  children,
  className,
  hover = true,
  spot = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  spot?: boolean;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      whileHover={hover ? { y: -3, transition: SPRING } : undefined}
      style={style}
      onMouseMove={(e) => {
        if (!spot) return;
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn("panel", spot && "spot", className)}
    >
      {children}
    </motion.div>
  );
}

/** Subtle magnetic hover — pulls the child toward the cursor. */
export function Magnetic({
  children,
  className,
  strength = 10,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <motion.div
      className={cn("inline-flex", className)}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        setPos({ x: dx * strength, y: dy * strength });
      }}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
    >
      {children}
    </motion.div>
  );
}

/** Animated number — springs from 0 (or `from`) to `value` on first view. */
export function CountUp({
  value,
  decimals = 0,
  className,
  suffix = "",
  prefix = "",
}: {
  value: number;
  decimals?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-24px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const text = useTransform(spring, (v) => prefix + v.toFixed(decimals) + suffix);

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
  const tone2 = pct >= 1 ? "var(--color-gate-fail)" : pct >= 0.8 ? "var(--color-score-mid)" : tone;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
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
          whileInView={{ strokeDashoffset: c * (1 - pct) }}
          viewport={{ once: true }}
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
export function PageIn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ ...SOFT_SPRING, stiffness: 210 }}
    >
      {children}
    </motion.div>
  );
}
