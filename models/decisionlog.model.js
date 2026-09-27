import mongoose from "mongoose";

// One log per evaluated order, for every decision (including SHIPPED), so any
// outcome can be explained later and compared against what actually happened.
const decisionLogSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    riskScore: { type: Number, required: true },
    finalDecision: {
      type: String,
      enum: ["SHIPPED", "VERIFY_PENDING", "CANCELLED_RISK"],
      required: true,
    },
    reasons: [{ type: String }],
    breakdown: { type: mongoose.Schema.Types.Mixed },
    addressScoreSource: { type: String, enum: ["ai", "rule"] },
  },
  { timestamps: true },
);

export const DecisionLog = mongoose.model("DecisionLog", decisionLogSchema);
