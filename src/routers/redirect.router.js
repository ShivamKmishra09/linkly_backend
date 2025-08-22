import { Router } from "express";
import {
  addurl,
  geturls,
  handleRedirect,
  deleteUrl,
  editLongUrl,
} from "../controllers/redirect.controller.js";

import { checkForUserAuthentication } from "../middleware/auth.middleware.js";

const router = Router();
router
  .route("/loggedin/:user_id/redirect")
  .patch(checkForUserAuthentication, addurl);
router
  .route("/loggedin/:user_id/urls")
  .get(checkForUserAuthentication, geturls);
router.route("/linkly/:web_id").get(handleRedirect);
router
  .route("/loggedin/:user_id/url/:linkId")
  .patch(checkForUserAuthentication, editLongUrl) // Edits a link
  .delete(checkForUserAuthentication, deleteUrl);

export default router;
