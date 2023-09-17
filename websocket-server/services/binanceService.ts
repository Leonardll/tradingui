import { OrderModel } from './../db/models/Order';
import axios from 'axios';
import  crypto  from 'crypto';
import http from 'http';
import dotenv from 'dotenv';
import {v4 as uuidv4} from 'uuid';
import { WebSocket, Server  } from 'ws'; 
import{ setupWebSocket, WebsocketManager, RateLimitManager }from '../utils/utils';
dotenv.config({path: '.env.local'});
import { set } from 'mongoose';
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const binanceTestUrl = process.env.BINANCE_TEST_URL;
const testApiKey = process.env.BINANCE_TEST_API_KEY;
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY;
const wsTestURL = process.env.BINANCE_TEST_WEBSOCKET_API_URL;
const streamUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL;


interface Order {
  symbol: string;
  orderId: string;
  origClientOrderId: string;
  newOrderRespType?: string;
  action?: string;
  order?: string;
  status?: string;
}
interface OrderStatusResponse {
  result: [
    symbol: string,
    orderId: number,
    

  ];
  rateLimits: object[]
}

interface BinanceResponse {
  id: string;
  result:[] ;
}

interface BinanceConnectionCheck {
  id: string;
  status: number;
  result: object[];
  rateLimits: object[];
};
interface Data {
  e: string;
  x: string;
  i: string;
  l: string;
  s: string;
  o: string;
  id?: string; // Add this line
  result?: Order[]; 
}

interface PriceFeedMessage {

  e: string;
  E: number;
  s: string;
  p: string;
  P: string;
  w: string;
  x: string;
  c: string;
  Q: string;
  b: string;
  B: string;
  a: string;
  A: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
  O: number;
  C: number;
  F: number;
  L: number;
  n: number;

}
interface BinanceErrorType {
  code: number;
  msg: string;
}


let isUpdating = false;
let ordersForSymbol: any = {};
if (!wsTestURL) {
  throw new Error('No test WebSocket URL provided');
}
const rateLimitManager = new RateLimitManager();


let reconnectAttempts = 0;
let reconnectInterval = 1000; // 1 second
let maxReconnectInterval = 30000; // 30 seconds

interface ExecutionReportData {
  e: string;  // Event type
  E: number;  // Event time
  s: string;  // Symbol
  c: string;  // Client order ID
  o: string;  // Order ID
  S: string;  // Side
  f: string;  // Time in force
  q: string;  // Order quantity
  p: string;  // Order price
  P: string;  // Stop price
  F: string;  // Iceberg quantity
  g: number;  // OrderListId
  C: string;  // Original client order ID; This is the ID of the order being canceled
  x: string;  // Current execution type
  X: string;  // Current order status
  r: string;  // Order reject reason; will be an error code.
  i: number;  // Order ID
  l: string;  // Last executed quantity
  z: string;  // Cumulative filled quantity
  L: string;  // Last executed price
  n: string;  // Commission amount
  N: string;  // Commission asset
  T: number;  // Transaction time
  t: number;  // Trade ID
  I: number;  // Ignore
  w: boolean; // Is the order on the book?
  m: boolean; // Is this trade the maker side?
  M: boolean; // Ignore
  O: number;  // Order creation time
  Z: string;  // Cumulative quote asset transacted quantity
  V: string;  // selfTradePreventionMode
  // ... other fields
}

export async function getDataStreamListenKey() {


  const { data } = await axios.post(`${binanceTestUrl}/userDataStream`, null, { headers: { 'X-MBX-APIKEY': testApiKey } });
  return data.listenKey;
}

export async function cancelOrder(order : Order) {
  // Construct the URL and query parameters for the Binance API
  console.log('Canceling order:', order);
  const url = `${binanceTestUrl}/order`;
  
  const params = {
    symbol: order.symbol,
    orderId: order.orderId,
    origClientOrderId: order.origClientOrderId,
    timestamp: Date.now().toString(), // Convert timestamp to string
  };

  // Create the signature
  const queryString = new URLSearchParams(params).toString();
  console.log("queryString", queryString)
  if (!testApiSecret) {
    throw new Error("API secret is not defined!");
  }
  
  const signature = crypto.createHmac('sha256', testApiSecret).update(queryString).digest('hex');
  console.log("signature", signature)

  const fullUrl = `${url}?${queryString}&signature=${signature}`;
  console.log('Full URL:', fullUrl);
  // Make the DELETE request to the Binance API
  try {
    const response = await axios.delete(`${url}?${queryString}&signature=${signature}`, { headers: { 'X-MBX-APIKEY': testApiKey } });
    console.log('Response from Binance API:', response.data);
    // Return the response data
    return response.data;
  } catch (error:any) {
    console.error('Error deleting order:', error);
    return { error: error.message };
  }
}
export async function checkConnection(): Promise<BinanceConnectionCheck> {
return new Promise(async (resolve, reject) => {
const wsServerConnection = new WebSocket(`${wsTestURL}`);
    console.log("wsServerConnection", wsServerConnection.readyState)
    const requestId = uuidv4();

wsServerConnection.on('open', () => {
console.log("websocket connection test open");
const message = { id: requestId, method: 'ping', params: {} };
wsServerConnection.send(JSON.stringify(message));
});

    wsServerConnection.on('message', (message: string) => {
      try {
        const data = JSON.parse(message) as BinanceConnectionCheck;
if (data.status === 200) {
wsServerConnection.close(); // Close if you don't need the connection anymore
          resolve(data);
}
      } catch (error) {
console.log('Error parsing connection check:', error);
reject(error);
      }
    });

    wsServerConnection.on('close', (code, reason) => {
      console.log(`WebSocket connection test closed, code: ${code}, reason: ${reason}`);
    });

    wsServerConnection.on('error', (error) => {
      console.error('WebSocket connection test  error:', error);
      reject(error);
    });

    // Timeout to reject the promise if no response is received within 10 seconds
setTimeout(() => {
wsServerConnection.close(); // Close the WebSocket connection
      reject(new Error('Request timed out'));
}, 10000);
});
}

async function updateOrdersForSymbol(symbol: string, newOrders: Order[]) {
  try {
    while (isUpdating) {
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    isUpdating = true;
    console.log(`Updating orders for ${symbol}:`, newOrders);

    // Update the orders
    ordersForSymbol[symbol] = newOrders;
    console.log(`Updated orders for ${symbol}:`, ordersForSymbol[symbol]);


    isUpdating = false;
  } catch (error) {
    console.error('Error updating orders for symbol:', error);
  }
}

export async function handleUserDataMessage(
  wsClient: WebSocket,
  symbol: string,
  message: string,
) {
   const data = JSON.parse(message) as Data
        console.log('Received message from user data stream:', data);
        if (data.e === 'executionReport' && data.x === 'TRADE' && data.s === symbol) {
          // This is an update about an order being filled
          const symbol = data.s;
          const orderId = data.i;
          try {

            console.log("attempt update trade status")
            const result =  await OrderModel.updateOne({ symbol, orderId }, { status: "FILLED" });
            console.log("Update result", result)
          } catch (error) {
             console.error('Error updating order status:', error);
          }
          console.log(`Order ${data.i} was filled. Executed quantity: ${data.l}`);
          wsClient.send(JSON.stringify({ orderFilled: true, orderId: orderId }));
          
          
           if (!ordersForSymbol[symbol]) {
            ordersForSymbol[symbol] = [];
          }
          ordersForSymbol[symbol].push(data);
          console.log(`Updated orders for symbol ${symbol}:`, ordersForSymbol[symbol]);  // Log the updated orders
          symbol && await updateOrdersForSymbol(symbol, [...ordersForSymbol[symbol] || [], data]);

        } else if (data.id && data.result) {
          const updatedOrder = data.result[0] as Order;
          console.log('Order updated:', updatedOrder);
          // await updateOrderInDatabase(updatedOrder); // Assume this function updates the order
          // console.log('Order updated:', updatedOrder);
          // Update the orders
         symbol && await updateOrdersForSymbol(symbol, data.result);
        }
}

export async function updateOrderInDatabase(orderData: ExecutionReportData, orderStatus:string) {
  // console.log('Updating order in database:', orderData.i)

  try {
  

     const count =  OrderModel.countDocuments({});
      console.log(`Total orders: ${count}`);
    }
  
  catch (error) {
    console.error('Error running test query:', error);
  }

  try {
    switch (orderStatus) {
      case 'NEW':
        // Handle the new order status
        // updateOrderInDatabase(orderData);
        break;
      case 'PARTIALLY_FILLED':
        // Handle the partially filled order status
        // updateOrderInDatabase(orderData);
        break;
      case 'FILLED':
        const updateFilledOrder = await OrderModel.findOneAndUpdate(
          { orderId: orderData.i }, // find a document with this orderId
          {
            status: 'FILLED',
            // ... any other fields you want to update
          },
          { new: true, 
            maxTimeMS: 2000,
          } // return the new updated document
        );

        console.log('updatedOrder:', updateFilledOrder);
        if (updateFilledOrder) {
          console.log('Successfully updated order in database:', updateFilledOrder);
        } else {
          console.log('Order not found in database:', orderData.i);
        } 
        break;
      case 'CANCELED':
        // Handle the canceled order status
        const updateCanceledOrder = await OrderModel.findOneAndUpdate(
          {orderId: orderData.i},
          { status: 'CANCELED' },
          { new: true,
            maxTimeMS: 2000,
          }
          );
          console.log('updatedOrder:', updateCanceledOrder);
          if (updateCanceledOrder) {
            console.log('Successfully updated cancelled order in database:', updateCanceledOrder);
          } else {
            console.log('Order not found in database:', orderData.i);
          }
        break;
      case 'REJECTED':
        // Handle the rejected order status
        console.log('Order rejected:', orderData.i);
        break;
      case 'EXPIRED':
        // Handle the expired order status
        const updateExpiredOrder = await OrderModel.findOneAndUpdate(
          { orderId: orderData.i }, 
          { status: 'EXPIRED' }, {
             new: true, 
             maxTimeMS: 2000
          })
        console.log('updatedOrder:', updateExpiredOrder);
        if (updateExpiredOrder) {
          console.log('Successfully updated expired order in database:', updateExpiredOrder);
        } else {
          console.log('Order not found in database:', orderData.i);
        }
        break;
      
      default:
        console.log('Unknown order status:', status);
        
    }

  } catch (error) {
    console.error('Error updating order in database:', error);
  }
}
