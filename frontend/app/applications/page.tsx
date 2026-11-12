"use client";

import { PlannedList, StubScreen } from "@/components/stub-screen";

export default function ApplicationsPage() {
  return (
    <StubScreen title="Applications" phase="Every run, receipt, and answer — the accountability record">
      <PlannedList
        items={[
          "History table: status chips, duration, confirmation receipt, screenshot link",
          "Row expands into the full qa_answers_audit trail (tier, confidence, user_verified)",
          "CSV export + funnel analytics land in F4 (backend M6)",
          "Lands with backend M4 — see docs/FRONTEND_DASHBOARD_DESIGN.md §3.7",
        ]}
      />
    </StubScreen>
  );
}
