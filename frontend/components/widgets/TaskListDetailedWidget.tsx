/**
 * TaskListDetailedWidget (REMOVED)
 *
 * This widget has been removed from the project. Keeping a lightweight
 * stub here prevents accidental crashes if an old reference remains.
 */

import React from "react";
import { View } from "react-native";
import { BaseWidgetProps } from "../../utils/widgetFactory";

const RemovedTaskListDetailedWidget: React.FC<BaseWidgetProps> = () => {
  // Warn at runtime if something still tries to render this widget
  // so developers can track down lingering references.
  if (typeof console !== "undefined" && console.warn) {
    console.warn("[TaskListDetailedWidget] This widget type was removed — use 'task_list' instead.");
  }
  return null;
};

export default RemovedTaskListDetailedWidget;
