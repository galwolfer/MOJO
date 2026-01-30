// Small wrappers around existing widget functions to keep mission code clean
import { buildWidgetString } from "../widgets/widgetUtils.js";
export function buildWidget(widgetType, data = {}) {
  return buildWidgetString(widgetType, data);
}
