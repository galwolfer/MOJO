import getCurrentTimeMission from "./getCurrentTime.js";
import saveUserFactMission from "./saveUserFact.js";
import saveConversationNoteMission from "./saveConversationNote.js";
import searchMemoriesMission from "./searchMemories.js";
import previewTaskMission from "./previewTask.js";
import addTaskMission from "./addTask.js";
import getTasksMission from "./getTasks.js";
import updateTaskMission from "./updateTask.js";
import deleteTaskMission from "./deleteTask.js";
import getUpcomingTasksMission from "./getUpcomingTasks.js";
import getOverdueTasksMission from "./getOverdueTasks.js";
import getSubcategoriesMission from "./getSubcategories.js";

export class MissionRegistry {
  constructor(missions = []) {
    this.missions = missions.slice();
  }

  list() {
    return this.missions.slice();
  }

  findByName(name) {
    return this.missions.find((mission) => mission.name === name);
  }

  buildTools(context) {
    return this.missions.map((mission) => mission.buildTool(context));
  }

  getToolDescriptions() {
    return this.missions.reduce((acc, mission) => {
      acc[mission.name] = mission.description;
      return acc;
    }, {});
  }

  getPromptSection(group, { title, footerLines = [] } = {}) {
    const items = this.missions.filter((mission) => mission.group === group);
    if (items.length === 0) return "";

    const lines = [];
    lines.push(`${title || `${group.toUpperCase()} TOOLS`}:`);
    items.forEach((mission) => {
      lines.push(mission.getPromptEntry());
    });

    if (footerLines.length > 0) {
      footerLines.forEach((line) => lines.push(line));
    }

    return lines.join("\n");
  }
}

export const missionRegistry = new MissionRegistry([
  getCurrentTimeMission,
  saveUserFactMission,
  saveConversationNoteMission,
  searchMemoriesMission,
  previewTaskMission,
  addTaskMission,
  getTasksMission,
  updateTaskMission,
  deleteTaskMission,
  getUpcomingTasksMission,
  getOverdueTasksMission,
  getSubcategoriesMission,
]);
