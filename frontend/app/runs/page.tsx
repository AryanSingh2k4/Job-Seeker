"use client";

import { PlannedScreen } from "@/components/planned-screen";

export default function RunsPage() {
  return (
    <PlannedScreen
      title="Run Monitor"
      subtitle="Open with /runs?id=<applicationId> — watch the bot work stage by stage"
      items={[
        "Animated stage stepper: NAVIGATING → FILLING → UPLOADING → ANSWERING → REVIEW → SUBMITTED",
        "CAPTCHA banner with the 5-minute AFK countdown (Amendment A4, made visible)",
        "Scrollable event log + screenshot thumbnail",
        "Live with backend M4 (applier)",
      ]}
    />
  );
}
