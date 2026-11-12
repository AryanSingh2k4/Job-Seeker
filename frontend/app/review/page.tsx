"use client";

import { PlannedList, StubScreen } from "@/components/stub-screen";
import { useLiveRun } from "@/lib/stores/liveRun";

export default function ReviewPage() {
  const reviewPending = useLiveRun((s) => s.reviewPending);
  return (
    <StubScreen title="Review Queue" phase={`Human-in-the-loop approvals · ${reviewPending} pending`}>
      <PlannedList
        items={[
          "F3: HITL cards — every Q&A answer with provenance badges (DETERMINISTIC / LLM / UNRESOLVED)",
          "Pause state mirrors the visible automation browser's final review screen",
          "Approve & Submit triggers the backend's final click; Edit writes back to the QA bank",
          "Lands with backend M4 (applier) — see docs/FRONTEND_DASHBOARD_DESIGN.md §3.5",
        ]}
      />
    </StubScreen>
  );
}
