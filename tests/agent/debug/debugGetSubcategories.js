import { connectDB, disconnectDB, clearDatabase } from "../../setup/connectDB.js";
import { createTestUser } from "../helpers/testUtils.js";
import getSubcategoriesMission from "../../../src/agent/missions/getSubcategories.js";
import { Task } from "../../../src/models/Task.js";

(async function () {
  await connectDB();
  try {
    await clearDatabase();
    const user = await createTestUser("subcat", "merge");
    user.subCategories = [
      { name: "My Projects", category: 8 },
      { name: "Machine Learning", category: 0 },
    ];
    await user.save();

    await Task.create({
      userId: user._id,
      taskname: "Task 1",
      category: "study_and_education",
      subCategory: { label: "machine learning", source: "user", confidence: 1 },
    });
    await Task.create({
      userId: user._id,
      taskname: "Task 2",
      category: "study_and_education",
      subCategory: { label: "Machine Learning", source: "keyword-match", confidence: 0.7 },
    });
    await Task.create({
      userId: user._id,
      taskname: "Task 3",
      category: "creative_projects",
      subCategory: { label: "My Projects", source: "user", confidence: 1 },
    });
    await Task.create({
      userId: user._id,
      taskname: "Task 4",
      category: "creative_projects",
      subCategory: { label: "My Projects ", source: "keyword-match", confidence: 0.5 },
    });

    const res1 = await getSubcategoriesMission.execute({
      userId: user._id.toString(),
      args: { category: "study_and_education" },
    });
    console.log("res1:", res1);

    const res2 = await getSubcategoriesMission.execute({
      userId: user._id.toString(),
      args: { category: "creative_projects" },
    });
    console.log("res2:", res2);
  } catch (err) {
    console.error("DEBUG ERROR", err);
  } finally {
    await clearDatabase();
    await disconnectDB();
  }
})();
