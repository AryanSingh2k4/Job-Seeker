"use client";

import { PageIn, Rise } from "@/components/motion";
import { PlannedList } from "@/components/planned-list";

/** Redesigned inner-screen frame: display serif title, gold edge panel. */
export function PlannedScreen({
  title,
  subtitle,
  items,
  extra,
}: {
  title: string;
  subtitle: string;
  items: string[];
  extra?: React.ReactNode;
}) {
  return (
    <PageIn className="mx-auto max-w-3xl">
      <h1 className="display text-[30px] font-semibold">{title}</h1>
      <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
      <Rise className="mt-7">
        <div className="glass edge-glow rounded-2xl p-7">
          <PlannedList items={items} />
          {extra}
        </div>
      </Rise>
    </PageIn>
  );
}
