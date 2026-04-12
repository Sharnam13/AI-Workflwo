export const getOrderRisk = (order) => {
  let score = 0;

  if (order.orderValue > 2000) score += 2;
  else if (order.orderValue > 1000) score += 1;

  if (order.paymentType === "COD") score += 2;
  else score -= 1;

  return Math.max(score, 0);
};