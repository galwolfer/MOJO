import { DynamicStructuredTool } from "@langchain/core/tools";

export class Mission {
  constructor({
    name,
    description,
    schema,
    execute,
    group,
    weight = "light",
    widgets = [],
    behavior = [],
    missionInfo,
    returnDirect = false,
  }) {
    if (!name) throw new Error("Mission requires a name");
    if (!description) throw new Error(`Mission ${name} requires a description`);
    if (!schema) throw new Error(`Mission ${name} requires a schema`);
    if (typeof execute !== "function") throw new Error(`Mission ${name} requires an execute function`);

    this.name = name;
    this.description = description;
    this.schema = schema;
    this.execute = execute;
    this.group = group || "misc";
    this.weight = weight;
    this.widgets = widgets;
    this.behavior = Array.isArray(behavior) ? behavior : behavior ? [behavior] : [];
    this.missionInfo = missionInfo || description;
    this.returnDirect = Boolean(returnDirect);
  }

  buildTool(context = {}) {
    return new DynamicStructuredTool({
      name: this.name,
      description: this.description,
      schema: this.schema,
      returnDirect: this.returnDirect,
      func: async (args) => this.execute({ ...context, args }),
    });
  }

  getPromptEntry() {
    return `- ${this.name}: ${this.missionInfo}`;
  }

  getBehaviorLines() {
    return this.behavior.slice();
  }

  getWidgetTypes() {
    return this.widgets.slice();
  }
}
