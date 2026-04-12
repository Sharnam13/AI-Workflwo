import mongoose from "mongoose";

const decisionLogSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    riskScore: Number,
    finalDecision: {
      type : String,
      enum : ["CANCELLED_RISK", "VERIFY_PENDING"]
    },
    reason: {
      type : []
    }
  },
  { timestamps: true }
);

export const DecisionLog = mongoose.model("DecisionLog", decisionLogSchema);