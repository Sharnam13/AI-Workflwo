import { connectDB } from "./db/dbconnection.js";
import {app} from "./app.js"
import dotenv from "dotenv";
dotenv.config();

connectDB().then( () =>{
  app.on("error", (error)=>{
    console.error("Error starting the server:", error);
  })
app.listen(process.env.PORT ||8000,()=>{
  console.log(`Server is running on port ${process.env.PORT || 8000}`);
})
}).catch((error)=>{
  console.error("Failed to connect to the database:", error);
})
