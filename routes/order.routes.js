import express from "express";
import {
  createOrder,
  getOrder,
  evaluateOrder,
  getDecision,
  verificationMessage,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import { validateBody } from "../middlewares/validate.js";
import { createOrderSchema, updateStatusSchema } from "../validators/order.schema.js";

const router = express.Router();

router.post("/", validateBody(createOrderSchema), createOrder);
router.get("/:id", getOrder);
router.post("/:id/evaluate", evaluateOrder);
router.get("/:id/decision", getDecision);
router.post("/:id/verification-message", verificationMessage);
router.patch("/:id/status", validateBody(updateStatusSchema), updateOrderStatus);

export default router;
