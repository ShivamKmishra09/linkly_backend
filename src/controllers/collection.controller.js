import { Collection } from "../models/Collection.js";
import { ApiError } from "../utilities/ApiError.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

// --- CREATE a new, empty collection ---
export const createCollection = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const { user_id } = req.params;
  if (!name || name.trim() === "") {
    throw new ApiError(400, "Collection name cannot be empty.");
  }
  const newCollection = new Collection({ name, owner: user_id, links: [] });
  await newCollection.save();
  res
    .status(201)
    .json({
      message: "Collection created successfully",
      collection: newCollection,
    });
});

// --- GET all collections for a user ---
export const getCollections = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const collections = await Collection.find({ owner: user_id }).sort({
    name: 1,
  });
  res.status(200).json({ collections });
});

// --- DELETE a collection ---
export const deleteCollection = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;
  // We also need to update all links that were in this collection
  await Link.updateMany(
    { owner: user_id, collections: collectionId },
    { $pull: { collections: collectionId } }
  );
  const result = await Collection.findOneAndDelete({
    _id: collectionId,
    owner: user_id,
  });
  if (!result) {
    throw new ApiError(404, "Collection not found or permission denied.");
  }
  res.status(200).json({ message: "Collection deleted successfully." });
});
