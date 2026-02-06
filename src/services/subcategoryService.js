import { Subcategory } from "../models/Subcategory.js";
import { User } from "../models/User.js";
import { CATEGORY_STRING_VALUES, getDisplayName, isValidCategory } from "../config/categories.js";

function normalizeCategoryKey(category) {
  if (!category) return "";
  return String(category)
    .toLowerCase()
    .replace(/[^a-z_]/g, "");
}

function normalizeName(name) {
  return String(name || "").trim();
}

export async function findSubcategoryById({ userId, subcategoryId }) {
  if (!userId || !subcategoryId) return null;
  return Subcategory.findOne({ _id: subcategoryId, userId }).lean();
}

export async function addSubcategoryToUser(userId, subcategoryId) {
  if (!userId || !subcategoryId) return;
  await User.updateOne({ _id: userId }, { $addToSet: { subCategories: subcategoryId } }).catch(() => {});
}

export async function findSubcategoryByName({ userId, name, parent }) {
  if (!userId) return null;
  const trimmedName = normalizeName(name);
  const parentKey = normalizeCategoryKey(parent);
  if (!trimmedName || !parentKey || !isValidCategory(parentKey)) return null;

  return Subcategory.findOne({
    userId,
    parent: parentKey,
    nameLower: trimmedName.toLowerCase(),
  }).lean();
}

export async function findOrCreateSubcategory({
  userId,
  name,
  parent,
  icon = null,
  color = null,
  source = "user",
  confidence = 1,
} = {}) {
  if (!userId) return null;

  const trimmedName = normalizeName(name);
  const parentKey = normalizeCategoryKey(parent);

  if (!trimmedName || !parentKey || !isValidCategory(parentKey)) return null;

  let sub = await Subcategory.findOne({
    userId,
    parent: parentKey,
    nameLower: trimmedName.toLowerCase(),
  });

  if (!sub) {
    sub = await Subcategory.create({
      userId,
      name: trimmedName,
      parent: parentKey,
      icon,
      color,
      source,
      confidence,
    });
  } else if (source === "user" && sub.source !== "user") {
    sub.source = "user";
    await sub.save();
  }

  // Keep user profile synced with subcategory IDs
  await addSubcategoryToUser(userId, sub._id);

  return sub.toObject ? sub.toObject() : sub;
}

export async function resolveSubcategoryId({
  userId,
  subcategoryId,
  subcategory,
  subcategoryName,
  parent,
  icon = null,
  source = "user",
  confidence = 1,
} = {}) {
  let candidateId = subcategoryId || (subcategory && (subcategory._id || subcategory.id || subcategory.subcategoryId));

  if (!candidateId && typeof subcategory === "string" && /^[a-fA-F0-9]{ICON_SIZES.sm}$/.test(subcategory)) {
    candidateId = subcategory;
  }

  if (candidateId) {
    const found = await Subcategory.findOne({ _id: candidateId, userId }).lean();
    return found ? found._id : null;
  }

  const name = subcategoryName || (subcategory && (subcategory.name || subcategory.label));
  if (name && parent) {
    const created = await findOrCreateSubcategory({ userId, name, parent, icon, source, confidence });
    return created ? created._id : null;
  }

  return null;
}

export async function ensureGeneralSubcategory({ userId, parent } = {}) {
  if (!userId || !parent || !isValidCategory(parent)) return null;

  // Use a system-wide general subcategory (userId = "system")
  const systemUserId = "000000000000000000000000"; // Special system user ID
  const displayName = getDisplayName(parent) || parent;
  const generalName = `General`;

  let sub = await Subcategory.findOne({
    userId: systemUserId,
    parent,
    nameLower: generalName.toLowerCase(),
  });

  if (!sub) {
    sub = await Subcategory.create({
      userId: systemUserId,
      name: generalName,
      parent,
      icon: null, // Will use category icon in frontend
      color: null,
      source: "category-default",
      confidence: 1,
    });
  }

  return sub.toObject ? sub.toObject() : sub;
}

export function getSubcategoryLabel(subCategory) {
  if (!subCategory) return "";
  if (typeof subCategory === "string") return "";
  if (typeof subCategory === "object") return subCategory.label || subCategory.name || "";
  return "";
}

export function normalizeCategoryDisplay(category) {
  const normalized = normalizeCategoryKey(category);
  if (!normalized || !isValidCategory(normalized)) return "";
  return normalized;
}

export { normalizeCategoryKey, normalizeName };
