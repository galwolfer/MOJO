import test from "node:test";
import { connectDB, disconnectDB, clearDatabase } from "../setup/connectDB.js";

export function setupAgentTests() {
  test.before(async () => {
    await connectDB();
  });

  test.after(async () => {
    await disconnectDB();
  });

  test.beforeEach(async () => {
    await clearDatabase();
  });

  test.afterEach(async () => {
    await clearDatabase();
  });
}
