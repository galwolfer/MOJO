import mongoose from "mongoose";
import { CATEGORY_STRING_VALUES, isValidCategory } from "../config/categories.js";

const subcategorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, index: true },
    parent: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (value) {
          return isValidCategory(value);
        },
        message: `Invalid parent category. Must be one of: ${CATEGORY_STRING_VALUES.join(", ")}`,
      },
    },
    icon: { type: String, default: null, trim: true },
    color: { type: String, default: null, trim: true },
    source: { type: String, default: "user", trim: true },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

subcategorySchema.index({ userId: 1, parent: 1, nameLower: 1 }, { unique: true });

subcategorySchema.pre("validate", function () {
  if (this.name && typeof this.name === "string") {
    this.name = this.name.trim();
    this.nameLower = this.name.toLowerCase();
  }
});

subcategorySchema.virtual("label").get(function () {
  return this.name;
});

const SubcategoryModel =
  (mongoose.models && mongoose.models.Subcategory) || mongoose.model("Subcategory", subcategorySchema);

export const Subcategory = SubcategoryModel;
export default SubcategoryModel;
