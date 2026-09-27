import mongoose from "mongoose";

export const connectDB = async (uri = process.env.MONGO_URI) => {
  if (!uri) throw new Error("MONGO_URI is not set (see .env.example)");
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};
