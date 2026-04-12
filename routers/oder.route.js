import express from "express";
import { createOrder, getOrder, evaluateOrder,upateOrderStatus,checkLog,verifymsggenerator } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/create", createOrder);
router.post("/:id/status",evaluateOrder);
router.get("/:id", getOrder);
router.post("/:id/update",upateOrderStatus);
router.get("/:id/checklog", checkLog);
router.get("/:id/msg", verifymsggenerator);


export default router;