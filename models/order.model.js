import mongoose from "mongoose";

export const ORDER_STATUSES = [
  "PENDING", // created, not evaluated yet
  "SHIPPED", // cleared to ship (by the engine, or after verification)
  "VERIFY_PENDING", // waiting on customer confirmation
  "CANCELLED_RISK", // auto-cancelled by the engine
  "CANCELLED", // cancelled by ops / customer
  "DELIVERED",
  "FAILED", // fake / fraudulent order
  "RTO", // returned to origin
];

const orderSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerName: { type: String, required: true, trim: true },
    paymentType: { type: String, enum: ["COD", "PREPAID"], required: true },
    orderValue: { type: Number, required: true, min: 0 },
    items: [{ type: String }],
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String },
    district: { type: String },
    state: { type: String },
    locationTier: { type: String, enum: ["METRO", "URBAN", "SEMI_URBAN", "REMOTE"] },
    status: { type: String, enum: ORDER_STATUSES, default: "PENDING" },
  },
  { timestamps: true },
);

export const Order = mongoose.model("Order", orderSchema);
