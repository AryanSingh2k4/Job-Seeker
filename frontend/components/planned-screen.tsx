"use client";

import { PageIn, Rise } from "@/components/motion";
import { PlannedList } from "@/components/planned-list";

export function PlannedScreen({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: string[];
}) {
  return (
    <PageIn className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <Rise className="mt-6">
        <div className="glass edge-glow rounded-xl p-6">
          <PlannedList items={items} />
        </div>
      </Rise>
    </PageIn>
  );
}
