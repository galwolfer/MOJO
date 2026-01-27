import { z } from "zod";
import { LightMission } from "./LightMission.js";
import * as taskService from "../../services/taskService.js";
import { okFalse, okTrue } from "../lib/errorFormatter.js";

const getOverdueTasksMission = new LightMission({
  name: "get_overdue_tasks",
  group: "task",
  description: "Return overdue incomplete tasks. Keep message brief - widget shows details.",
  missionInfo: "Late tasks. Write short intro (e.g., 'Here are your overdue tasks:'). Don't repeat details.",
  widgets: ["list"],
  schema: z.object({}),
  execute: async ({ userId }) => {
    try {
      const tasks = await taskService.getOverdueTasks(userId);

      if (tasks.length === 0) {
        return okTrue({ count: 0 });
      }

      const minimalTasks = tasks.map((t) => ({
        id: t._id?.toString ? t._id.toString() : t._id,
        title: t.taskname,
      }));

      const widgetData = {
        listType: "overdue_tasks",
        tasks: minimalTasks,
      };

      const { buildWidgetString } = await import("../widgets/widgetUtils.js");
      return buildWidgetString("list", widgetData);
    } catch (error) {
      return okFalse(error.message);
    }
  },
});

export default getOverdueTasksMission;
