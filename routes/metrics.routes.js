import express from "express";
import { decisionMetrics } from "../controllers/metrics.controller.js";

const router = express.Router();

router.get("/decisions", decisionMetrics);

export default router;
