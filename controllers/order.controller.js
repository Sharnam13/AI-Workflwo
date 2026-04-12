import { Order } from "../models/order.model.js";
import { DecisionLog } from "../models/decisionlog.model.js";
import { asyncHandler } from "../util/asyncHandler.js";
import { ApiError } from "../util/apiError.js";
import { ApiResponse } from "../util/apiResponse.js";
import { data } from "../datas/data.js";
import { scoreOrder } from "../Gemini.js";
import { getUserRisk } from "../util/userrisk.js"; 
import { getLocationRisk } from "../util/locationrisk.js";
import { getOrderRisk } from "../util/valuerisk.js";
import { generateVerificationMessageAI } from "../util/msggenerator.js";

const createOrder = asyncHandler(async (req, res) => {
    const { email, customerName, paymentType, orderValue, address, pincode } = req.body;
    if (!email || !paymentType || !orderValue || !address || !customerName || !pincode) {
        throw new ApiError("Missing required fields", 400);
    }
    const matchedCity = data.find((item) => item.Pincode === pincode);
    if (!matchedCity) {
        throw new ApiError("Invalid pincode", 401);
    }
    const items = req.body.items || [];
    const order = await Order.create({
        email,
        customerName,
        paymentType,
        orderValue,
        items,
        address,
        city: matchedCity.City,
        pincode
    });
    const createdOrder = await Order.findById(order._id);
    if (!createdOrder) {
        throw new ApiError("Failed to create order", 500);
    }
    return res.status(201).json(new ApiResponse(201, "Order created successfully", order));


});
const getOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new ApiError("Order ID is required", 400);
    }
    const order = await Order.findById(id);

    if (!order) {
        throw new ApiError("Order not found", 404);
    }
    return res.status(200).json(new ApiResponse(200, "Order found successfully", order));
});
const upateOrderStatus =asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!id || !status) {
        throw new ApiError("Order ID and status are required", 400);
    }
    if (!["CANCELLED", "DELIVERED", "FAILED"].includes(status)) {
        throw new ApiError("Invalid status", 400);
    }
    const order = await Order.findById(id);
    if (!order) {
        throw new ApiError("Order not found", 404);
    }
    order.status = status;
    await order.save();
    return res.status(200).json(new ApiResponse(200, "Order status updated successfully", order));
});
const evaluateOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new ApiError("Order ID is required", 400);
    }
    const order = await Order.findById(id);
    if (!order) {
        throw new ApiError("Order not found", 404);
    }
    if(!(order.status === "PENDING"))
    {
        throw new ApiError("Only pending orders can be evaluated", 400);
    }
    const {userRisk, fraudRate, codRtoRate, prepaidRtoRate} = await getUserRisk(order.email);
    const locationRisk = getLocationRisk(order.city);
    const orderRisk = getOrderRisk(order);
    const addressRisk=await scoreOrder(order.address);
    const normalizedUserRisk = userRisk / 2;
    const normalizedLocationRisk = locationRisk / 3;
    const normalizedOrderRisk = orderRisk / 4;
    const normalizedAddressRisk = addressRisk / 3;
    const finalRiskScore =0.3 * normalizedUserRisk + 0.2 * normalizedLocationRisk + 0.35 * normalizedOrderRisk + 0.15 * normalizedAddressRisk;
    
    if(finalRiskScore > 0.65)
    {
        order.status = "CANCELLED_RISK";
    }
    else if(finalRiskScore > 0.4)
    {
        order.status = "VERIFY_PENDING";

    } else {
        order.status = "SHIPPED";
    }
    await order.save();
    let UserRiskStatus = []
    if(userRisk >=0.6)
    {
  if(fraudRate > 0.5)
  {
    UserRiskStatus.push("HIGH_FRAUD");
  }
  else if(fraudRate > 0.25)  {
    UserRiskStatus.push("MEDIUM_FRAUD");
  }
  if(codRtoRate > 0.5)
  {
    UserRiskStatus.push("HIGH_RTO");
  }
  else if(codRtoRate > 0.25)
  {
    UserRiskStatus.push("MEDIUM_RTO");
  }
  if(prepaidRtoRate > 0.5)
  {
    UserRiskStatus.push("HIGH_PREPAID_RTO");
  }
  else if(prepaidRtoRate > 0.25)
  {
    UserRiskStatus.push("MEDIUM_PREPAID_RTO");
  }
}
  if(addressRisk >=2)
  {
    UserRiskStatus.push("LOW_QUALITY_ADRESS")
  }
  if(orderRisk === 4)
  {
    UserRiskStatus.push("HIGH VALUE COD")
  }
  else if(orderRisk ===3 )
  {
    UserRiskStatus.push("MEDIUM VALUE COD")
  }
  if(locationRisk  === 3)
  {
    UserRiskStatus.push("REMOTE LOCATION")
    
  }
  else if(locationRisk ===2)
  {
    UserRiskStatus.push("SEMI URBAN LOCATION")
  }
  

    if(order.status === "CANCELLED_RISK" || order.status === "VERIFY_PENDING")
    {
        await DecisionLog.create({
            orderId : order._id,
            riskScore : finalRiskScore,
            finalDecision : order.status,
            reason : UserRiskStatus
    })

    }
    
    




    return res.status(200).json(new ApiResponse(200, "Order status evaluated successfully", order));
})
const verifymsggenerator = asyncHandler(async (req,res) =>{
    const {id : orderId }=req.params;
   const actions = {
    askOrderConfirmation: false,
    askAddressConfirmation: false,
    pushPrepaid: false,
  };

    const decision=await DecisionLog.findOne({orderId}).populate("orderId");
    if(!decision)
        throw new ApiError("Decision Log not found",404);
    if(decision.finalDecision !== "VERIFY_PENDING")
        throw new ApiError("Order must be Verification Pending",400)
    let toneScore = 0;
    const UserRiskStatus=decision.reason;
  if (UserRiskStatus.includes("HIGH_FRAUD")) {
    actions.pushPrepaid = true;
    toneScore =2;
  }

  if (UserRiskStatus.includes("HIGH VALUE COD")) {
    actions.pushPrepaid = true;
    toneScore =Math.max(toneScore,0.5); 
  }

  if (
    UserRiskStatus.includes("MEDIUM_FRAUD") ||
    UserRiskStatus.includes("HIGH_RTO")
  ) {
    actions.askOrderConfirmation = true;
     toneScore =Math.max(toneScore,1); 
  }

  
  if (
    UserRiskStatus.includes("MEDIUM_RTO") ||
    UserRiskStatus.includes("HIGH_PREPAID_RTO") ||
    UserRiskStatus.includes("MEDIUM_PREPAID_RTO") ||
    UserRiskStatus.includes("REMOTE LOCATION") ||
    UserRiskStatus.includes("SEMI URBAN LOCATION")
  ) {
    actions.askOrderConfirmation = true;
    toneScore =Math.max(toneScore,0.5); 
  }


  if (UserRiskStatus.includes("LOW_QUALITY_ADRESS")) {
    actions.askAddressConfirmation = true;
     toneScore =Math.max(toneScore,1); 
  }

  const finalActions = [];

  if (actions.pushPrepaid) finalActions.push("prepaid");
  if (actions.askAddressConfirmation) finalActions.push("address");
  if (actions.askOrderConfirmation) finalActions.push("confirm");

  const selectedActions = finalActions.slice(0, 2);

  let tone = "soft";

  if (toneScore >= 2) tone = "firm";
  else if (toneScore >= 1) tone = "normal";
  else tone = "soft";
  const name = decision.customerName;
  const order= await Order.findById(orderId);
  const msg=await generateVerificationMessageAI({name,tone,actions : selectedActions,order});
  return res.status(200).json(new ApiResponse(200,"Msg Generated",msg));




    

})
const checkLog = asyncHandler(async (req,res) =>{
    const { id : orderId }=req.params
        const decision = await DecisionLog
      .findOne({ orderId }).populate("orderId");
      if(!decision)
        throw new ApiError("No DecisionLog for this id", 404);
    return res.status(201).json(new ApiResponse(200,"Decision Log Fetched",decision));



    
})

export { createOrder, getOrder, evaluateOrder,upateOrderStatus,checkLog,verifymsggenerator }