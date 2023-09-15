
import mongoose,{ Schema, Document } from 'mongoose';

export interface ITrade extends Document {
  symbol: string;
  tradeId: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}


const TradeSchema = new Schema({
    symbol: { type: String, index: true },
    tradeId: { type: Number, index: true },
    price: String,
    qty: String,
    time: Number,
    isBuyerMaker: Boolean,
    isBestMatch: Boolean,
  });
  
  const isTestEnv = process.env.NODE_ENV === 'test';
  const collectionPrefix = isTestEnv ? 'test_' : 'real_';

  export const TradeModel = mongoose.model<ITrade>(`${collectionPrefix}Trades`, TradeSchema);
