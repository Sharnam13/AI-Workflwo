import { DecisionLog } from "../models/decisionlog.model.js";
import { asyncHandler } from "../util/asyncHandler.js";
import { ApiResponse } from "../util/ApiResponse.js";

const BAD = ["RTO", "FAILED"];
const RESOLVED = ["DELIVERED", ...BAD];

const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);

/**
 * How good were the engine's calls? Joins every decision with the order's real
 * outcome (recorded via PATCH /orders/:id/status).
 */
const decisionMetrics = asyncHandler(async (req, res) => {
  const rows = await DecisionLog.aggregate([
    { $lookup: { from: "orders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    {
      $group: { _id: { decision: "$finalDecision", outcome: "$order.status" }, count: { $sum: 1 } },
    },
  ]);

  const byDecision = {};
  for (const { _id, count } of rows) {
    byDecision[_id.decision] ??= { total: 0, outcomes: {} };
    byDecision[_id.decision].total += count;
    byDecision[_id.decision].outcomes[_id.outcome] = count;
  }

  const summarise = (decision) => {
    const o = byDecision[decision]?.outcomes ?? {};
    const resolved = RESOLVED.reduce((s, k) => s + (o[k] ?? 0), 0);
    const bad = BAD.reduce((s, k) => s + (o[k] ?? 0), 0);
    return { resolved, bad, badRatePct: pct(bad, resolved) };
  };

  const shipped = summarise("SHIPPED");
  const verified = summarise("VERIFY_PENDING");
  const totalDecisions = Object.values(byDecision).reduce((s, d) => s + d.total, 0);

  return res.status(200).json(
    new ApiResponse(200, "Decision metrics", {
      totalDecisions,
      decisionMixPct: Object.fromEntries(
        Object.entries(byDecision).map(([k, v]) => [k, pct(v.total, totalDecisions)]),
      ),
      // Of the orders the engine let straight through, how many still went bad?
      autoShipped: shipped,
      // Of orders sent to verification that customers confirmed and we shipped, how many went bad?
      shippedAfterVerification: verified,
      byDecision,
    }),
  );
});

export { decisionMetrics };
