import mongoose, { Schema, model, connect } from 'mongoose';
import dotenv from 'dotenv';
import { orderSchema } from './models/orderModels';
dotenv.config({path: '.env.local'});


// mongoose.set('debug', true);


export const connectToMongoDB = async (callback?: () =>void) => {
    const MONGODB_URI = process.env.MONGODB_URI;
  
    if (!MONGODB_URI) {
      throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
    }
  
    return mongoose.connect(MONGODB_URI)
      .then(() => {
        console.log('Connected to MongoDB');
       callback && callback();
      })
      .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
        throw error;

      });

  };





