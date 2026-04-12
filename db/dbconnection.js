import {ApiError} from "../util/apiError.js";
import mongoose from "mongoose";
const connectDB = async () => {
  try {
    const conn=await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DB_NAME}`)
  }  catch (error) {
    throw new ApiError( "Failed to connect to MongoDB",500);
  }

  
  }
export { connectDB }

