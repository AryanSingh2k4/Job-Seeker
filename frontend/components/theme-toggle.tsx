"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

/** Dual-theme toggle — persisted, switches [data-theme] on <html>. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("js-theme") as "dark" | "light") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("js-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button
      onClick={flip}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="relative flex h-8 w-16 items-center rounded-full border border-border bg-surface-2 px-1"
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className="flex size-6 items-center justify-center rounded-full bg-accent text-bg"
        style={{ marginLeft: theme === "dark" ? 0 : "auto" }}
      >
        {theme === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </motion.span>
    </button>
  );
}
