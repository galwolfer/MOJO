import React from "react";
import SettingsSubScreen from "./components/SettingsSubScreen";
import BusyBlocksSection from "../../../components/special/BusyBlocksSection";

type SchedulingSettingsScreenProps = { onBack: () => void };

export default function SchedulingSettingsScreen({ onBack }: SchedulingSettingsScreenProps) {
  return (
    <SettingsSubScreen title="Scheduling" iconName="clock" scrollKey="scheduling-settings" onBack={onBack}>
      <BusyBlocksSection />
    </SettingsSubScreen>
  );
}
