import { z } from "zod";
import { LightMission } from "./LightMission.js";

const getCurrentTimeMission = new LightMission({
  name: "get_current_time",
  group: "time",
  description: "Return current date/time",
  missionInfo: "Return current date/time",
  schema: z.object({}),
  execute: async () => {
    const now = new Date();
    return `date="${now.toLocaleDateString("en-US")}"\ntime="${now.toLocaleTimeString("en-US")}"\nts="${now.toISOString()}"`;
  },
});

export default getCurrentTimeMission;
