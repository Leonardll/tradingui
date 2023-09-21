import mongoose, { Schema, Document } from "mongoose"

const CoinDetailSchema = new Schema({
    symbol: { type: String, index: true }, // e.g., BTC, ETH
    name: String, // e.g., Bitcoin, Ethereum
    imageUrl: String, // URL to the coin's image
    currentPrice: Number, // Current price in USD or any other standard currency
    marketCap: Number, // Market capitalization
    volume24h: Number, // 24-hour trading volume
    // ... any other fields you find relevant
})

CoinDetailSchema.index({ symbol: 1 })
const isTestEnv = process.env.NODE_ENV === "test"
const collectionPrefix = isTestEnv ? "test_" : "real_"

export const CoinDetailModel = mongoose.model(`${collectionPrefix}CoinDetails`, CoinDetailSchema)
