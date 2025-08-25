import { Router } from "express";
import {
  createCollection,
  getCollections,
  deleteCollection,
} from "../controllers/collection.controller.js";
import { checkForUserAuthentication } from "../middleware/auth.middleware.js";

const router = Router();

// Routes for getting all collections and creating a new one
router
  .route("/loggedin/:user_id/collections")
  .get(checkForUserAuthentication, getCollections)
  .post(checkForUserAuthentication, createCollection);

// Route for deleting a specific collection
router
  .route("/loggedin/:user_id/collections/:collectionId")
  .delete(checkForUserAuthentication, deleteCollection);

// The incorrect "/add-link" route has been removed.

export default router;
