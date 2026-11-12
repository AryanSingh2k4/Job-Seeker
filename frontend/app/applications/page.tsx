"use client";

import { PlannedScreen } from "@/components/planned-screen";

export default function ApplicationsPage() {
  return (
    <PlannedScreen
      title="Applications"
      subtitle="Every run, receipt, and answer — the accountability record"
      items={[
        "History table: status chips, duration, confirmation receipt, screenshot link",
        "Row expands into the full qa_answers_audit trail (tier, confidence, user_verified)",
        "CSV export + funnel analytics land with backend M6",
        "Live with backend M4 (applier)",
      ]}
    />
  );
}
