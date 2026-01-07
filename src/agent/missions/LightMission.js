import { Mission } from "./Mission.js";

export class LightMission extends Mission {
  constructor(config) {
    super({ ...config, weight: "light" });
  }
}
