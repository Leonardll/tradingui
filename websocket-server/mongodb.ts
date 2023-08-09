import mongoose, { Schema, model, connect } from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
const MONGODB_URI =process.env.MONGODB_URI




export const connectToMongoDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI;
  
    if (!MONGODB_URI) {
      throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
    }
  
    return mongoose.connect(MONGODB_URI)
      .then(() => {
        console.log('Connected to MongoDB');
      })
      .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
      });
  };





