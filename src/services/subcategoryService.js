import mongoose from "mongoose";
import { Subcategory } from "../models/Subcategory.js";
import { User } from "../models/User.js";
import { CATEGORY_STRING_VALUES, getDisplayName, isValidCategory } from "../config/categories.js";
import { normalizeObjectId } from "../utils/querySanitizers.js";

function normalizeCategoryKey(category) {
  if (!category) return "";
  return String(category)
    .toLowerCase()
    .replace(/[^a-z_]/g, "");
}

function normalizeName(name) {
  return String(name || "").trim();
}

const SYSTEM_USER_ID = "000000000000000000000000";

export async function findSubcategoryById({ userId, subcategoryId }) {
  const normalizedUserId = normalizeObjectId(userId);
  const normalizedSubcategoryId = normalizeObjectId(subcategoryId);
  if (!normalizedUserId || !normalizedSubcategoryId) return null;
  // Also accept system-wide (general) subcategories shared across all users
  return Subcategory.findOne({
    _id: normalizedSubcategoryId,
    userId: { $in: [normalizedUserId, SYSTEM_USER_ID] },
  }).lean();
}

export async function addSubcategoryToUser(userId, subcategoryId) {
  if (!userId || !subcategoryId) return;
  await User.updateOne({ _id: userId }, { $addToSet: { subCategories: subcategoryId } }).catch(() => {});
}

export async function findSubcategoryByName({ userId, name, parent }) {
  const normalizedUserId = normalizeObjectId(userId);
  if (!normalizedUserId) return null;
  const trimmedName = normalizeName(name);
  const parentKey = normalizeCategoryKey(parent);
  if (!trimmedName || !parentKey || !isValidCategory(parentKey)) return null;

  return Subcategory.findOne({
    userId: normalizedUserId,
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
  const normalizedUserId = normalizeObjectId(userId);
  if (!normalizedUserId) return null;

  const trimmedName = normalizeName(name);
  const parentKey = normalizeCategoryKey(parent);

  if (!trimmedName || !parentKey || !isValidCategory(parentKey)) return null;

  let sub = await Subcategory.findOne({
    userId: normalizedUserId,
    parent: parentKey,
    nameLower: trimmedName.toLowerCase(),
  });

  if (!sub) {
    sub = await Subcategory.create({
      userId: normalizedUserId,
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
  const normalizedUserId = normalizeObjectId(userId);
  const normalizedCandidateId = normalizeObjectId(candidateId);

  if (!normalizedCandidateId && typeof subcategory === "string" && /^[a-fA-F0-9]{24}$/.test(subcategory)) {
    candidateId = subcategory;
  }

  if (normalizedCandidateId && normalizedUserId) {
    // Accept subcategories owned by the user OR the system-wide general ones
    const found = await Subcategory.findOne({
      _id: normalizedCandidateId,
      userId: { $in: [normalizedUserId, SYSTEM_USER_ID] },
    }).lean();
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
  if (!parent || !isValidCategory(parent)) return null;

  // System-wide general subcategory shared across all users
  const systemUserId = SYSTEM_USER_ID;
  const displayName = getDisplayName(parent) || parent;
  const generalName = `General ${displayName}`;

  let sub = await Subcategory.findOne({
    userId: systemUserId,
    parent,
    source: "category-default",
  });

  if (!sub) {
    sub = await Subcategory.create({
      userId: systemUserId,
      name: generalName,
      parent,
      icon: null,
      color: null,
      source: "category-default",
      confidence: 1,
    });
  } else if (sub.name !== generalName) {
    // Fix legacy records that were created with just "General"
    sub.name = generalName;
    sub.nameLower = generalName.toLowerCase();
    await sub.save();
  }

  return sub.toObject ? sub.toObject() : sub;
}

/**
 * Seed default "General [Category]" subcategories for all 18 categories.
 * Safe to call on every server start — fully idempotent.
 * Also migrates old records: deletes user-owned category-defaults and renames
 * legacy "General" records (no display name suffix) to the correct naming.
 */
export async function seedDefaultSubcategories() {
  const SYSTEM_USER_ID = "000000000000000000000000";

  // 1. Delete any category-default records that were incorrectly created under real user IDs
  const systemObjId = new mongoose.Types.ObjectId(SYSTEM_USER_ID);
  const { deletedCount } = await Subcategory.deleteMany({
    source: "category-default",
    userId: { $ne: systemObjId },
  }).catch(() => ({ deletedCount: 0 }));

  if (deletedCount > 0) {
    console.log(`[seedDefaultSubcategories] Removed ${deletedCount} mis-owned category-default subcategories`);
  }

  // 2. Ensure every category has a system-level general subcategory
  const results = await Promise.allSettled(
    CATEGORY_STRING_VALUES.map((cat) => ensureGeneralSubcategory({ parent: cat })),
  );
  const ok = results.filter((r) => r.status === "fulfilled" && r.value).length;
  return ok;
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
