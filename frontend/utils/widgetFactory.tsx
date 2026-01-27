/**
 * Widget Component Registry
 * Factory pattern for creating widget components based on type
 */

import React from "react";
import { WidgetData } from "./widgetParser";
import {
  TaskListWidget,
  TaskConfirmationWidget,
  ConfirmationWidget,
  TaskDetailWidget,
  UpcomingTasksWidget,
  ListWidget,
} from "../components/widgets";

/**
 * Type definition for widget component props
 */
export interface BaseWidgetProps {
  data: Record<string, any>;
  onAction?: (actionId: string, actionData?: any) => void;
  entranceEnabled?: boolean; // Optional signal to trigger entrance animations
  entranceDelay?: number; // ms delay before widget entrance animation
  entranceDuration?: number; // ms duration for widget entrance animation
  skipAnimation?: boolean; // Skip animation entirely (e.g., when widget was already shown)
}

/**
 * Widget factory - returns the appropriate component for a widget type
 */
export class WidgetFactory {
  private static componentMap: Record<string, React.ComponentType<BaseWidgetProps>> = {
    list: ListWidget,
    task_list: TaskListWidget,
    task_detail: TaskDetailWidget,
    task_confirmation: TaskConfirmationWidget,
    confirmation: ConfirmationWidget,
    upcoming_tasks: UpcomingTasksWidget,
  };

  /**
   * Register a custom widget component
   */
  static register(type: string, component: React.ComponentType<BaseWidgetProps>) {
    this.componentMap[type] = component;
  }

  /**
   * Get component for a widget type, or null if not found
   */
  static getComponent(type: string): React.ComponentType<BaseWidgetProps> | null {
    return this.componentMap[type] || null;
  }

  /**
   * Check if a widget type is supported
   */
  static isSupported(type: string): boolean {
    return type in this.componentMap;
  }

  /**
   * Get all supported widget types
   */
  static getSupportedTypes(): string[] {
    return Object.keys(this.componentMap);
  }
}

/**
 * Props for the generic WidgetRenderer component
 */
export interface WidgetRendererProps {
  widget: WidgetData;
  onAction?: (actionId: string, actionData?: any) => void;
  entranceEnabled?: boolean;
  entranceDelay?: number;
  entranceDuration?: number;
  skipAnimation?: boolean;
}

/**
 * WidgetRenderer - Universal component that renders any supported widget
 * Usage:
 * ```tsx
 * <WidgetRenderer
 *   widget={parsedWidget}
 *   onAction={(actionId, data) => handleAction(actionId, data)}
 * />
 * ```
 */
export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  widget,
  onAction,
  entranceEnabled,
  entranceDelay,
  entranceDuration,
  skipAnimation,
}) => {
  const Component = WidgetFactory.getComponent(widget.widget_type);

  if (!Component) {
    return null;
  }

  return (
    <Component
      data={widget.data}
      onAction={onAction}
      entranceEnabled={entranceEnabled}
      entranceDelay={entranceDelay}
      entranceDuration={entranceDuration}
      skipAnimation={skipAnimation}
    />
  );
};

export default WidgetRenderer;
