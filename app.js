import express from "express";
import orderRoutes from "./routers/oder.route.js";
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use("/api/v1/orders",orderRoutes);

export { app }