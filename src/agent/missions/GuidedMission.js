import { Mission } from "./Mission.js";

export class GuidedMission extends Mission {
  constructor(config) {
    super({ ...config, weight: "guided" });
  }
}
