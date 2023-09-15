import mongoose, { Schema, Document } from 'mongoose';

export interface ISubAccount extends Document {
  name: string;
  type: string; // spot, margin, futures, etc.
  // ... other fields
}

const subAccountSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  // ... other fields
});
const isTestEnv = process.env.NODE_ENV === 'test';
const collectionPrefix = isTestEnv ? 'test_' : 'real_';


export const SubAccountModel = mongoose.model<ISubAccount>(`${collectionPrefix}SubAccount`, subAccountSchema);
