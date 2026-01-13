/*
 * File: src/controllers/ojoTypeController.js
 * Purpose: Simple controllers to expose OjoType metadata for the frontend
 */
import OjoType from "../models/OjoType.js";

export async function listOjoTypes(req, res, next) {
  try {
    const ojoTypes = await OjoType.find({}, "name displayName persona tone isDefault").sort({ name: 1 });
    res.json({ success: true, count: ojoTypes.length, ojoTypes });
  } catch (err) {
    next(err);
  }
}

export async function getOjoTypeByName(req, res, next) {
  try {
    const { name } = req.params;
    if (!name) return res.status(400).json({ success: false, error: "OjoType name is required" });

    const ojoType = await OjoType.findOne(
      { name: String(name).toLowerCase() },
      "name displayName persona tone isDefault"
    );
    if (!ojoType) return res.status(404).json({ success: false, error: "OjoType not found" });

    res.json({ success: true, ojoType });
  } catch (err) {
    next(err);
  }
}
