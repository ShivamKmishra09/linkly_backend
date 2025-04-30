import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const checkForUserAuthentication = async (req, res, next) => {
  try {
    const bearerHeader = req.headers.authorization || req.query.authorization;
    const token = bearerHeader.split(' ')[1];
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);
    req.userData = decodedToken;
    next();
  }
  catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

