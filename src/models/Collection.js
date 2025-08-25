import mongoose from "mongoose";

const collectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    links: [{ type: mongoose.Schema.Types.ObjectId, ref: "Link" }], // An array of Link IDs
  },
  { timestamps: true }
);

export const Collection = mongoose.model("Collection", collectionSchema);
