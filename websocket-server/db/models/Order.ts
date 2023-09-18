import mongoose, { Schema, Document } from "mongoose"

export interface IFill {
    price: string
    qty: string
    commission: string
    commissionAsset: string
    tradeId: number
}

export interface IOrder extends Document {
    symbol: string
    orderId: number
    orderListId: number
    clientOrderId: string
    transactTime: number
    price: string
    origQty: string
    executedQty: string
    cummulativeQuoteQty: string
    status: string
    timeInForce: string
    type: string
    side: string
    workingTime: number
    selfTradePreventionMode: string
    fills: IFill[]
}

const fillSchema = new Schema<IFill>({
    price: String,
    qty: String,
    commission: String,
    commissionAsset: String,
    tradeId: Number,
})

export const orderSchema = new Schema({
    symbol: { type: String, index: true },
    orderId: { type: Number, index: true },
    orderListId: Number,
    clientOrderId: String,
    transactTime: Number,
    price: String,
    origQty: String,
    executedQty: String,
    cummulativeQuoteQty: String,
    status: { type: String, index: true },
    timeInForce: String,
    type: { type: String, index: true },
    side: { type: String, index: true },
    workingTime: Number,
    selfTradePreventionMode: String,
    fills: [fillSchema],
})
orderSchema.index({ orderId: 1, symbol: 1, status: 1 })

const isTestEnv = process.env.NODE_ENV === "test"
const collectionPrefix = isTestEnv ? "test_" : "real_"

export const OrderModel = mongoose.model<IOrder>(`${collectionPrefix}Orders`, orderSchema)
