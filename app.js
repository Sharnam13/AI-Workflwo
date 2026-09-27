import express from "express";
import mongoose from "mongoose";
import orderRoutes from "./routes/order.routes.js";
import metricsRoutes from "./routes/metrics.routes.js";
import { notFound, errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) =>
  res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "up" : "down" }),
);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/metrics", metricsRoutes);

app.use(notFound);
app.use(errorHandler);

export { app };
