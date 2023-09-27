import mongoose, { Schema, Document } from "mongoose"

export interface ITrade extends Document {
    exchangeId: string;
    symbol: string;
    id: number;
    orderId: number;
    orderListId: number;
    price: string;
    qty: string;
    quoteQty: string;
    commission: string;
    commissionAsset: string;
    time: number;
    isBuyer: boolean;
    isMaker: boolean;
    isBestMatch: boolean;
  }

  const TradeSchema = new Schema({
    exchangeId: { type: String, index: true, required: true },
    symbol: { type: String, index: true, required: true },
    id: { type: Number, index: true },
    orderId: { type: Number, index: true },
    orderListId: { type: Number },
    price: String,
    qty: String,
    quoteQty: String,
    commission: String,
    commissionAsset: String,
    time: Number,
    isBuyer: Boolean,
    isMaker: Boolean,
    isBestMatch: Boolean,
  });
  

const isTestEnv = process.env.NODE_ENV === "test"
const collectionPrefix = isTestEnv ? "test_" : "real_"

export const TradeModel = mongoose.model<ITrade>(`${collectionPrefix}Trades`, TradeSchema)
