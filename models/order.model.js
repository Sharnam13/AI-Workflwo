import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true   
    },

    customerName: {
      type: String,
      lowercase: true,
      required :true

    },
    paymentType: {
      type: String,
      enum: ["COD", "PREPAID"],
      required: true
    },

    orderValue: {
      type: Number,
      required: true
    },

    items: [
      {
        type: String
      }
    ],

    address: {
      type: String,
      required: true
    },
    city : {
      type: String,
    },
    pincode :{
      type: String,
      required :true
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "SHIPPED",
        "VERIFY_PENDING",
        "CANCELLED_RISK",
        "CANCELLED",
        "DELIVERED",
        "FAILED",
        "RTO"
      ],
      default: "PENDING"
    }
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);




























