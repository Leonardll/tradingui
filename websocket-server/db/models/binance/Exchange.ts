import mongoose, { Schema, Document } from "mongoose";

interface RateLimit {
  rateLimitType: string;
  interval: string;
  intervalNum: number;
  limit: number;
}

interface Filter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
}

export interface Symbol {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Filter[];
  permissions: string[];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}

export interface IExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: RateLimit[];
  exchangeFilters: any[]; // You can define a type for this if needed
  symbols: Symbol[];
  sors: any[]; // You can define a type for this if needed
}

export interface IExchange extends Document {
  userId: string;
  exchangeName: string; // Manually set this when saving to DB
  apiKey: string;
  apiSecret: string;
  subAccounts: string[];
  accountType: string; // spot, margin, futures, etc.
  exchangeInfo: IExchangeInfo; // Not an array anymore
}

const RateLimitSchema = new Schema<RateLimit>({
  rateLimitType: String,
  interval: String,
  intervalNum: Number,
  limit: Number,
});

const FilterSchema = new Schema<Filter>({
  filterType: String,
  minPrice: String,
  maxPrice: String,
  tickSize: String,
  minQty: String,
  maxQty: String,
  stepSize: String,
});

const SymbolSchema = new Schema<Symbol>({
  symbol: String,
  status: String,
  baseAsset: String,
  baseAssetPrecision: Number,
  quoteAsset: String,
  quotePrecision: Number,
  quoteAssetPrecision: Number,
  baseCommissionPrecision: Number,
  quoteCommissionPrecision: Number,
  orderTypes: [String],
  icebergAllowed: Boolean,
  ocoAllowed: Boolean,
  quoteOrderQtyMarketAllowed: Boolean,
  allowTrailingStop: Boolean,
  cancelReplaceAllowed: Boolean,
  isSpotTradingAllowed: Boolean,
  isMarginTradingAllowed: Boolean,
  filters: [FilterSchema],
  permissions: [String],
  defaultSelfTradePreventionMode: String,
  allowedSelfTradePreventionModes: [String],
});

const ExchangeInfoSchema = new Schema<IExchangeInfo>({
  timezone: String,
  serverTime: Number,
  rateLimits: [RateLimitSchema],
  exchangeFilters: [Schema.Types.Mixed], // You can define a type for this if needed
  symbols: [SymbolSchema],
  sors: [Schema.Types.Mixed], // You can define a type for this if needed
});

const ExchangeSchema = new Schema({
  userId: { type: String, required: true },
  exchangeName: { type: String, required: true },
  apiKey: String,
  apiSecret: String,
  subAccounts: [String],
  accountType: String,
  exchangeInfo: ExchangeInfoSchema, // Single ExchangeInfo object
});

export const ExchangeModel = mongoose.model<IExchange>("Exchange", ExchangeSchema);
