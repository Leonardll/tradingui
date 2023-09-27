import mongoose, { Schema, model, connect } from "mongoose"
import dotenv from "dotenv"
import { orderSchema, OrderModel } from "./models/binance/Order"
import { TradeModel } from "./models/binance/Trade"
dotenv.config({ path: ".env.test" })

// mongoose.set('debug', true);

export const connectToMongoDB = async (callback?: () => void) => {
    const MONGODB_URI = process.env.MONGODB_URI

    if (!MONGODB_URI) {
        throw new Error("Please define the MONGODB_URI environment variable inside .env.local")
    }

    try {
        await mongoose.connect(MONGODB_URI)
        console.log("Connected to MongoDB")
        // delete faulty fields
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
  
        // Delete all documents from the collection
        // try {
        //     await mongoose.connection.collections['exchanges']!.drop()
        //     console.log('collection dropped');
            
        // } catch   (err) {
        //     console.error('An error occurred:', err);
        //   }



        //Rename the collection
        // const collection = mongoose.connection.db.collection('trades');
        // await collection.rename('real_trades');
        // console.log('Collection renamed to real_trades');

        // async function addExchangeIdToExistingOrders() {
        //     try {
        //       const filter = { exchangeId: { $exists: false } };  // Find orders where exchangeId does not exist
        //       const update = { $set: { exchangeId: "binance" } };  // Set exchangeId to "binance"
          
        //       const result = await OrderModel.updateMany(filter, update);
          
        //       console.log(`Matched ${result.matchedCount} documents and modified ${result.modifiedCount} documents.`);
        //     } catch (error) {
        //       console.log("An error occurred while updating the orders:", error);
        //     }
        //   }
          
        //   // Call the function to perform the update
        //   addExchangeIdToExistingOrders();

        //   async function addExchangeIdToExistingTrades() {
        //     try {
        //       const filter = { exchangeId: { $exists: false } };  // Find orders where exchangeId does not exist
        //       const update = { $set: { exchangeId: "binance" } };  // Set exchangeId to "binance"
          
        //       const result = await TradeModel.updateMany(filter, update);
          
        //       console.log(`Matched ${result.matchedCount} documents and modified ${result.modifiedCount} documents.`);
        //     } catch (error) {
        //       console.log("An error occurred while updating the trades:", error);
        //     }
        //   }
          
        //   // Call the function to perform the update
        //   addExchangeIdToExistingTrades();
          

        // Call the optional callback if provided
        if (callback) {
            callback()
        }
    } catch (error) {
        console.error("Error connecting to MongoDB:", error)
        throw error
    }
}
