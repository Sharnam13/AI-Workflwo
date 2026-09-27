// Every knob of the decision engine lives here so it can be tuned without
// touching the scoring code. Each signal is normalised to 0..1 before weighting.

export const riskConfig = {
  // Weights must sum to 1 (enforced by tests/riskEngine.test.js).
  weights: {
    user: 0.3, // past fraud / RTO behaviour of this customer
    location: 0.2, // how hard the pincode is to deliver to
    order: 0.35, // order value + payment mode
    address: 0.15, // AI-judged address clarity
  },

  // finalScore > cancel  -> CANCELLED_RISK
  // finalScore > verify  -> VERIFY_PENDING
  // otherwise            -> SHIPPED
  thresholds: {
    cancel: 0.65,
    verify: 0.4,
  },

  user: {
    // Customers with fewer resolved orders than this are scored as neutral (0).
    minHistory: 5,
    // Raw user risk = fraud*2 + codRto*1.2 + prepaidRto*0.4, capped at `max`.
    fraudWeight: 2,
    codRtoWeight: 1.2,
    prepaidRtoWeight: 0.4,
    max: 2,
    // Rates above these produce MEDIUM_* / HIGH_* reasons.
    mediumRate: 0.25,
    highRate: 0.5,
  },

  order: {
    mediumValue: 1000,
    highValue: 2000,
  },
};
