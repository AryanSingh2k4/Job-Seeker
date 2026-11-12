"use client";

import { PlannedList, StubScreen } from "@/components/stub-screen";

export default function RunsPage() {
  return (
    <StubScreen title="Run Monitor" phase={`Open with /runs?id=<applicationId> (query route, D17)`}>
      <PlannedList
        items={[
          "Stage stepper: NAVIGATING → FILLING_FIELDS → UPLOADING_RESUME → ANSWERING_QA → PAUSED_FOR_REVIEW → SUBMITTED/FAILED",
          "CAPTCHA banner with the 5-minute AFK countdown (Amendment A4, made visible)",
          "Scrollable event log + screenshot thumbnail",
          "Lands with backend M4 — see docs/FRONTEND_DASHBOARD_DESIGN.md §3.6",
        ]}
      />
    </StubScreen>
  );
}
