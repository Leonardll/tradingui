import mongoose, { Schema, Document } from 'mongoose';

export interface IExchangeInfo {
  tradingPairs: string[];
  rateLimits: number;
  // Add other fields as needed
}

export interface IExchange extends Document {
  userId: string;
  exchangeName: string;
  apiKey: string;
  apiSecret: string;
  subAccounts: string[];
  accountType: string; // spot, margin, futures, etc.
  exchangeInfo: IExchangeInfo[];
}

const ExchangeInfoSchema = new Schema<IExchangeInfo>({
  tradingPairs: [String],
  rateLimits: Number,
  // Define other fields as needed
});

const ExchangeSchema = new Schema({
  userId: { type: String, required: true },
  exchangeName: { type: String, required: true },
  apiKey: String,
  apiSecret: String,
  subAccounts: [String],
  accountType: String,
  exchangeInfo: [ExchangeInfoSchema], // Array of ExchangeInfo objects
});

export const ExchangeModel = mongoose.model<IExchange>('Exchange', ExchangeSchema);
