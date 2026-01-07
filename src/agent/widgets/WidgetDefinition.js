export class WidgetDefinition {
  constructor({ type, description, schema }) {
    if (!type) throw new Error("WidgetDefinition requires a type");
    if (!description) throw new Error(`WidgetDefinition ${type} requires a description`);
    if (!schema) throw new Error(`WidgetDefinition ${type} requires a schema`);

    this.type = type;
    this.description = description;
    this.schema = schema;
  }

  toRecord() {
    return {
      type: this.type,
      description: this.description,
      schema: this.schema,
    };
  }
}
