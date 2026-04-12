import { Order} from "../models/order.model.js";
import { DecisionLog } from "../models/decisionlog.model.js";

export const getUserRisk = async (email) => {
  const orders = await Order.find({ email });

  const total = orders.length;
  if (total < 5) return {userRisk : 0,fraudRate : 0, codRtoRate : 0, prepaidRtoRate : 0};

  // Fraud (FAILED)
  const failed = orders.filter(o => o.status === "FAILED").length;
  const fraudRate = failed / total;

  // Split by payment type
  const codOrders = orders.filter(o => o.paymentType === "COD");
  const prepaidOrders = orders.filter(o => o.paymentType === "PREPAID");

  const codRTO = codOrders.filter(o => o.status === "RTO").length;
  const prepaidRTO = prepaidOrders.filter(o => o.status === "RTO").length;

  const codRtoRate = codOrders.length > 0
    ? codRTO / codOrders.length
    : 0;

  const prepaidRtoRate = prepaidOrders.length > 0
    ? prepaidRTO / prepaidOrders.length
    : 0;

  // Final risk calculation
  let risk =
    2 * fraudRate +
    1.2 * codRtoRate +
    0.4 * prepaidRtoRate;

  return {userRisk : Math.min(risk, 2), fraudRate, codRtoRate, prepaidRtoRate};
};