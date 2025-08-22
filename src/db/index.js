import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

let DB_URL = process.env.DB_URL;

const connectDB = async () => {
  try {
    await mongoose.connect(DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
    });
    console.log("Connected to MongoDB database");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
};

export { connectDB };