import { Collection } from "../models/Collection.js";
import { Link } from "../models/Link.js";
import { ApiError } from "../utilities/ApiError.js";
import { ApiResponse } from "../utilities/ApiResponse.js";
import { asyncHandler } from "../utilities/asyncHandler.js";
import mongoose from "mongoose";
import { User } from "../models/User.js";

// --- CREATE a new, empty collection ---
export const createCollection = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const { user_id } = req.params;

  // Validate user_id format
  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    throw new ApiError(400, "Invalid user ID format.");
  }

  // Validate and sanitize collection name
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError(400, "Collection name cannot be empty.");
  }

  const sanitizedName = name.trim();

  // Check name length
  if (sanitizedName.length > 100) {
    throw new ApiError(400, "Collection name cannot exceed 100 characters.");
  }

  // Check for potentially harmful characters (basic XSS prevention)
  const harmfulPattern = /[<>\"'&]/;
  if (harmfulPattern.test(sanitizedName)) {
    throw new ApiError(400, "Collection name contains invalid characters.");
  }

  // Check for duplicate collection names for the same user
  const existingCollection = await Collection.findOne({
    owner: user_id,
    name: sanitizedName,
  });

  if (existingCollection) {
    throw new ApiError(409, "A collection with this name already exists.");
  }

  const newCollection = new Collection({
    name: sanitizedName,
    owner: user_id,
    links: [],
  });

  await newCollection.save();

  res.status(201).json({
    success: true,
    message: "Collection created successfully",
    collection: newCollection,
  });
});

// --- GET all collections for a user ---
export const getCollections = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const { page = 1, limit = 50, search = "" } = req.query;

  // Validate user_id format
  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    throw new ApiError(400, "Invalid user ID format.");
  }

  // Validate pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (
    isNaN(pageNum) ||
    isNaN(limitNum) ||
    pageNum < 1 ||
    limitNum < 1 ||
    limitNum > 100
  ) {
    throw new ApiError(
      400,
      "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100."
    );
  }

  // Validate search parameter
  if (search && typeof search !== "string") {
    throw new ApiError(400, "Search parameter must be a string.");
  }

  try {
    // Build query
    const query = { owner: user_id };
    if (search && search.trim()) {
      const sanitizedSearch = search.trim();
      if (sanitizedSearch.length > 100) {
        throw new ApiError(
          400,
          "Search query too long. Maximum 100 characters allowed."
        );
      }
      query.name = { $regex: sanitizedSearch, $options: "i" };
    }

    // Get total count for pagination
    const totalCollections = await Collection.countDocuments(query);

    // Get collections with pagination
    const collections = await Collection.find(query)
      .sort({ name: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("links", "shortId longUrl viewerCount analysisStatus")
      .lean(); // Use lean() for better performance when we don't need Mongoose methods

    res.status(200).json({
      success: true,
      collections,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCollections / limitNum),
        totalCollections,
        hasNextPage: pageNum * limitNum < totalCollections,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error(`Error fetching collections for user ${user_id}:`, error);
    throw new ApiError(
      500,
      "An error occurred while fetching collections. Please try again."
    );
  }
});

// --- GET a single collection by ID ---
export const getCollection = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;

  // Validate IDs format
  if (
    !mongoose.Types.ObjectId.isValid(collectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid ID format.");
  }

  try {
    const collection = await Collection.findOne({
      _id: collectionId,
      owner: user_id,
    }).populate(
      "links",
      "shortId longUrl viewerCount analysisStatus aiSummary aiTags aiSafetyRating"
    );

    if (!collection) {
      throw new ApiError(404, "Collection not found or permission denied.");
    }

    res.status(200).json({
      success: true,
      collection,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error(`Error fetching collection ${collectionId}:`, error);
    throw new ApiError(
      500,
      "An error occurred while fetching the collection. Please try again."
    );
  }
});

// --- UPDATE collection name ---
export const updateCollection = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;
  const { name } = req.body;

  // Validate IDs format
  if (
    !mongoose.Types.ObjectId.isValid(collectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid ID format.");
  }

  // Validate and sanitize collection name
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError(400, "Collection name cannot be empty.");
  }

  const sanitizedName = name.trim();

  // Check name length
  if (sanitizedName.length > 100) {
    throw new ApiError(400, "Collection name cannot exceed 100 characters.");
  }

  // Check for potentially harmful characters (basic XSS prevention)
  const harmfulPattern = /[<>\"'&]/;
  if (harmfulPattern.test(sanitizedName)) {
    throw new ApiError(400, "Collection name contains invalid characters.");
  }

  // Check for duplicate collection names for the same user (excluding current collection)
  const existingCollection = await Collection.findOne({
    owner: user_id,
    name: sanitizedName,
    _id: { $ne: collectionId },
  });

  if (existingCollection) {
    throw new ApiError(409, "A collection with this name already exists.");
  }

  const updatedCollection = await Collection.findOneAndUpdate(
    {
      _id: collectionId,
      owner: user_id,
    },
    { name: sanitizedName },
    { new: true, runValidators: true }
  );

  if (!updatedCollection) {
    throw new ApiError(404, "Collection not found or permission denied.");
  }

  res.status(200).json({
    success: true,
    message: "Collection updated successfully",
    collection: updatedCollection,
  });
});

// --- ADD links to collection ---
export const addLinksToCollection = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;
  const { linkIds } = req.body;

  // Validate IDs format
  if (
    !mongoose.Types.ObjectId.isValid(collectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid ID format.");
  }

  // Validate linkIds array
  if (!Array.isArray(linkIds) || linkIds.length === 0) {
    throw new ApiError(400, "linkIds must be a non-empty array.");
  }

  // Limit the number of links that can be added at once
  if (linkIds.length > 100) {
    throw new ApiError(400, "Cannot add more than 100 links at once.");
  }

  // Validate each linkId format
  for (const linkId of linkIds) {
    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      throw new ApiError(400, `Invalid link ID format: ${linkId}`);
    }
  }

  // Check if collection exists and user owns it
  const collection = await Collection.findOne({
    _id: collectionId,
    owner: user_id,
  });

  if (!collection) {
    throw new ApiError(404, "Collection not found or permission denied.");
  }

  // Check if all links exist and belong to the user
  const links = await Link.find({
    _id: { $in: linkIds },
    owner: user_id,
  });

  if (links.length !== linkIds.length) {
    const foundIds = links.map((link) => link._id.toString());
    const missingIds = linkIds.filter((id) => !foundIds.includes(id));
    throw new ApiError(
      400,
      `Some links not found or permission denied: ${missingIds.join(", ")}`
    );
  }

  try {
    // Add links to collection (avoid duplicates)
    const updatedCollection = await Collection.findByIdAndUpdate(
      collectionId,
      { $addToSet: { links: { $each: linkIds } } },
      { new: true, runValidators: true }
    );

    // Update links to include this collection (avoid duplicates)
    const updateResult = await Link.updateMany(
      { _id: { $in: linkIds } },
      { $addToSet: { collections: collectionId } }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(
        `Added collection ${collectionId} to ${updateResult.modifiedCount} links`
      );
    }

    res.status(200).json({
      success: true,
      message: "Links added to collection successfully",
      collection: updatedCollection,
      addedLinks: linkIds.length,
      modifiedLinks: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error(`Error adding links to collection ${collectionId}:`, error);
    throw new ApiError(
      500,
      "An error occurred while adding links to the collection. Please try again."
    );
  }
});

// --- REMOVE links from collection ---
export const removeLinksFromCollection = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;
  const { linkIds } = req.body;

  // Validate IDs format
  if (
    !mongoose.Types.ObjectId.isValid(collectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid ID format.");
  }

  // Validate linkIds array
  if (!Array.isArray(linkIds) || linkIds.length === 0) {
    throw new ApiError(400, "linkIds must be a non-empty array.");
  }

  // Limit the number of links that can be removed at once
  if (linkIds.length > 100) {
    throw new ApiError(400, "Cannot remove more than 100 links at once.");
  }

  // Validate each linkId format
  for (const linkId of linkIds) {
    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      throw new ApiError(400, `Invalid link ID format: ${linkId}`);
    }
  }

  // Check if collection exists and user owns it
  const collection = await Collection.findOne({
    _id: collectionId,
    owner: user_id,
  });

  if (!collection) {
    throw new ApiError(404, "Collection not found or permission denied.");
  }

  try {
    // Remove links from collection
    const updatedCollection = await Collection.findByIdAndUpdate(
      collectionId,
      { $pull: { links: { $in: linkIds } } },
      { new: true, runValidators: true }
    );

    // Remove collection from links
    const updateResult = await Link.updateMany(
      { _id: { $in: linkIds } },
      { $pull: { collections: collectionId } }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(
        `Removed collection ${collectionId} from ${updateResult.modifiedCount} links`
      );
    }

    res.status(200).json({
      success: true,
      message: "Links removed from collection successfully",
      collection: updatedCollection,
      removedLinks: linkIds.length,
      modifiedLinks: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error(
      `Error removing links from collection ${collectionId}:`,
      error
    );
    throw new ApiError(
      500,
      "An error occurred while removing links from the collection. Please try again."
    );
  }
});

// --- DELETE a collection ---
export const deleteCollection = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;

  // Validate IDs format
  if (
    !mongoose.Types.ObjectId.isValid(collectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid ID format.");
  }

  // Check if collection exists and user owns it
  const collection = await Collection.findOne({
    _id: collectionId,
    owner: user_id,
  });

  if (!collection) {
    throw new ApiError(404, "Collection not found or permission denied.");
  }

  try {
    // Remove this collection from all links that contain it
    if (collection.links && collection.links.length > 0) {
      const updateResult = await Link.updateMany(
        { _id: { $in: collection.links } },
        { $pull: { collections: collectionId } }
      );

      if (updateResult.modifiedCount > 0) {
        console.log(
          `Removed collection ${collectionId} from ${updateResult.modifiedCount} links`
        );
      }
    }

    // Delete the collection
    const deleteResult = await Collection.findByIdAndDelete(collectionId);

    if (!deleteResult) {
      throw new ApiError(500, "Failed to delete collection. Please try again.");
    }

    res.status(200).json({
      success: true,
      message: "Collection deleted successfully.",
      deletedCollection: {
        id: collectionId,
        name: collection.name,
        linkCount: collection.links ? collection.links.length : 0,
      },
    });
  } catch (error) {
    // If something goes wrong, log it for debugging
    console.error(`Error deleting collection ${collectionId}:`, error);
    throw new ApiError(
      500,
      "An error occurred while deleting the collection. Please try again."
    );
  }
});

// --- GET collection statistics ---
export const getCollectionStats = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  // Validate user_id format
  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    throw new ApiError(400, "Invalid user ID format.");
  }

  try {
    const stats = await Collection.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(user_id) } },
      {
        $lookup: {
          from: "links",
          localField: "links",
          foreignField: "_id",
          as: "linkDetails",
        },
      },
      {
        $project: {
          name: 1,
          linkCount: { $size: "$links" },
          totalClicks: { $sum: "$linkDetails.viewerCount" },
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    // Calculate summary statistics
    const totalCollections = stats.length;
    const totalLinks = stats.reduce((sum, stat) => sum + stat.linkCount, 0);
    const totalClicks = stats.reduce(
      (sum, stat) => sum + (stat.totalClicks || 0),
      0
    );
    const averageLinksPerCollection =
      totalCollections > 0 ? (totalLinks / totalCollections).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      stats,
      summary: {
        totalCollections,
        totalLinks,
        totalClicks,
        averageLinksPerCollection: parseFloat(averageLinksPerCollection),
      },
    });
  } catch (error) {
    console.error(
      `Error fetching collection stats for user ${user_id}:`,
      error
    );
    throw new ApiError(
      500,
      "An error occurred while fetching collection statistics. Please try again."
    );
  }
});

// --- GET dashboard data (user, links, collections) ---
export const getDashboardData = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  // Validate user_id format
  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    throw new ApiError(400, "Invalid user ID format.");
  }

  try {
    // Fetch all data concurrently using Promise.all for better performance
    const [user, links, collections] = await Promise.all([
      // Get user details (excluding sensitive fields)
      User.findById(user_id).select("-password -__v").lean(),

      // Get all user's links with basic fields
      Link.find({ owner: user_id })
        .sort({ createdAt: -1 })
        .select(
          "shortId longUrl viewerCount analysisStatus aiSummary aiTags aiSafetyRating aiClassification createdAt"
        )
        .lean(),

      // Get all user's collections with populated link counts
      Collection.find({ owner: user_id })
        .sort({ name: 1 })
        .select("name links createdAt updatedAt")
        .lean(),
    ]);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Calculate collection statistics
    const collectionStats = collections.map((collection) => ({
      ...collection,
      linkCount: collection.links ? collection.links.length : 0,
    }));

    // Calculate overall statistics
    const totalLinks = links.length;
    const totalCollections = collections.length;
    const totalClicks = links.reduce(
      (sum, link) => sum + (link.viewerCount || 0),
      0
    );
    const averageLinksPerCollection =
      totalCollections > 0 ? (totalLinks / totalCollections).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        user,
        links,
        collections: collectionStats,
        stats: {
          totalLinks,
          totalCollections,
          totalClicks,
          averageLinksPerCollection: parseFloat(averageLinksPerCollection),
        },
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error(`Error fetching dashboard data for user ${user_id}:`, error);
    throw new ApiError(
      500,
      "An error occurred while fetching dashboard data. Please try again."
    );
  }
});

// --- BULK ADD links to collection ---
export const bulkAddLinksToCollection = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;
  const { linkIds } = req.body;

  // Validate IDs format
  if (
    !mongoose.Types.ObjectId.isValid(collectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid ID format.");
  }

  // Validate linkIds array
  if (!Array.isArray(linkIds) || linkIds.length === 0) {
    throw new ApiError(400, "linkIds must be a non-empty array.");
  }

  // Limit the number of links that can be added at once
  if (linkIds.length > 1000) {
    throw new ApiError(400, "Cannot add more than 1000 links at once.");
  }

  // Validate each linkId format
  for (const linkId of linkIds) {
    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      throw new ApiError(400, `Invalid link ID format: ${linkId}`);
    }
  }

  // Check if collection exists and user owns it
  const collection = await Collection.findOne({
    _id: collectionId,
    owner: user_id,
  });

  if (!collection) {
    throw new ApiError(404, "Collection not found or permission denied.");
  }

  // Check if all links exist and belong to the user
  const links = await Link.find({
    _id: { $in: linkIds },
    owner: user_id,
  });

  if (links.length !== linkIds.length) {
    const foundIds = links.map((link) => link._id.toString());
    const missingIds = linkIds.filter((id) => !foundIds.includes(id));
    throw new ApiError(
      400,
      `Some links not found or permission denied: ${missingIds.join(", ")}`
    );
  }

  try {
    // Add links to collection (avoid duplicates)
    const updatedCollection = await Collection.findByIdAndUpdate(
      collectionId,
      { $addToSet: { links: { $each: linkIds } } },
      { new: true, runValidators: true }
    );

    // Update links to include this collection (avoid duplicates)
    const updateResult = await Link.updateMany(
      { _id: { $in: linkIds } },
      { $addToSet: { collections: collectionId } }
    );

    res.status(200).json({
      success: true,
      message: "Links added to collection successfully",
      collection: updatedCollection,
      addedLinks: linkIds.length,
      modifiedLinks: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error(
      `Error bulk adding links to collection ${collectionId}:`,
      error
    );
    throw new ApiError(
      500,
      "An error occurred while adding links to the collection. Please try again."
    );
  }
});

// --- BULK MOVE links between collections ---
export const bulkMoveLinks = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const { linkIds, sourceCollectionId, targetCollectionId } = req.body;

  // Validate IDs format
  if (
    !Array.isArray(linkIds) ||
    linkIds.length === 0 ||
    !mongoose.Types.ObjectId.isValid(targetCollectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid parameters provided.");
  }

  // Validate each linkId format
  for (const linkId of linkIds) {
    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      throw new ApiError(400, `Invalid link ID format: ${linkId}`);
    }
  }

  // Check if target collection exists and user owns it
  const targetCollection = await Collection.findOne({
    _id: targetCollectionId,
    owner: user_id,
  });

  if (!targetCollection) {
    throw new ApiError(
      404,
      "Target collection not found or permission denied."
    );
  }

  // Check if source collection exists (if provided)
  if (
    sourceCollectionId &&
    mongoose.Types.ObjectId.isValid(sourceCollectionId)
  ) {
    const sourceCollection = await Collection.findOne({
      _id: sourceCollectionId,
      owner: user_id,
    });

    if (!sourceCollection) {
      throw new ApiError(
        404,
        "Source collection not found or permission denied."
      );
    }
  }

  // Check if all links exist and belong to the user
  const links = await Link.find({
    _id: { $in: linkIds },
    owner: user_id,
  });

  if (links.length !== linkIds.length) {
    const foundIds = links.map((link) => link._id.toString());
    const missingIds = linkIds.filter((id) => !foundIds.includes(id));
    throw new ApiError(
      400,
      `Some links not found or permission denied: ${missingIds.join(", ")}`
    );
  }

  try {
    // Remove links from source collection (if provided)
    if (sourceCollectionId) {
      await Collection.findByIdAndUpdate(sourceCollectionId, {
        $pull: { links: { $in: linkIds } },
      });
    }

    // Add links to target collection
    const updatedTargetCollection = await Collection.findByIdAndUpdate(
      targetCollectionId,
      { $addToSet: { links: { $each: linkIds } } },
      { new: true, runValidators: true }
    );

    // Update links to reflect the new collection assignment
    await Link.updateMany(
      { _id: { $in: linkIds } },
      {
        $pull: { collections: sourceCollectionId || { $exists: false } },
        $addToSet: { collections: targetCollectionId },
      }
    );

    res.status(200).json({
      success: true,
      message: "Links moved successfully",
      targetCollection: updatedTargetCollection,
      movedLinks: linkIds.length,
    });
  } catch (error) {
    console.error(`Error moving links:`, error);
    throw new ApiError(
      500,
      "An error occurred while moving links. Please try again."
    );
  }
});

// --- ENHANCED DELETE collection with option to delete links ---
export const deleteCollectionEnhanced = asyncHandler(async (req, res) => {
  const { collectionId, user_id } = req.params;
  const { deleteLinks = false } = req.query;

  // Validate IDs format
  if (
    !mongoose.Types.ObjectId.isValid(collectionId) ||
    !mongoose.Types.ObjectId.isValid(user_id)
  ) {
    throw new ApiError(400, "Invalid ID format.");
  }

  // Check if collection exists and user owns it
  const collection = await Collection.findOne({
    _id: collectionId,
    owner: user_id,
  });

  if (!collection) {
    throw new ApiError(404, "Collection not found or permission denied.");
  }

  try {
    if (
      deleteLinks === "true" &&
      collection.links &&
      collection.links.length > 0
    ) {
      // Delete all links in the collection
      const deleteResult = await Link.deleteMany({
        _id: { $in: collection.links },
        owner: user_id,
      });

      console.log(
        `Deleted ${deleteResult.deletedCount} links from collection ${collectionId}`
      );
    } else if (collection.links && collection.links.length > 0) {
      // Remove this collection from all links that contain it
      const updateResult = await Link.updateMany(
        { _id: { $in: collection.links } },
        { $pull: { collections: collectionId } }
      );

      if (updateResult.modifiedCount > 0) {
        console.log(
          `Removed collection ${collectionId} from ${updateResult.modifiedCount} links`
        );
      }
    }

    // Delete the collection
    const deleteResult = await Collection.findByIdAndDelete(collectionId);

    if (!deleteResult) {
      throw new ApiError(500, "Failed to delete collection. Please try again.");
    }

    res.status(200).json({
      success: true,
      message: "Collection deleted successfully.",
      deletedCollection: {
        id: collectionId,
        name: collection.name,
        linkCount: collection.links ? collection.links.length : 0,
        linksDeleted: deleteLinks === "true",
      },
    });
  } catch (error) {
    console.error(`Error deleting collection ${collectionId}:`, error);
    throw new ApiError(
      500,
      "An error occurred while deleting the collection. Please try again."
    );
  }
});

// Advanced filtering endpoint
export const filterLinks = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const {
    searchQuery,
    tags,
    dateRange,
    safetyScore,
    clicks,
    sortBy = "createdAt_desc",
    page = 1,
    limit = 20,
  } = req.body;

  // Build filter query
  const filterQuery = { owner: user_id };

  // Search query
  if (searchQuery) {
    filterQuery.$or = [
      { longUrl: { $regex: searchQuery, $options: "i" } },
      { aiSummary: { $regex: searchQuery, $options: "i" } },
    ];
  }

  // Tags filter
  if (tags && tags.length > 0) {
    filterQuery.aiTags = { $in: tags };
  }

  // Date range filter
  if (dateRange) {
    filterQuery.createdAt = {};
    if (dateRange.startDate) {
      filterQuery.createdAt.$gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      filterQuery.createdAt.$lte = new Date(dateRange.endDate);
    }
  }

  // Safety score filter
  if (safetyScore) {
    filterQuery.aiSafetyRating = {};
    if (safetyScore.min !== undefined) {
      filterQuery.aiSafetyRating.$gte = safetyScore.min;
    }
    if (safetyScore.max !== undefined) {
      filterQuery.aiSafetyRating.$lte = safetyScore.max;
    }
  }

  // Clicks filter
  if (clicks) {
    filterQuery.viewerCount = {};
    if (clicks.min !== undefined) {
      filterQuery.viewerCount.$gte = clicks.min;
    }
    if (clicks.max !== undefined) {
      filterQuery.viewerCount.$lte = clicks.max;
    }
  }

  // Build sort object
  let sortObject = {};
  switch (sortBy) {
    case "createdAt_asc":
      sortObject = { createdAt: 1 };
      break;
    case "createdAt_desc":
      sortObject = { createdAt: -1 };
      break;
    case "clicks_asc":
      sortObject = { viewerCount: 1 };
      break;
    case "clicks_desc":
      sortObject = { viewerCount: -1 };
      break;
    case "safety_asc":
      sortObject = { aiSafetyRating: 1 };
      break;
    case "safety_desc":
      sortObject = { aiSafetyRating: -1 };
      break;
    default:
      sortObject = { createdAt: -1 };
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;

  const [links, total] = await Promise.all([
    Link.find(filterQuery).sort(sortObject).skip(skip).limit(limit).lean(),
    Link.countDocuments(filterQuery),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      links,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  );
});

// Get unique tags for a user
export const getUserTags = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  const tags = await User.findById(user_id).select("LinkTags");

  res.status(200).json(new ApiResponse(200, { tags: tags }));
});
