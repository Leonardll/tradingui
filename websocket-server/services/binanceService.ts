
import axios from 'axios';
import  crypto  from 'crypto';
import http from 'http';
import dotenv from 'dotenv';
import {v4 as uuidv4} from 'uuid';
import { WebSocket, Server  } from 'ws'; 
import { AllTrades } from '../models/orderModels';
dotenv.config({path: '.env.local'});
import expressWs from 'express-ws'; // Import express-ws

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const binanceTestUrl = process.env.BINANCE_TEST_URL;
const testApiKey = process.env.BINANCE_TEST_API_KEY;
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY;
const wsTestURL = process.env.BINANCE_TEST_WS_URL;


interface Order {
  symbol: string;
  orderId: string;
  origClientOrderId: string;
  action?: string;
  order?: string;
  status?: string;
}

interface BinanceResponse {
  id: string;
  result: Order[];
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
  id?: string; // Add this line
  result?: Order[]; 
}

let isUpdating = false;
let ordersForSymbol: any = {};



export async function getUserDataStream() {
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
    const listenKey = await getUserDataStream();
    const wsServerConnection = new WebSocket(`${wsTestURL}`);
    console.log(wsServerConnection.url)
    console.log("wsServerConnection", wsServerConnection.readyState)
    const requestId = uuidv4();

    wsServerConnection.on('open', () => {
      console.log("websocket connection test open");
      const message = { id: requestId, method: 'ping', params: {} };
      console.log("message", message);
      wsServerConnection.send(JSON.stringify(message));
    });

    wsServerConnection.on('message', (message: string) => {
      console.log('Received connection check message from server:', message);
      try {
        const data = JSON.parse(message) as BinanceConnectionCheck;
        console.log(data)
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
      console.log(`WebSocket connection closed, code: ${code}, reason: ${reason}`);
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



export async function getAllOrdersFromBinance(symbol: string): Promise<Order[]> {
  return new Promise( async (resolve, reject) => {
    
    try {
      const listenKey = await getUserDataStream();
      console.log("listenKey", listenKey)
      console.log(uuidv4())
      const connectionTest = await checkConnection();
      console.log("connectionTest", connectionTest)
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
        console.log("message", message)
        wsUserData.send(JSON.stringify(message));
      });
  
      wsUserData.on('message', (message: string) => {
        const data = JSON.parse(message) as BinanceResponse;
        console.log('Received order status from binance:', data);
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
    const listenKey = await getUserDataStream();
    const wsUserData = new WebSocket(`${wsTestURL}`)
    if (!testApiSecret) {
      throw new Error('No test API secret provided');
    }
    const requestId = uuidv4();
    wsUserData.on('open', () => {
      const timeStamp = Date.now();
      const queryString = `apiKey=${testApiKey}&orderId=${orderId}&symbol=${symbol.toUpperCase()}&timestamp=${timeStamp}`;
      const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");
      console.log(queryString)
     
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
      console.log("message", message)
      wsUserData.send(JSON.stringify(message));
    });

    wsUserData.on('message', (message: string) => {
      const data = JSON.parse(message) as { id: string; result: Order };
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


