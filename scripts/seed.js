// Fills the database with demo customers, their order history and some evaluated
// orders with real outcomes, so every endpoint (including /metrics) has data.
//   npm run seed            -> wipes and reseeds
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../db/connection.js";
import { Order } from "../models/order.model.js";
import { DecisionLog } from "../models/decisionlog.model.js";
import { lookupPincode, classifyLocation } from "../util/pincode.js";
import { computeUserRisk, computeOrderRisk, decide } from "../services/riskEngine.js";
import { heuristicAddressScore } from "../services/addressScorer.js";

// Deterministic PRNG so every seed produces the same data.
let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const PINCODES = [
  "110001",
  "400001",
  "560001",
  "600001",
  "302001",
  "226001",
  "208001",
  "282001",
  "176001",
  "263601",
  "785001",
];
const ADDRESSES = [
  "Flat 12B, Sunshine Apartments, MG Road, near City Mall",
  "House 45, Sector 14, near Shiv Mandir",
  "Plot 7, Gandhi Nagar, Lane 3, opp. Post Office",
  "B-202, Green Valley Society, Station Road",
  "near bus stand",
  "village ke paas",
];

const CUSTOMERS = [
  { name: "Aarav Sharma", email: "aarav@example.com", profile: "loyal", history: 12 },
  { name: "Priya Nair", email: "priya@example.com", profile: "loyal", history: 8 },
  { name: "Rohit Verma", email: "rohit@example.com", profile: "serial_rto", history: 9 },
  { name: "Neha Gupta", email: "neha@example.com", profile: "mixed", history: 7 },
  { name: "Fake Buyer", email: "fraud@example.com", profile: "fraud", history: 6 },
  { name: "Kabir Singh", email: "kabir@example.com", profile: "new", history: 0 },
];

const outcomeFor = (profile, paymentType) => {
  const r = rand();
  if (profile === "fraud") return r < 0.6 ? "FAILED" : "RTO";
  if (profile === "serial_rto") return paymentType === "COD" && r < 0.7 ? "RTO" : "DELIVERED";
  if (profile === "mixed") return r < 0.3 ? "RTO" : "DELIVERED";
  return r < 0.05 ? "RTO" : "DELIVERED";
};

const baseOrder = (c, overrides = {}) => {
  const pincode = pick(PINCODES);
  const loc = lookupPincode(pincode);
  return {
    email: c.email,
    customerName: c.name,
    paymentType: rand() < 0.65 ? "COD" : "PREPAID",
    orderValue: Math.round(300 + rand() * 4700),
    items: ["Demo item"],
    address: pick(ADDRESSES),
    pincode,
    city: loc.city,
    district: loc.district,
    state: loc.state,
    locationTier: classifyLocation(loc),
    ...overrides,
  };
};

await connectDB();
await Promise.all([Order.deleteMany({}), DecisionLog.deleteMany({})]);

// 1. Past, already-resolved orders (these drive the user-risk signal).
const history = CUSTOMERS.flatMap((c) =>
  Array.from({ length: c.history }, () => {
    const o = baseOrder(c);
    return { ...o, status: outcomeFor(c.profile, o.paymentType) };
  }),
);
await Order.insertMany(history);

// 2. Orders run through the engine, with outcomes recorded -> feeds /metrics.
let evaluated = 0;
for (let i = 0; i < 60; i++) {
  const c = pick(CUSTOMERS);
  const order = await Order.create(baseOrder(c));
  const past = await Order.find({ email: c.email, _id: { $ne: order._id } }).lean();
  const result = decide({
    user: computeUserRisk(past),
    locationTier: order.locationTier,
    orderRisk: computeOrderRisk(order),
    addressRisk: heuristicAddressScore(order.address),
  });
  let status = result.decision;
  if (status === "SHIPPED") status = outcomeFor(c.profile, order.paymentType);
  else if (status === "VERIFY_PENDING" && rand() < 0.7)
    status = rand() < 0.75 ? outcomeFor(c.profile, order.paymentType) : "CANCELLED";

  order.status = status;
  await order.save();
  await DecisionLog.create({
    orderId: order._id,
    riskScore: result.riskScore,
    finalDecision: result.decision,
    reasons: result.reasons,
    breakdown: result.breakdown,
    addressScoreSource: "rule",
  });
  evaluated++;
}

// 3. Fresh PENDING orders to try the API on.
const pending = await Order.insertMany(
  [
    baseOrder(CUSTOMERS[0], {
      paymentType: "PREPAID",
      orderValue: 899,
      pincode: "560001",
      address: ADDRESSES[0],
    }),
    baseOrder(CUSTOMERS[2], {
      paymentType: "COD",
      orderValue: 3499,
      pincode: "302001",
      address: ADDRESSES[1],
    }),
    baseOrder(CUSTOMERS[4], {
      paymentType: "COD",
      orderValue: 4999,
      pincode: "176001",
      address: "village ke paas",
    }),
    baseOrder(CUSTOMERS[5], {
      paymentType: "COD",
      orderValue: 2499,
      pincode: "263601",
      address: ADDRESSES[2],
    }),
  ].map((o) => ({ ...o, ...locFields(o.pincode) })),
);

function locFields(pincode) {
  const loc = lookupPincode(pincode);
  return {
    city: loc.city,
    district: loc.district,
    state: loc.state,
    locationTier: classifyLocation(loc),
  };
}

console.log(`Seeded ${history.length} historical orders, ${evaluated} evaluated orders.`);
console.log("PENDING orders you can evaluate (POST /api/v1/orders/:id/evaluate):");
for (const o of pending)
  console.log(
    `  ${o._id}  ${o.customerName.padEnd(13)} ${o.paymentType.padEnd(7)} ₹${o.orderValue}  ${o.city}`,
  );

await mongoose.disconnect();
