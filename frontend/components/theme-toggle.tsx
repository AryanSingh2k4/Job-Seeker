"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "dark", Icon: Moon, label: "Dark" },
  { id: "light", Icon: Sun, label: "Light" },
] as const;

/** Dual-theme toggle — persisted, switches [data-theme] on <html>. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("js-theme") as "dark" | "light") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const flip = (next: "dark" | "light") => {
    setTheme(next);
    localStorage.setItem("js-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="relative flex items-center gap-0.5 rounded-full border border-border bg-surface-2/50 p-0.5"
    >
      {OPTIONS.map(({ id, Icon, label }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            onClick={() => flip(id)}
            className="relative flex size-7 items-center justify-center rounded-full"
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-full bg-accent shadow-glow"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 size-3.5 transition-colors",
                active ? "text-accent-ink" : "text-muted",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
