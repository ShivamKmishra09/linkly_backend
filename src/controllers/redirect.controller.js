import { User } from "../models/User.js";
import { ApiError } from "../utilities/ApiError.js";
import { asyncHandler } from "../utilities/asyncHandler.js";
import redisClient from "../db/redis.js";
import { Link } from "../models/Link.js";
import { analysisQueue } from "../jobs/queue.js";

const updateViewerCount = async (web_id) => {
  try {
    const fullShortUrl = `${process.env.REACT_APP_FRONTEND_URL}/linkly/${web_id}`;
    const user = await User.findOne({ "Links.newLink": fullShortUrl });
    if (user) {
      const index = user.Links.newLink.indexOf(fullShortUrl);
      if (index !== -1) {
        user.Viewer[index] += 1;
        await user.save();
        console.log(`Viewer count updated for ${web_id}`);
      }
    }
  } catch (error) {
    console.error(`Failed to update viewer count for ${web_id}:`, error);
  }
};
// ... (all other controller functions remain the same)

// ⭐️ HANDLE the public redirect with SAFETY WARNING ⭐️
export const handleRedirect = asyncHandler(async (req, res) => {
  const { web_id } = req.params;
  const cacheKey = `link:${web_id}`;
  let linkData;

  // 1. Check Redis for the full link object
  const cachedData = await redisClient.get(cacheKey);

  if (cachedData) {
    // 2a. CACHE HIT: Parse the JSON string from the cache
    linkData = JSON.parse(cachedData);
    // Asynchronously update the viewer count
    Link.updateOne({ shortId: web_id }, { $inc: { viewerCount: 1 } }).exec();
  } else {
    // 2b. CACHE MISS: Query the database
    const link = await Link.findOne({ shortId: web_id });
    if (!link) {
      throw new ApiError(404, "Link not found");
    }

    link.viewerCount += 1;
    await link.save();

    // 3. Cache the entire link object as a JSON string
    // We use lean() to get a plain JS object to avoid caching Mongoose methods
    linkData = link.toObject();
    await redisClient.set(cacheKey, JSON.stringify(linkData), "EX", 3600);
  }

  // --- 4. THE NEW SAFETY CHECK ---
  // Check if analysis is complete and the score is below the threshold (e.g., < 3)
  if (linkData.analysisStatus === "COMPLETED" && linkData.aiSafetyRating < 3) {
    console.log(
      `Unsafe link detected: ${linkData.shortId}. Redirecting to warning page.`
    );
    // Redirect to a frontend warning page, passing the destination and reason as query params
    const destinationUrl = encodeURIComponent(linkData.longUrl);
    const reason = encodeURIComponent(linkData.aiSafetyJustification);
    return res.redirect(
      `${process.env.REACT_APP_FRONTEND_URL}/warning?destination=${destinationUrl}&reason=${reason}`
    );
  }

  // 5. If the link is safe, perform the direct redirect
  return res.redirect(302, linkData.longUrl);
});

export const addurl = asyncHandler(async (req, res) => {
  try {
    const oldLink = req.body.oldLink;
    const user_id = req.params.user_id;
    const user = await User.findById(user_id);
    if (!user) {
      console.log("User not found");
      throw new ApiError(404, "User not found");
    }
    if (!oldLink.startsWith("http://") && !oldLink.startsWith("https://")) {
      console.log("Invalid URL   ", oldLink);
      throw new ApiError(
        400,
        "Invalid URL: URL must start with 'http://' or 'https://'"
      );
    }

    // Ensure Links and its subfields are initialized
    if (!user.Links.oldLink) user.Links.oldLink = [];
    if (!user.Links.newLink) user.Links.newLink = [];

    if (user.Links.oldLink.includes(oldLink)) {
      console.log("Link already exists");
      throw new ApiError(400, "Link already exists");
    }

    user.Links.oldLink.push(oldLink);

    const existingLinks = user.Links.newLink;

    let random_string;
    do {
      random_string = Math.random().toString(36).substring(2, 7);
    } while (await Link.exists({ shortId: random_string }));

    const newLink = new Link({
      shortId: random_string,
      longUrl: oldLink,
      owner: user_id,
    });

    await newLink.save();

    // Add a job to the queue to analyze this link in the background
    await analysisQueue.add("analyze-link", { linkId: newLink._id });

    res.status(200).json({
      message: "Link added successfully",
      shortUrl: `${process.env.REACT_APP_FRONTEND_URL}/linkly/${random_string}`,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: err.message,
    });
  }
});

export const increaseViewer = asyncHandler(async (req, res) => {
  try {
    const web_id = req.params.web_id;
    const cacheKey = `link:${web_id}`;
    // 1. First, check Redis
    const cachedUrl = await redisClient.get(cacheKey);

    // 2. CACHE HIT: If found, redirect immediately
    if (cachedUrl) {
      console.log(`CACHE HIT for ${web_id}`);
      // We can optionally increment the viewer count in the background
      // For now, let's keep it simple and just redirect
      return res.status(200).json({
        message: "Redirecting from cache",
        oldLink: cachedUrl,
      });
    }

    // 3. CACHE MISS: Go to the database
    console.log(`CACHE MISS for ${web_id}`);
    const users = await User.find({
      "Links.newLink": `${process.env.REACT_APP_FRONTEND_URL}/linkly/${web_id}`,
    });
    if (users.length > 0) {
      const user = users[0];
      const index = user.Links.newLink.indexOf(
        `${process.env.REACT_APP_FRONTEND_URL}/linkly/${web_id}`
      );

      if (index !== -1) {
        user.Viewer[index] += 1;
        await user.save();
        res.status(200).json({
          message: "Viewer count increased successfully",
          oldLink: user.Links.oldLink[index],
        });
      } else {
        console.log("Link not found in user's Links");
        throw new ApiError(404, "Link not found in user's Links");
      }
    } else {
      console.log("Link not found");
      throw new ApiError(404, "Link not found");
    }
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: err.message,
    });
  }
});

export const geturls = asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.params;

    // Find all links in the Link collection that belong to this user
    const userLinks = await Link.find({ owner: user_id }).sort({
      createdAt: -1,
    }); // Sort by newest first

    if (!userLinks) {
      // This is unlikely to happen, but good practice
      return res.status(200).json({ urls: [] });
    }

    // Send the full link objects back to the frontend
    res.status(200).json({
      urls: userLinks,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: err.message,
    });
  }
});

// REPLACE your old deleteUrl function with this one

export const deleteUrl = asyncHandler(async (req, res) => {
  try {
    const { linkId } = req.params;
    const { user_id } = req.params; // Or from req.userData

    const link = await Link.findOne({ _id: linkId, owner: user_id });

    if (!link) {
      throw new ApiError(
        404,
        "Link not found or you do not have permission to delete it."
      );
    }

    // First, invalidate the cache
    await redisClient.del(`link:${link.shortId}`);

    // Then, delete the link from the database
    await Link.deleteOne({ _id: linkId });

    res.status(200).json({ message: "Link deleted successfully" });
  } catch (err) {
    console.error("Error in deleteUrl:", err);
    res.status(err.statusCode || 500).json({
      message: err.message || "An error occurred while deleting the URL",
    });
  }
});

export const editShortUrl = asyncHandler(async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const { oldShortUrl, newShortUrl } = req.body;

    // Log received data to debug
    console.log("Edit URL request:", { user_id, oldShortUrl, newShortUrl });

    const user = await User.findById(user_id);
    if (!user) {
      console.log("User not found");
      throw new ApiError(404, "User not found");
    }

    const idx = user.Links.newLink.indexOf(oldShortUrl);
    if (idx === -1) {
      console.log("Short URL not found");
      throw new ApiError(404, "Short URL not found");
    }

    // +++ Invalidate the OLD cache key +++
    const old_web_id = oldShortUrl.split("/").pop();
    await redisClient.del(`link:${old_web_id}`);
    console.log(`CACHE INVALIDATED for old link ${old_web_id}`);

    // Check if the new short URL already exists for this user
    if (user.Links.newLink.includes(newShortUrl)) {
      console.log("Short URL already exists");
      throw new ApiError(400, "Short URL already exists");
    }

    user.Links.newLink[idx] = newShortUrl;
    await user.save();
    res.status(200).json({ message: "Short URL updated successfully" });
  } catch (err) {
    console.error("Error in editShortUrl:", err);
    res.status(err.statusCode || 500).json({
      message: err.message || "An error occurred while updating the URL",
    });
  }
});

// Add this new function inside src/controllers/redirect.controller.js

export const editLongUrl = asyncHandler(async (req, res) => {
  try {
    const { linkId } = req.params;
    const { newLongUrl } = req.body;
    const { user_id } = req.params; // Or from req.userData if you prefer

    if (
      !newLongUrl ||
      (!newLongUrl.startsWith("http://") && !newLongUrl.startsWith("https://"))
    ) {
      throw new ApiError(400, "A valid new long URL is required.");
    }

    const link = await Link.findOne({ _id: linkId, owner: user_id });

    if (!link) {
      throw new ApiError(
        404,
        "Link not found or you do not have permission to edit it."
      );
    }

    link.longUrl = newLongUrl;
    // When a link is edited, its content has changed, so we must re-analyze it.
    link.analysisStatus = "PENDING";
    await link.save();

    // Invalidate the cache for the old entry
    await redisClient.del(`link:${link.shortId}`);

    // Add a new job to the queue to re-analyze the updated link
    // Make sure 'analysisQueue' is imported from '../jobs/queue.js'
    await analysisQueue.add("analyze-link", { linkId: link._id });

    res.status(200).json({ message: "Link updated successfully", link });
  } catch (err) {
    console.error("Error in editLongUrl:", err);
    res.status(err.statusCode || 500).json({
      message: err.message || "An error occurred while updating the URL",
    });
  }
});
