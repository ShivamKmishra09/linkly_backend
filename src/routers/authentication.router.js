import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  authenticateUser,
  googleAuthHandler
} from "../controllers/authentication.controller.js";

import { checkForUserAuthentication } from "../middleware/auth.middleware.js";

const router = Router();
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/google-auth").post(googleAuthHandler);
router.route("/authenticate").get(authenticateUser);
router.route("/logout").post(checkForUserAuthentication, logoutUser);

export default router;
