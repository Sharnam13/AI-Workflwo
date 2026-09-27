import { describe, it, expect } from "vitest";
import { riskConfig } from "../config/risk.config.js";
import {
  computeUserRisk,
  computeOrderRisk,
  computeLocationRisk,
  decide,
  planVerification,
} from "../services/riskEngine.js";

const orders = (spec) =>
  Object.entries(spec).flatMap(([key, n]) => {
    const [paymentType, status] = key.split(":");
    return Array.from({ length: n }, () => ({ paymentType, status }));
  });

const newUser = computeUserRisk([]);

describe("config", () => {
  it("weights sum to 1", () => {
    const sum = Object.values(riskConfig.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
  it("cancel threshold is above verify threshold", () => {
    expect(riskConfig.thresholds.cancel).toBeGreaterThan(riskConfig.thresholds.verify);
  });
});

describe("computeUserRisk", () => {
  it("is neutral for customers with too little history", () => {
    expect(computeUserRisk(orders({ "COD:RTO": 4 })).userRisk).toBe(0);
  });

  it("ignores unresolved orders (pending, shipped, cancelled)", () => {
    const r = computeUserRisk(
      orders({ "COD:RTO": 4, "COD:PENDING": 10, "COD:SHIPPED": 3, "COD:CANCELLED": 2 }),
    );
    expect(r.history).toBe(4);
    expect(r.userRisk).toBe(0);
  });

  it("computes per-payment-mode RTO rates", () => {
    const r = computeUserRisk(
      orders({ "COD:RTO": 3, "COD:DELIVERED": 1, "PREPAID:RTO": 1, "PREPAID:DELIVERED": 3 }),
    );
    expect(r.codRtoRate).toBe(0.75);
    expect(r.prepaidRtoRate).toBe(0.25);
    expect(r.fraudRate).toBe(0);
    expect(r.userRisk).toBeCloseTo(1.2 * 0.75 + 0.4 * 0.25);
  });

  it("caps at max", () => {
    expect(computeUserRisk(orders({ "COD:FAILED": 10 })).userRisk).toBe(riskConfig.user.max);
  });
});

describe("computeOrderRisk", () => {
  it.each([
    [500, "PREPAID", 0],
    [500, "COD", 2],
    [1500, "COD", 3],
    [2500, "COD", 4],
    [2500, "PREPAID", 1],
  ])("₹%i %s -> %i", (orderValue, paymentType, expected) => {
    expect(computeOrderRisk({ orderValue, paymentType })).toBe(expected);
  });
});

describe("computeLocationRisk", () => {
  it("maps tiers to 0..3 and unknown to worst", () => {
    expect(["METRO", "URBAN", "SEMI_URBAN", "REMOTE", undefined].map(computeLocationRisk)).toEqual([
      0, 1, 2, 3, 3,
    ]);
  });
});

describe("decide", () => {
  it("ships a small prepaid metro order with a clean address", () => {
    const r = decide({ user: newUser, locationTier: "METRO", orderRisk: 0, addressRisk: 0 });
    expect(r.decision).toBe("SHIPPED");
    expect(r.riskScore).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it("sends a high-value COD order to a remote area for verification", () => {
    const r = decide({ user: newUser, locationTier: "REMOTE", orderRisk: 4, addressRisk: 0 });
    expect(r.decision).toBe("VERIFY_PENDING");
    expect(r.riskScore).toBe(0.55);
    expect(r.reasons).toEqual(["HIGH_VALUE_COD", "REMOTE_LOCATION"]);
  });

  it("cancels when everything is bad", () => {
    const user = computeUserRisk(orders({ "COD:FAILED": 3, "COD:RTO": 3 }));
    const r = decide({ user, locationTier: "REMOTE", orderRisk: 4, addressRisk: 3 });
    expect(r.decision).toBe("CANCELLED_RISK");
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        "MEDIUM_FRAUD",
        "MEDIUM_RTO",
        "LOW_QUALITY_ADDRESS",
        "HIGH_VALUE_COD",
      ]),
    );
  });

  it("returns a breakdown whose contributions add up to the score", () => {
    const r = decide({ user: newUser, locationTier: "URBAN", orderRisk: 3, addressRisk: 2 });
    const sum = Object.values(r.breakdown).reduce((s, b) => s + b.contribution, 0);
    expect(sum).toBeCloseTo(r.riskScore, 2);
  });

  it("scores exactly at a threshold as the lower bucket", () => {
    const cfg = { ...riskConfig, thresholds: { cancel: 0.9, verify: 0.35 } };
    const r = decide({ user: newUser, locationTier: "METRO", orderRisk: 4, addressRisk: 0 }, cfg);
    expect(r.riskScore).toBe(0.35);
    expect(r.decision).toBe("SHIPPED");
  });
});

describe("planVerification", () => {
  it("asks fraud-prone users to prepay, firmly", () => {
    expect(planVerification(["HIGH_FRAUD", "LOW_QUALITY_ADDRESS"])).toEqual({
      actions: ["prepaid", "address"],
      tone: "firm",
    });
  });
  it("asks at most two things", () => {
    const r = planVerification(["HIGH_VALUE_COD", "LOW_QUALITY_ADDRESS", "REMOTE_LOCATION"]);
    expect(r.actions).toEqual(["prepaid", "address"]);
  });
  it("defaults to a soft confirmation", () => {
    expect(planVerification([])).toEqual({ actions: ["confirm"], tone: "soft" });
  });
});
