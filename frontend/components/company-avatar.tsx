"use client";

import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Monogram avatar keyed off the company name. Hue is constrained to the warm
 * amber→olive band so a grid of avatars reads as one considered palette rather
 * than a rainbow.
 */
function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function CompanyAvatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const h = hash(name);
  const hue = 16 + (h % 44); // 16°–60°: amber → gold → olive
  const radius = Math.round(size * 0.3);
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.round(size * 0.4),
        background: `linear-gradient(145deg, hsl(${hue} 42% 34%), hsl(${(hue + 14) % 360} 38% 20%))`,
        boxShadow: `inset 0 1px 0 hsl(${hue} 60% 60% / 0.35), 0 6px 16px -8px hsl(${hue} 50% 12% / 0.9)`,
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "linear-gradient(180deg, #ffffff22, transparent 55%)" }}
      />
      <span className="relative">{name.slice(0, 1).toUpperCase() || <Briefcase className="size-[45%]" />}</span>
    </div>
  );
}
