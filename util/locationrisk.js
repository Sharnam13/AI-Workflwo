import { locationClassifier } from "./classifier.js";
export const getLocationRisk = (city) => {
  const type = locationClassifier(city);

  if (type === "METRO") return 0;
  if (type === "URBAN") return 1;
  if (type === "SEMI_URBAN") return 2;
  return 3; // rural
};