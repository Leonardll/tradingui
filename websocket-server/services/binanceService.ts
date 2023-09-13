import { orderSchema } from './../models/orderModels';

import axios from 'axios';
import  crypto  from 'crypto';
import http from 'http';
import dotenv from 'dotenv';
import {v4 as uuidv4} from 'uuid';
import { WebSocket, Server  } from 'ws'; 
import{ setupWebSocket, WebsocketManager, RateLimitManager }from '../utils/utils';
import { AllTrades } from '../models/orderModels';
dotenv.config({path: '.env.local'});
import { set } from 'mongoose';
import { generateRandomId } from '../utils/utils';
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
// const binanceWsManager = new WebsocketManager(wsTestURL);
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

export async function openTradeStream(symbol: string, orderId: string): Promise<WebSocket> {
  // Construct the URL for the trade stream for the given symbol
  console.log(symbol, orderId, "log from openTradeStream binanceService.ts");

  const listenKey = await getDataStreamListenKey(); // Assuming this function is asynchronous
  const tradeStreamUrl = `${streamUrl}/${listenKey}/${symbol.toLowerCase()}@trade`;
  
  // Create a WebSocket connection to the trade stream
  const ws = new WebSocket(tradeStreamUrl);

  // Set up event listeners for the WebSocket connection
  ws.on('open', () => {
    console.log(`Connected to the trade stream for ${symbol} with order ID ${orderId}`);
    reconnectAttempts = 0; // Reset reconnection attempts on successful connection
  });

  ws.on('message', (data) => {
    // Parse the incoming data
    const parsedData = JSON.parse(data.toString()) as ExecutionReportData;
    console.log("parsedData", parsedData)
    // Check the event type
    if (parsedData.e === 'executionReport') {
      // Handle the execution report data
      const executionData = parsedData;
      console.log("executionData", executionData)
      //ws.send(JSON.stringify({ executionData: executionData }));
  
      // Check if the execution data matches the specified order ID
      if (executionData.o === orderId) {
        console.log('Received execution report for order ID:', orderId, executionData);
       // ws.send(JSON.stringify({ executionData: executionData }));
        // You can handle the execution report data here, such as updating the database or triggering other actions
      }
    } else if (parsedData.e === 'trade') {
      const tradeData = parsedData;
    //  ws.send(JSON.stringify({ tradeData: tradeData }));
      // console.log("tradeData", tradeData)
  
      // Check if the trade data matches the specified order ID
      if (tradeData.o === orderId) {
        console.log('Received trade data for order ID:', orderId, tradeData);
        // Handle the trade data similarly
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket Error:', error);
  });

  ws.on('close', (code, reason) => {
    console.log(`Connection closed, code=${code}, reason=${reason}`);
    if (reconnectAttempts < 5) { // Limit to 5 reconnection attempts
      reconnectAttempts++;
      const timeout = reconnectAttempts * 2000; // Increasing delay between attempts
      console.log(`Reconnecting in ${timeout}ms...`);
      setTimeout(() => openTradeStream(symbol, orderId), timeout);
    } else {
      console.log('Max reconnection attempts reached. Stopping reconnection.');
    }
  });

  // Return the WebSocket connection so that the caller can interact with it if needed
  return ws;
}


export async function getAllOrdersFromBinance(symbol: string, orderId? : number): Promise<Order[]> {
return new Promise( async (resolve, reject) => {

    try {
const connectionTest = await checkConnection();
const wsUserData = new WebSocket(`${wsTestURL}`);
      if (!testApiSecret) {
throw new Error('No test API secret provided');
}
      const requestId = uuidv4();
wsUserData.on('open', () => {
const timeStamp = Date.now();
const queryString = `apiKey=${testApiKey}&symbol=${symbol.toUpperCase()}&timestamp=${timeStamp}`;
const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");

        const params = {
symbol: symbol.toUpperCase(),
timestamp: timeStamp,
apiKey: testApiKey,
signature: signature,

        }
        const message = {
id: requestId,
method: "allOrders",
params: params,
}
// console.log("message", message)
        wsUserData.send(JSON.stringify(message));
});
  
      wsUserData.on('message', (message: string) => {
        const data = JSON.parse(message) as BinanceResponse;
        console.log(`Received all orders  for ${symbol} from  binance:`, data.result.length);
        if (data.id === requestId) {
resolve(data.result);
}
      });
      wsUserData.onerror = (event) => {
        console.error('WebSocket Error:', event);
      };
      
      wsUserData.onclose = (event) => {
        if (event.wasClean) {
          console.log(`Closed cleanly, code=${event.code}, reason=${event.reason}`);
        } else {
          console.error(`Connection died`); // For example, server process killed or network down
        }
      };
      
  
      wsUserData.on('error', (error) => {
        console.log("error", error)
        reject( new Error ("Websocket connection error"));
      });
    } catch (error) {
      console.error('Error getting orders:', error);
reject(error);
    }
 
  });
} 
export async function getOrderStatusFromBinance(symbol: string, orderId: number): Promise<Order> {
return new Promise(async (resolve, reject) => {
const listenKey = await getDataStreamListenKey();
const wsUserData = new WebSocket(`${wsTestURL}`)
    if (!testApiSecret) {
throw new Error('No test API secret provided');
}
    const requestId =   generateRandomId();
    wsUserData.on('open', () => {
    const timeStamp = Date.now();
    const queryString = `apiKey=${testApiKey}&orderId=${orderId}&symbol=${symbol.toUpperCase()}&timestamp=${timeStamp}`;
    const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");

      const params = {
symbol: symbol.toUpperCase(),
orderId: orderId,
apiKey: testApiKey,
signature: signature,
timestamp: timeStamp,
}
      const message = {
id: requestId,
method: "order.status",
params: params,
}
      wsUserData.send(JSON.stringify(message));
});

    wsUserData.on('message', (message: string) => {
      console.log("message", message)
      const data = JSON.parse(message) as { id: string; result: Order };
    console.log('Received order status from Binance:', data);
    console.log('order status', data.result);
      if (data.id === requestId) {
resolve(data.result);
}
    });

wsUserData.on('error', (error) => {
      reject(error);
});

// Timeout to reject the promise if no response is received within 10 seconds
     setTimeout(() => {
      wsUserData.close(); // Close the WebSocket connection
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
            const result =  await AllTrades.updateOne({ symbol, orderId }, { status: "FILLED" });
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

export async function getPricefeedStreamForSymbol (symbol: string):Promise<WebSocket> {
const listenKey = await getDataStreamListenKey();
console.log(symbol, "log from getPricefeedStreamForSymbol binanceService.ts")
const wsPriceFeed = `${wsTestURL}/${listenKey}/${symbol.toLowerCase()}@kline_1s`;
const binanceWsPriceFeed = new WebSocket(wsPriceFeed) 
  binanceWsPriceFeed.on('open', () => {
console.log(`Connected to Binance for symbol: ${symbol}`);
reconnectAttempts = 0; // Reset reconnection attempts on successful connection

  }); 

  binanceWsPriceFeed.on('message', (message: string) => {
    console.log('Received price feed message from Binance:', message);
})

  binanceWsPriceFeed.on('error', (error) => {
    console.log(`WebSocket Price Feed Error for symbol ${symbol}:`, error);
    });

  return binanceWsPriceFeed 
  
  }



