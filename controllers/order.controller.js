import { Order } from "../models/order.model.js";
import { DecisionLog } from "../models/decisionlog.model.js";
import { asyncHandler } from "../util/asyncHandler.js";
import { ApiError } from "../util/ApiError.js";
import { ApiResponse } from "../util/ApiResponse.js";
import { lookupPincode, classifyLocation } from "../util/pincode.js";
import {
  computeUserRisk,
  computeOrderRisk,
  decide,
  planVerification,
} from "../services/riskEngine.js";
import { scoreAddress } from "../services/addressScorer.js";
import { generateVerificationMessage } from "../services/messageGenerator.js";

// Which outcome can be recorded from which current status.
const TRANSITIONS = {
  VERIFY_PENDING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RTO", "FAILED", "CANCELLED"],
  CANCELLED_RISK: ["CANCELLED"],
};

const findOrder = async (id) => {
  const order = await Order.findById(id);
  if (!order) throw new ApiError("Order not found", 404);
  return order;
};

const createOrder = asyncHandler(async (req, res) => {
  const location = lookupPincode(req.body.pincode);
  if (!location) throw new ApiError(`Unknown pincode ${req.body.pincode}`, 400);

  const order = await Order.create({
    ...req.body,
    city: location.city,
    district: location.district,
    state: location.state,
    locationTier: classifyLocation(location),
  });
  return res.status(201).json(new ApiResponse(201, "Order created", order));
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await findOrder(req.params.id);
  return res.status(200).json(new ApiResponse(200, "Order found", order));
});

const evaluateOrder = asyncHandler(async (req, res) => {
  const order = await findOrder(req.params.id);
  if (order.status !== "PENDING") throw new ApiError("Only PENDING orders can be evaluated", 409);

  const pastOrders = await Order.find(
    { email: order.email, _id: { $ne: order._id } },
    { status: 1, paymentType: 1 },
  ).lean();
  const user = computeUserRisk(pastOrders);
  const orderRisk = computeOrderRisk(order);
  const address = await scoreAddress(order.address);

  const result = decide({
    user,
    locationTier: order.locationTier,
    orderRisk,
    addressRisk: address.score,
  });

  // Conditional update so two concurrent evaluate calls can't both win.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "PENDING" },
    { status: result.decision },
    { returnDocument: "after" },
  );
  if (!updated) throw new ApiError("Order was evaluated concurrently", 409);

  await DecisionLog.create({
    orderId: order._id,
    riskScore: result.riskScore,
    finalDecision: result.decision,
    reasons: result.reasons,
    breakdown: result.breakdown,
    addressScoreSource: address.source,
  });

  return res.status(200).json(
    new ApiResponse(200, "Order evaluated", {
      orderId: order._id,
      ...result,
      signals: {
        userHistory: user.history,
        locationTier: order.locationTier,
        orderRisk,
        addressRisk: address.score,
        addressScoreSource: address.source,
      },
    }),
  );
});

const getDecision = asyncHandler(async (req, res) => {
  const decision = await DecisionLog.findOne({ orderId: req.params.id }).populate("orderId");
  if (!decision) throw new ApiError("No decision for this order yet", 404);
  return res.status(200).json(new ApiResponse(200, "Decision fetched", decision));
});

const verificationMessage = asyncHandler(async (req, res) => {
  const decision = await DecisionLog.findOne({ orderId: req.params.id }).populate("orderId");
  if (!decision) throw new ApiError("No decision for this order yet", 404);
  const order = decision.orderId;
  if (order.status !== "VERIFY_PENDING")
    throw new ApiError("Order is not waiting for verification", 409);

  const { actions, tone } = planVerification(decision.reasons);
  const { message, source } = await generateVerificationMessage({
    name: order.customerName,
    tone,
    actions,
    order,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, "Message generated", { message, tone, actions, source }));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await findOrder(req.params.id);
  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw new ApiError(
      `Cannot move order from ${order.status} to ${status}` +
        (allowed.length ? ` (allowed: ${allowed.join(", ")})` : ""),
      409,
    );
  }
  order.status = status;
  await order.save();
  return res.status(200).json(new ApiResponse(200, "Order status updated", order));
});

export {
  createOrder,
  getOrder,
  evaluateOrder,
  getDecision,
  verificationMessage,
  updateOrderStatus,
};
