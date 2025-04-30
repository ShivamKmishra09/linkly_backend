import { User } from "../models/User.js";
import { ApiError } from "../utilities/ApiError.js";
import { asyncHandler } from "../utilities/asyncHandler.js";

export const changeUserSubscription = asyncHandler(async (req, res) => {
    const user_id = req.params.user_id;
    const user = await User.findById(user_id);

    if (!user) {
        throw new ApiError(404, "User not found");
    } else {
        const { subscriptionType } = req.body; // Extract subscriptionType from req.body

        if (!subscriptionType) {
            throw new ApiError(400, "Subscription type is required");
        }

        user.subscription = subscriptionType;
        const currentDate = new Date();
        const endDateOfSubscription = new Date(currentDate.setMonth(currentDate.getMonth() + 1));

        user.endDateOfSubscription = endDateOfSubscription;

        user.save()
            .then(result => {
                res.status(201).json({
                    message: "Subscription updated",
                    subscriptionType: user.subscription,
                    endDateOfSubscription: user.endDateOfSubscription
                });
            })
            .catch(err => {
                console.error("Error saving user:", err);
                res.status(504).json({
                    error: err.message
                });
            });
    }
});
