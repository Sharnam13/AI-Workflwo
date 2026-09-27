import { describe, it, expect } from "vitest";
import { METRO, URBAN, SEMI_URBAN } from "../data/cityTiers.js";
import { lookupPincode, classifyLocation, allPlaceNames } from "../util/pincode.js";

describe("city tiers", () => {
  const names = allPlaceNames();

  it.each([...METRO, ...URBAN, ...SEMI_URBAN])("%s exists in the pincode dataset", (name) => {
    expect(names.has(name)).toBe(true);
  });

  it("has no city in more than one tier", () => {
    const all = [...METRO, ...URBAN, ...SEMI_URBAN];
    expect(all.length).toBe(new Set(all).size);
  });
});

describe("lookupPincode / classifyLocation", () => {
  it.each([
    ["110001", "New Delhi", "METRO"],
    ["400001", "Mumbai", "METRO"],
    ["560001", "Bangalore", "METRO"],
    ["302001", "Jaipur", "URBAN"],
    ["530001", "Vishakhapatnam", "URBAN"],
    ["431001", "Aurangabad", "URBAN"], // Maharashtra
    ["824101", "Aurangabad", "SEMI_URBAN"], // Bihar
  ])("%s -> %s (%s)", (pin, city, tier) => {
    const loc = lookupPincode(pin);
    expect(loc.city).toBe(city);
    expect(classifyLocation(loc)).toBe(tier);
  });

  it("accepts numeric pincodes and rejects unknown ones", () => {
    expect(lookupPincode(110001)?.city).toBe("New Delhi");
    expect(lookupPincode("000000")).toBeNull();
  });

  it("classifies unknown cities as REMOTE", () => {
    expect(classifyLocation({ city: "Nowhere", district: "Nowhere", state: "X" })).toBe("REMOTE");
  });
});
