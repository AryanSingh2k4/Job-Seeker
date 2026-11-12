"use client";

import { PlannedList, StubScreen } from "@/components/stub-screen";

export default function SettingsPage() {
  return (
    <StubScreen title="Settings" phase="Caps, hours, modes, platform risk lanes, browser runtime">
      <PlannedList
        items={[
          "Automation: Assisted (default) vs Autonomous (≥95 + 100% deterministic + opt-in)",
          "Platform opt-ins — LinkedIn requires the typed risk acknowledgment (A6)",
          "Browser runtime screen: launch/attach the dedicated automation profile, login wizard",
          "LLM routing + monthly budget gauge (cheap-first)",
          "Lands with backend M0/M1 settings endpoints — docs/FRONTEND_DASHBOARD_DESIGN.md §3.9",
        ]}
      />
    </StubScreen>
  );
}
