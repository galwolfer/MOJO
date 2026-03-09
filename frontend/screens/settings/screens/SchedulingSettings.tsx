/**
 * SchedulingSettings
 *
 * Wrapper screen for the Scheduling preferences sub-section.
 * The full implementation lives in BusyBlocksSection which supports:
 *   - DAILY busy blocks (multiple time ranges)
 *   - WEEKLY busy blocks (per-day time ranges)
 *   - SPECIFIC DATE (ONCE) busy blocks (date + multiple time ranges)
 */
import React from "react";
import BusyBlocksSection from "./BusyBlocksSection";
import SettingsSubScreen from "./components/SettingsSubScreen";

type SchedulingSettingsScreenProps = { onBack: () => void };

export default function SchedulingSettingsScreen({ onBack }: SchedulingSettingsScreenProps) {
  return (
    <SettingsSubScreen title="Scheduling" iconName="clock" scrollKey="scheduling-settings" onBack={onBack}>
      <BusyBlocksSection />
    </SettingsSubScreen>
  );
}
