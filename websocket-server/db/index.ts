import mongoose, { Schema, model, connect } from "mongoose"
import dotenv from "dotenv"
import { orderSchema, OrderModel } from "./models/Order"
dotenv.config({ path: ".env.local" })

// mongoose.set('debug', true);


export const connectToMongoDB = async (callback?: () => void) => {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB");
        // delete faulty 
    //     try {
    //          const result = await OrderModel.deleteMany({
    //   fills: { $size: 0 },
    //   symbol: { $exists: false },
    //   orderId: { $exists: false },
    //   clientOrderId: { $exists: false },
    //   Add more fields that should not exist for a document to be considered "empty"
    // });

        
    //         console.log('Deleted count:', result.deletedCount);
    //       } catch (err) {
    //         console.error('An error occurred:', err);
    //       }
    //       mongoose.connection.close();

        // Rename the collection
        // const collection = mongoose.connection.db.collection('orders');
        // await collection.rename('test_orders');
        // console.log('Collection renamed to test_orders');

        // Call the optional callback if provided
        if (callback) {
            callback();
        }
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
};
