"use client";

import { PlannedList, StubScreen } from "@/components/stub-screen";

export default function OnboardingPage() {
  return (
    <StubScreen title="Onboarding" phase="First-run wizard — 4 steps, nothing silently trusted">
      <PlannedList
        items={[
          "1. Import: upload resume → draft bullets flagged unverified until you confirm each one",
          "2. Facts: contact, work authorization, sponsorship, salary floor, notice period",
          "3. Preferences: target titles/locations, excluded companies, daily caps",
          "4. Sources: pick discovery boards; LinkedIn stays OFF behind the typed opt-in",
          "Lands with backend M1 (profile + import-resume) — docs/FRONTEND_DASHBOARD_DESIGN.md §3.1",
        ]}
      />
    </StubScreen>
  );
}
