import { Router } from "express";
import {
    newPayment,
    checkStatus
} from "../controllers/payment.controller.js";

import { checkForUserAuthentication } from "../middleware/auth.middleware.js";

const router = Router();
router.route("/order").post(checkForUserAuthentication, newPayment);
router.route("/status").post(checkStatus);

export default router;
