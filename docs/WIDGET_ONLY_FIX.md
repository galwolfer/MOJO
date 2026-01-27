# Widget-Only Response Fix

## Problem
The LLM was receiving both a broken widget format (raw JSON without tags) and the proper widget format (with `<WIDGET_JSON>` tags). This occurred because:
1. Missions like `getUpcomingTasks` return ONLY a widget (`<WIDGET_JSON>...</WIDGET_JSON>`)
2. This widget was being sent to the LLM as a tool result through the message history
3. The LLM's processing would extract and re-output the raw JSON inside the tags, along with the original widget
4. Result: Both formats appeared in the response

## Root Cause
Missions that return ONLY a widget (no surrounding text) were being processed through the LLM via ToolMessage, which caused the LLM to "helpfully" extract and summarize the JSON data separately from the structured widget.

This didn't happen with missions like `addTask` because they return plain text responses like `ok=true\nmsg=...`, not widgets.

## Solution
When a tool returns ONLY a widget (with no surrounding text):
1. Detect that the result is a widget-only response
2. Skip LLM processing entirely
3. Return the widget directly as the final response

This prevents the LLM from ever seeing and processing the widget, eliminating the broken format from appearing.

## Implementation Details

### Changes to [src/agent/agentController.js](src/agent/agentController.js)

#### 1. Main Tool Execution Loop (lines 480-497)
When a tool executes and returns a widget:
- Extract the widget using `captureWidgetBlock(result)`
- Check if the result contains ONLY the widget with no surrounding text
- If widget-only: set `finalResponse = widgetBlock`, persist to memory, and break (skip LLM)
- Otherwise: continue normal flow (add to ToolMessage and invoke LLM)

#### 2. Shortcut Path for get_tasks (lines 265-307)
When the shortcut pattern matches (user asking for task list):
- Extract the widget using `captureWidgetBlock(result)`
- Check if widget is the only content
- If widget-only: set `finalResponse = widgetBlock` and skip LLM invocation
- Otherwise: add to ToolMessage and invoke LLM for natural response

### Detection Logic
```javascript
const resultWithoutWidget = result.replace(/<WIDGET_JSON>[\s\S]*?<\/WIDGET_JSON>/i, "").trim();
if (!resultWithoutWidget || resultWithoutWidget === "") {
  // Widget-only response - skip LLM
  finalResponse = widgetBlock;
  break; // Exit tool loop
}
```

## Affected Missions
This fix applies to any mission that returns ONLY a widget:
- `getUpcomingTasks` - returns `<WIDGET_JSON>upcoming_tasks...</WIDGET_JSON>`
- `getTasksList` - returns `<WIDGET_JSON>task_list...</WIDGET_JSON>`
- Any future missions returning widget-only responses

## Missions Not Affected
Missions that return text + widget or text-only continue to work normally:
- `addTask` - returns `ok=true\nmsg=...` (plain text)
- `previewTask` - returns text + widget (still processed normally)
- Missions with `returnDirect: true` (already skip LLM)

## Benefits
✅ Eliminates duplicate/broken widget formats in LLM responses
✅ Improves performance by skipping unnecessary LLM invocation for data-only responses
✅ Maintains natural language for responses that need it (text + widget combinations)
✅ No changes to mission code required
