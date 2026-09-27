// Pure scoring logic: no DB, no network. Everything here is unit-tested.
import { riskConfig } from "../config/risk.config.js";

const LOCATION_RISK = { METRO: 0, URBAN: 1, SEMI_URBAN: 2, REMOTE: 3 };

export const RESOLVED_STATUSES = ["DELIVERED", "RTO", "FAILED"];

/** Risk from this customer's resolved past orders. Returns raw score 0..max. */
export const computeUserRisk = (pastOrders, cfg = riskConfig.user) => {
  const resolved = pastOrders.filter((o) => RESOLVED_STATUSES.includes(o.status));
  const empty = {
    userRisk: 0,
    fraudRate: 0,
    codRtoRate: 0,
    prepaidRtoRate: 0,
    history: resolved.length,
  };
  if (resolved.length < cfg.minHistory) return empty;

  const rate = (list, status) =>
    list.length ? list.filter((o) => o.status === status).length / list.length : 0;
  const fraudRate = rate(resolved, "FAILED");
  const codRtoRate = rate(
    resolved.filter((o) => o.paymentType === "COD"),
    "RTO",
  );
  const prepaidRtoRate = rate(
    resolved.filter((o) => o.paymentType === "PREPAID"),
    "RTO",
  );

  const risk =
    cfg.fraudWeight * fraudRate +
    cfg.codRtoWeight * codRtoRate +
    cfg.prepaidRtoWeight * prepaidRtoRate;

  return {
    userRisk: Math.min(risk, cfg.max),
    fraudRate,
    codRtoRate,
    prepaidRtoRate,
    history: resolved.length,
  };
};

/** 0..3 from the location tier. */
export const computeLocationRisk = (tier) => LOCATION_RISK[tier] ?? 3;

/** 0..4 from order value and payment mode. */
export const computeOrderRisk = ({ orderValue, paymentType }, cfg = riskConfig.order) => {
  let score = 0;
  if (orderValue > cfg.highValue) score += 2;
  else if (orderValue > cfg.mediumValue) score += 1;
  score += paymentType === "COD" ? 2 : -1;
  return Math.max(score, 0);
};

const levelReason = (rate, name, cfg) => {
  if (rate > cfg.highRate) return `HIGH_${name}`;
  if (rate > cfg.mediumRate) return `MEDIUM_${name}`;
  return null;
};

/**
 * Combine the four signals into a decision.
 * @returns {{ decision, riskScore, breakdown, reasons }}
 */
export const decide = ({ user, locationTier, orderRisk, addressRisk }, cfg = riskConfig) => {
  const locationRisk = computeLocationRisk(locationTier);
  const normalized = {
    user: user.userRisk / cfg.user.max,
    location: locationRisk / 3,
    order: orderRisk / 4,
    address: addressRisk / 3,
  };
  const breakdown = Object.fromEntries(
    Object.entries(normalized).map(([k, v]) => [
      k,
      { score: round(v), weight: cfg.weights[k], contribution: round(v * cfg.weights[k]) },
    ]),
  );
  const riskScore = round(Object.values(breakdown).reduce((sum, b) => sum + b.score * b.weight, 0));

  let decision = "SHIPPED";
  if (riskScore > cfg.thresholds.cancel) decision = "CANCELLED_RISK";
  else if (riskScore > cfg.thresholds.verify) decision = "VERIFY_PENDING";

  const reasons = [];
  if (user.history >= cfg.user.minHistory) {
    reasons.push(
      levelReason(user.fraudRate, "FRAUD", cfg.user),
      levelReason(user.codRtoRate, "RTO", cfg.user),
      levelReason(user.prepaidRtoRate, "PREPAID_RTO", cfg.user),
    );
  }
  if (addressRisk >= 2) reasons.push("LOW_QUALITY_ADDRESS");
  if (orderRisk === 4) reasons.push("HIGH_VALUE_COD");
  else if (orderRisk === 3) reasons.push("MEDIUM_VALUE_COD");
  if (locationTier === "REMOTE") reasons.push("REMOTE_LOCATION");
  else if (locationTier === "SEMI_URBAN") reasons.push("SEMI_URBAN_LOCATION");

  return { decision, riskScore, breakdown, reasons: reasons.filter(Boolean) };
};

/** Which verification actions + tone a VERIFY_PENDING order needs. */
export const planVerification = (reasons) => {
  const has = (...r) => r.some((x) => reasons.includes(x));
  let toneScore = 0;
  const actions = new Set();

  if (has("HIGH_FRAUD")) {
    actions.add("prepaid");
    toneScore = 2;
  }
  if (has("HIGH_VALUE_COD")) {
    actions.add("prepaid");
    toneScore = Math.max(toneScore, 0.5);
  }
  if (has("MEDIUM_FRAUD", "HIGH_RTO")) {
    actions.add("confirm");
    toneScore = Math.max(toneScore, 1);
  }
  if (
    has(
      "MEDIUM_RTO",
      "HIGH_PREPAID_RTO",
      "MEDIUM_PREPAID_RTO",
      "REMOTE_LOCATION",
      "SEMI_URBAN_LOCATION",
    )
  ) {
    actions.add("confirm");
    toneScore = Math.max(toneScore, 0.5);
  }
  if (has("LOW_QUALITY_ADDRESS")) {
    actions.add("address");
    toneScore = Math.max(toneScore, 1);
  }

  // Priority order; ask for at most two things so the message stays short.
  const selected = ["prepaid", "address", "confirm"].filter((a) => actions.has(a)).slice(0, 2);
  const tone = toneScore >= 2 ? "firm" : toneScore >= 1 ? "normal" : "soft";
  return { actions: selected.length ? selected : ["confirm"], tone };
};

const round = (n) => Math.round(n * 1000) / 1000;
