"use client";

import { Briefcase } from "lucide-react";

/** Gradient letter avatar keyed off the company name (stable per name). */
export function CompanyAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 60% 22%))`,
        boxShadow: `0 0 16px -6px hsl(${hue} 60% 40% / 0.7)`,
      }}
    >
      {name.slice(0, 1).toUpperCase() || <Briefcase className="size-4" />}
    </div>
  );
}
