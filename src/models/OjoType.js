/*
 * File: src/models/OjoType.js
 * Purpose: OjoType model defining different ojo personas and tones
 */
import mongoose from "mongoose";

/**
 * OjoType Schema
 * Defines the different types of ojos with their personas and tones
 */
const ojoTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: ["mentorjo", "brojo", "bestojo", "strictojo"],
    },
    displayName: {
      type: String,
      required: true,
    },
    persona: {
      type: String,
      required: true,
    },
    tone: {
      type: [String],
      required: true,
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one default OjoType
ojoTypeSchema.pre("save", async function (next) {
  if (this.isDefault) {
    await mongoose.model("OjoType").updateMany({ _id: { $ne: this._id } }, { isDefault: false });
  }
  next();
});

const OjoType = mongoose.model("OjoType", ojoTypeSchema);

export default OjoType;
