import { connectDB, disconnectDB, clearDatabase } from "../../setup/connectDB.js";
import { createTestUser } from "../helpers/testUtils.js";
import { Task } from "../../../src/models/Task.js";
import getTasksMission from "../../../src/agent/missions/getTasks.js";

(async function () {
  await connectDB();
  try {
    await clearDatabase();
    const user = await createTestUser("dbg", "gettasks");
    await Task.create({
      userId: user._id,
      taskname: "ML Homework",
      dueDate: new Date("2026-01-25"),
      category: "study_and_education",
      subCategory: { label: "Machine Learning", source: "user" },
    });
    await Task.create({
      userId: user._id,
      taskname: "Groceries",
      dueDate: new Date("2026-01-19"),
      category: "home_and_chores",
    });

    const res = await getTasksMission.execute({ userId: user._id.toString(), args: {} });
    console.log("getTasks response:\n", res);

    const resSearch = await getTasksMission.execute({ userId: user._id.toString(), args: { search: "ML" } });
    console.log("getTasks search response:\n", resSearch);
  } catch (err) {
    console.error("DEBUG ERROR", err);
  } finally {
    await clearDatabase();
    await disconnectDB();
  }
})();
