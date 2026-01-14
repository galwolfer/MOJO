/**
 * Widget Component Registry
 * Factory pattern for creating widget components based on type
 */

import React from "react";
import { WidgetData } from "./widgetParser";
import TaskListWidget from "../components/widgets/TaskListWidget";
import TaskConfirmationWidget from "../components/widgets/TaskConfirmationWidget";
import ConfirmationWidget from "../components/widgets/ConfirmationWidget";
import CalendarEventWidget from "../components/widgets/CalendarEventWidget";
import TaskDetailWidget from "../components/widgets/TaskDetailWidget";
import TaskListDetailedWidget from "../components/widgets/TaskListDetailedWidget";

/**
 * Type definition for widget component props
 */
export interface BaseWidgetProps {
  data: Record<string, any>;
  onAction?: (actionId: string, actionData?: any) => void;
}

/**
 * Widget factory - returns the appropriate component for a widget type
 */
export class WidgetFactory {
  private static componentMap: Record<string, React.ComponentType<BaseWidgetProps>> = {
    task_list: TaskListWidget,
    task_list_detailed: TaskListDetailedWidget,
    task_detail: TaskDetailWidget,
    task_confirmation: TaskConfirmationWidget,
    confirmation: ConfirmationWidget,
    calendar_event: CalendarEventWidget,
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
export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, onAction }) => {
  const Component = WidgetFactory.getComponent(widget.widget_type);

  if (!Component) {
    console.warn(`[WidgetRenderer] Unknown widget type: ${widget.widget_type}`);
    return null;
  }

  return <Component data={widget.data} onAction={onAction} />;
};

export default WidgetRenderer;
