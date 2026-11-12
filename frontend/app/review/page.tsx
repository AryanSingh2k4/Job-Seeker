"use client";

import { PageIn, Rise } from "@/components/motion";
import { PlannedList } from "@/components/planned-list";

export default function ReviewPage() {
  return (
    <PageIn className="mx-auto max-w-3xl">
      <h1 className="display text-[30px] font-semibold">Review Queue</h1>
      <p className="mt-1 text-sm text-muted">Human-in-the-loop approvals · nothing submits without you</p>
      <Rise className="mt-6">
        <div className="glass edge-glow rounded-xl p-6">
          <PlannedList
            items={[
              "HITL cards — every Q&A answer with provenance badges (DETERMINISTIC / LLM / UNRESOLVED)",
              "Pause state mirrors the visible automation browser's final review screen",
              "Approve & Submit triggers the backend's final click; Edit writes back to the QA bank",
              "Lands with backend M4 (applier)",
            ]}
          />
        </div>
      </Rise>
    </PageIn>
  );
}
