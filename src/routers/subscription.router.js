import { Router } from "express";
import {
    changeUserSubscription
  } from "../controllers/subscription.controller.js";

  import { checkForUserAuthentication } from "../middleware/auth.middleware.js";

  const router = Router();
  router.route("/loggedin/:user_id/subscription").patch(checkForUserAuthentication, changeUserSubscription);
  
  export default router;