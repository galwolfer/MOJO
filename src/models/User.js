import mongoose from "mongoose";

/**
 * User Schema
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    profile: {
      name: {
        type: String,
        trim: true,
        default: "",
      },
      settings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
      },
      priorities: {
        work: { type: Number, min: 1, max: 5, default: 3 },
        study: { type: Number, min: 1, max: 5, default: 3 },
        health: { type: Number, min: 1, max: 5, default: 3 },
        social: { type: Number, min: 1, max: 5, default: 3 },
        finance: { type: Number, min: 1, max: 5, default: 3 },
        household: { type: Number, min: 1, max: 5, default: 3 },
        creative: { type: Number, min: 1, max: 5, default: 3 },
      },
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for performance
// Note: `unique: true` on the schema fields already creates indexes for username and email.
// Removing explicit duplicate index declarations to avoid Mongoose warnings.

const User = mongoose.model("User", userSchema);
export default User;
