"use client";

import { PlannedList, StubScreen } from "@/components/stub-screen";

export default function ProfilePage() {
  return (
    <StubScreen title="Master Profile" phase="Ground truth — every fact here becomes a claim on your resumes">
      <PlannedList
        items={[
          "F1/F2: resume import wizard — draft-then-confirm, every bullet verified before use",
          "Bullet-pool editor with locked metric chips (Amendment A3: numbers are immutable)",
          "QA knowledge base editor (USER_VERIFIED vs LLM_CACHED sources)",
          "Lands with backend M1 (profile CRUD + import) — docs/FRONTEND_DASHBOARD_DESIGN.md §3.8",
        ]}
      />
    </StubScreen>
  );
}
