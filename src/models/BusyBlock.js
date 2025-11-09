import mongoose from "mongoose";

const busyBlockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    source: { type: String, enum: ["manual", "calendar"], default: "manual" },
  },
  { timestamps: true }
);

busyBlockSchema.index({ userId: 1, start: 1 });

export const BusyBlock = mongoose.model("BusyBlock", busyBlockSchema);
