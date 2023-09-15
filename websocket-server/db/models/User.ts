import mongoose, { Schema, Document } from 'mongoose';

export interface IFavoritePair {
  usdtPairs: string[];
  btcPairs: string[];
  ethPairs: string[];
  solPairs: string[];
  perpetualPairs: string[];
}

export interface IUser extends Document {
  userId: string; // User ID from the authenticator
  favoritePairs: IFavoritePair;
  // other fields...
}

const FavoritePairSchema = new Schema<IFavoritePair>({
  usdtPairs: [String],
  btcPairs: [String],
  ethPairs: [String],
  solPairs: [String],
  perpetualPairs: [String],
});

const UserSchema = new Schema({
  userId: { type: String, required: true },
  favoritePairs: FavoritePairSchema,
  // other fields...
});

const isTestEnv = process.env.NODE_ENV === 'test';
const collectionPrefix = isTestEnv ? 'test_' : 'real_';

export const UserModel = mongoose.model<IUser>(`${collectionPrefix}User`, UserSchema);

