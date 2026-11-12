"use client";

import { PlannedScreen } from "@/components/planned-screen";

export default function SettingsPage() {
  return (
    <PlannedScreen
      title="Settings"
      subtitle="Caps, hours, modes, platform risk lanes, browser runtime"
      items={[
        "Automation: Assisted (default) vs Autonomous (≥95 + 100% deterministic + opt-in)",
        "Platform opt-ins — LinkedIn requires the typed risk acknowledgment (A6)",
        "Browser runtime: launch/attach the dedicated automation profile, login wizard",
        "LLM routing + monthly budget gauge (cheap-first)",
        "Live with backend M0/M1 settings endpoints",
      ]}
    />
  );
}
