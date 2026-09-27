import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../app.js";
import { Order } from "../models/order.model.js";
import { DecisionLog } from "../models/decisionlog.model.js";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await DecisionLog.init(); // build the unique index before tests race on it
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await Order.deleteMany({});
  await DecisionLog.deleteMany({});
});

const api = request(app);

const validOrder = {
  email: "Ravi@Example.com",
  customerName: "Ravi Kumar",
  paymentType: "prepaid",
  orderValue: 799,
  address: "Flat 12B, Sunshine Apartments, MG Road, near City Mall",
  pincode: 560001,
};

const create = async (overrides = {}) => {
  const res = await api.post("/api/v1/orders").send({ ...validOrder, ...overrides });
  expect(res.status).toBe(201);
  return res.body.data;
};

describe("POST /api/v1/orders", () => {
  it("creates an order and resolves pincode -> city/tier", async () => {
    const order = await create();
    expect(order).toMatchObject({
      email: "ravi@example.com",
      customerName: "Ravi Kumar",
      paymentType: "PREPAID",
      pincode: "560001",
      city: "Bangalore",
      state: "Karnataka",
      locationTier: "METRO",
      status: "PENDING",
    });
  });

  it("returns JSON validation errors", async () => {
    const res = await api
      .post("/api/v1/orders")
      .send({ ...validOrder, email: "nope", pincode: "12" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(["email", "pincode"]);
  });

  it("rejects unknown pincodes with 400", async () => {
    const res = await api.post("/api/v1/orders").send({ ...validOrder, pincode: "000000" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown pincode/);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await api
      .post("/api/v1/orders")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/orders/:id", () => {
  it("400s on a malformed id and 404s on a missing one", async () => {
    expect((await api.get("/api/v1/orders/not-an-id")).status).toBe(400);
    expect((await api.get(`/api/v1/orders/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });
});

describe("evaluation flow", () => {
  it("ships a clean prepaid metro order and logs the decision", async () => {
    const { _id } = await create();
    const res = await api.post(`/api/v1/orders/${_id}/evaluate`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ decision: "SHIPPED", reasons: [] });

    const log = await api.get(`/api/v1/orders/${_id}/decision`);
    expect(log.body.data.finalDecision).toBe("SHIPPED");

    const again = await api.post(`/api/v1/orders/${_id}/evaluate`);
    expect(again.status).toBe(409);
  });

  it("treats Delhi as a metro (regression: used to be REMOTE)", async () => {
    const { locationTier } = await create({ pincode: "110001" });
    expect(locationTier).toBe("METRO");
  });

  it("verifies a risky order and generates a message", async () => {
    const { _id } = await create({
      paymentType: "COD",
      orderValue: 4999,
      address: "somewhere",
      pincode: "176001", // Himachal, not in any tier -> REMOTE
    });
    const res = await api.post(`/api/v1/orders/${_id}/evaluate`);
    expect(res.body.data.decision).toBe("CANCELLED_RISK");

    const { _id: id2 } = await create({ paymentType: "COD", orderValue: 4999, pincode: "176001" });
    const res2 = await api.post(`/api/v1/orders/${id2}/evaluate`);
    expect(res2.body.data.decision).toBe("VERIFY_PENDING");
    expect(res2.body.data.reasons).toEqual(["HIGH_VALUE_COD", "REMOTE_LOCATION"]);

    const msg = await api.post(`/api/v1/orders/${id2}/verification-message`);
    expect(msg.status).toBe(200);
    expect(msg.body.data.actions).toEqual(["prepaid", "confirm"]);
    expect(msg.body.data.message).toMatch(/^Hi Ravi Kumar/);
  });

  it("uses the customer's resolved history", async () => {
    await Order.insertMany(
      Array.from({ length: 6 }, () => ({
        ...validOrder,
        email: "ravi@example.com",
        pincode: "560001",
        paymentType: "COD",
        status: "RTO",
      })),
    );
    const { _id } = await create({ paymentType: "COD", orderValue: 1500 });
    const res = await api.post(`/api/v1/orders/${_id}/evaluate`);
    expect(res.body.data.signals.userHistory).toBe(6);
    expect(res.body.data.reasons).toContain("HIGH_RTO");
    expect(res.body.data.decision).toBe("VERIFY_PENDING");
  });
});

describe("PATCH /api/v1/orders/:id/status + metrics", () => {
  it("enforces valid transitions", async () => {
    const { _id } = await create();
    const early = await api.patch(`/api/v1/orders/${_id}/status`).send({ status: "DELIVERED" });
    expect(early.status).toBe(409);

    await api.post(`/api/v1/orders/${_id}/evaluate`);
    const bad = await api.patch(`/api/v1/orders/${_id}/status`).send({ status: "PENDING" });
    expect(bad.status).toBe(400);
    const ok = await api.patch(`/api/v1/orders/${_id}/status`).send({ status: "RTO" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("RTO");
  });

  it("reports how auto-shipped orders actually turned out", async () => {
    for (const outcome of ["DELIVERED", "DELIVERED", "DELIVERED", "RTO"]) {
      const { _id } = await create();
      await api.post(`/api/v1/orders/${_id}/evaluate`);
      await api.patch(`/api/v1/orders/${_id}/status`).send({ status: outcome });
    }
    const res = await api.get("/api/v1/metrics/decisions");
    expect(res.status).toBe(200);
    expect(res.body.data.totalDecisions).toBe(4);
    expect(res.body.data.autoShipped).toEqual({ resolved: 4, bad: 1, badRatePct: 25 });
  });
});

describe("misc", () => {
  it("has a health check and JSON 404s", async () => {
    expect((await api.get("/health")).body).toEqual({ status: "ok", db: "up" });
    const res = await api.get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
