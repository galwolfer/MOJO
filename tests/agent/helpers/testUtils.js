import { User } from "../../../src/models/User.js";

export function parseResponseId(response) {
  const idLine = response.split("\n").find((l) => l.startsWith("id="));
  return idLine ? idLine.replace('id="', "").replace('"', "").trim() : null;
}

export function parseSubcategories(response) {
  const payload = response.split("\n").find((l) => l.startsWith("subcategories="));
  return payload ? JSON.parse(payload.replace("subcategories=", "")) : null;
}

export function createTestUser(baseName, testName) {
  return User.create({
    username: `${baseName}_node`,
    email: `${baseName}_node_${testName.replace(/\s+/g, "_")}@automated.local`,
    passwordHash: "x",
    profile: {
      name: `${baseName} automated`,
      gender: "unspecified",
      ojoTypeId: null,
    },
  });
}
