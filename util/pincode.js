import { readFileSync } from "node:fs";
import { METRO, URBAN, SEMI_URBAN } from "../data/cityTiers.js";

// pincode -> [city, district, state, otherCityNames?]; ~24k entries loaded once into a Map.
// `city` is the most common post-office city for the pincode; the source data often
// uses the post office's own name, so district and the other names are kept for tiering.
const raw = JSON.parse(readFileSync(new URL("../data/pincodes.json", import.meta.url), "utf8"));
const pincodes = new Map(Object.entries(raw));

export const lookupPincode = (pincode) => {
  const hit = pincodes.get(String(pincode).trim());
  if (!hit) return null;
  const [city, district, state, otherCities = []] = hit;
  return { city, district, state, otherCities };
};

/** Every name a tier entry may match: "Name" and "Name, State". */
export const allPlaceNames = () => {
  const names = new Set();
  for (const [city, district, state, others = []] of pincodes.values()) {
    for (const n of [city, district, ...others]) names.add(n).add(`${n}, ${state}`);
  }
  return names;
};

const tiers = [
  ["METRO", new Set(METRO)],
  ["URBAN", new Set(URBAN)],
  ["SEMI_URBAN", new Set(SEMI_URBAN)],
];

/** Tier of the primary city, else of the district, else of any other city on the pincode. */
export const classifyLocation = ({ city, district, state, otherCities = [] }) => {
  for (const name of [city, district, ...otherCities]) {
    for (const [tier, names] of tiers) {
      if (names.has(`${name}, ${state}`) || names.has(name)) return tier;
    }
  }
  return "REMOTE";
};
