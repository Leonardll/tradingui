import mongoose, { Schema, Document } from "mongoose";
import { IOrder, orderSchema } from "./Order";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export interface IOCOOrder extends Document {
  exchangeId: string;
  orderListId: number;
  contingencyType: string;
  listStatusType: string;
  listOrderStatus: string;
  listClientOrderId: string;
  transactionTime: number;
  symbol: string;
  orders: Array<{
    symbol: string;
    orderId: number;
    clientOrderId: string;
  }>;
  orderReports: Array<IOrder>; // Reuse your existing IOrder interface here
}

const ocoOrderSchema = new Schema({
  exchangeId: { type: String, index: true },
  orderListId: Number,
  contingencyType: String,
  listStatusType: String,
  listOrderStatus: String,
  listClientOrderId: String,
  transactionTime: Number,
  symbol: { type: String, index: true },
  orders: [
    {
      symbol: String,
      orderId: Number,
      clientOrderId: String,
    },
  ],
  orderReports: [new Schema(orderSchema.obj)], // Wrap the reused schema with new Schema()
});

ocoOrderSchema.index({ exchangeId: 1, orderListId: 1, symbol: 1 });

const isTestEnv = process.env.NODE_ENV === "test";
console.log("isTestEnv from oco model", isTestEnv);

const collectionPrefix = isTestEnv ? "test_" : "real_";
console.log("collectionPrefix from oco model", collectionPrefix);

export const OCOOrderModel = mongoose.model<IOCOOrder>(
  `${collectionPrefix}OCOOrders`,
  ocoOrderSchema
);
