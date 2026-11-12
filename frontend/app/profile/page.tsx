"use client";

import { PlannedScreen } from "@/components/planned-screen";

export default function ProfilePage() {
  return (
    <PlannedScreen
      title="Master Profile"
      subtitle="Ground truth — every fact here becomes a claim on your resumes"
      items={[
        "Resume import wizard — draft-then-confirm: every bullet verified before use",
        "Bullet-pool editor with locked metric chips (Amendment A3: numbers are immutable)",
        "QA knowledge base editor (USER_VERIFIED vs LLM_CACHED)",
        "Live with backend M1 (profile CRUD + import)",
      ]}
    />
  );
}
