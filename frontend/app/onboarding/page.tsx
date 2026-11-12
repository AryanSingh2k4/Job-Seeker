"use client";

import { PlannedScreen } from "@/components/planned-screen";

export default function OnboardingPage() {
  return (
    <PlannedScreen
      title="Onboarding"
      subtitle="First-run wizard — 4 steps, nothing silently trusted"
      items={[
        "1. Import: upload resume → draft bullets flagged unverified until you confirm each one",
        "2. Facts: contact, work authorization, sponsorship, salary floor, notice period",
        "3. Preferences: target titles/locations, excluded companies, daily caps",
        "4. Sources: pick discovery boards; LinkedIn stays OFF behind the typed opt-in",
        "Live with backend M1 (profile + import-resume)",
      ]}
    />
  );
}
