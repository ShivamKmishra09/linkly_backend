import { Router } from "express";
import {
    addurl,
    geturls,
    increaseViewer,
    deleteUrl,
    editShortUrl
} from "../controllers/redirect.controller.js";

import { checkForUserAuthentication } from "../middleware/auth.middleware.js";

const router = Router();
router.route("/loggedin/:user_id/redirect").patch(checkForUserAuthentication, addurl);
router.route("/loggedin/:user_id/urls").get(checkForUserAuthentication, geturls);
router.route("/linkly/:web_id").patch(increaseViewer);
router.route("/loggedin/:user_id/url").delete(checkForUserAuthentication, deleteUrl);
router.route("/loggedin/:user_id/url").patch(checkForUserAuthentication, editShortUrl);

export default router;