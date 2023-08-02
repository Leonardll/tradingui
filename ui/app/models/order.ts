import mongoose, { Document } from 'mongoose';

export interface IFill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  tradeId: number;
}

export interface IOrder extends Document {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  workingTime: number;
  selfTradePreventionMode: string;
  fills: IFill[];
}

const fillSchema = new mongoose.Schema<IFill>({
  price: String,
  qty: String,
  commission: String,
  commissionAsset: String,
  tradeId: Number,
});

const orderSchema = new mongoose.Schema<IOrder>({
  symbol: String,
  orderId: Number,
  orderListId: Number,
  clientOrderId: String,
  transactTime: Number,
  price: String,
  origQty: String,
  executedQty: String,
  cummulativeQuoteQty: String,
  status: String,
  timeInForce: String,
  type: String,
  side: String,
  workingTime: Number,
  selfTradePreventionMode: String,
  fills: [fillSchema],
});

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;

