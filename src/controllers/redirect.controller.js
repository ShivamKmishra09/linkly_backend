import { User } from "../models/User.js";
import { ApiError } from "../utilities/ApiError.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

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
            throw new ApiError(400, "Invalid URL: URL must start with 'http://' or 'https://'");
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
        let newLink_new;
        do {
            random_string = Math.random().toString(36).substring(2, 7);
            newLink_new = `${process.env.REACT_APP_FRONTEND_URL}/linkly/${random_string}`;
        } while (existingLinks.includes(newLink_new));

        user.Links.newLink.push(newLink_new);

        if (!user.Viewer) user.Viewer = [];
        user.Viewer.push(0);

        await user.save();
        res.status(200).json({
            message: "Link added successfully"
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
        const users = await User.find({ "Links.newLink": `${process.env.REACT_APP_FRONTEND_URL }/linkly/${web_id}` });
        if (users.length > 0) {
            const user = users[0];
            const index = user.Links.newLink.indexOf(`${process.env.REACT_APP_FRONTEND_URL}/linkly/${web_id}`);

            if (index !== -1) {
                user.Viewer[index] += 1;
                await user.save();
                res.status(200).json({
                    message: "Viewer count increased successfully",
                    oldLink: user.Links.oldLink[index]
                });
            } else {
                console.log("Link not found in user's Links")
                throw new ApiError(404, "Link not found in user's Links");
            }
        } else {
            console.log("Link not found")
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
        const user_id = req.params.user_id;
        const user = await User.findById(user_id);
        if (!user) {
            throw new ApiError(404, "User not found");
        }
        res.status(200).json({
            urls: user.Links,
        });
    } catch (err) {
        console.log(err);
        res.status(400).json({
            message: err.message,
        });
    }
});

export const deleteUrl = asyncHandler(async (req, res) => {
    try {
        const user_id = req.params.user_id;
        const { shortUrl } = req.body;
        
        // Log received data to debug
        console.log("Delete URL request:", { user_id, shortUrl });
        
        const user = await User.findById(user_id);
        if (!user) {
            console.log("User not found");
            throw new ApiError(404, "User not found");
        }

        const idx = user.Links.newLink.indexOf(shortUrl);
        if (idx === -1) {
            console.log("Short URL not found");
            throw new ApiError(404, "Short URL not found");
        }

        // Remove the item at idx from all related arrays
        user.Links.newLink.splice(idx, 1);
        user.Links.oldLink.splice(idx, 1);
        if (user.Viewer && user.Viewer.length > idx) user.Viewer.splice(idx, 1);

        await user.save();
        res.status(200).json({ message: "Link deleted successfully" });
    } catch (err) {
        console.error("Error in deleteUrl:", err);
        res.status(err.statusCode || 500).json({
            message: err.message || "An error occurred while deleting the URL"
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
            message: err.message || "An error occurred while updating the URL"
        });
    }
});