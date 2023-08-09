import axios from 'axios';
import  crypto  from 'crypto';
import http from 'http';
import dotenv from 'dotenv';
import {v4 as uuidv4} from 'uuid';
import { WebSocket, Server  } from 'ws'; 
dotenv.config({path: '.env.local'});

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
}

interface BinanceResponse {
  id: string;
  result: Order[];
}





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



export async function getAllOrders(symbol: string): Promise<Order[]> {
  return new Promise( async (resolve, reject) => {
    const listenKey = await getUserDataStream();
    const wsUserData = new WebSocket(`${wsTestURL}/${listenKey}`);


    if (!testApiSecret) {
      throw new Error('No test API secret provided');
    }
    const requestId = uuidv4();
    wsUserData.on('open', () => {
      const timeStamp = Date.now();
      const queryString = `symbol=${symbol}&timestamp=${timeStamp}`;
      const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");

      const params = {
        symbol: symbol,
        apikey: testApiKey,
        signature: signature,
        timestamp: timeStamp,
      }
      const message = {
        id: requestId,
        method: 'allOrders',
        params: params,
        limit: 500,
      } 
      wsUserData.send(JSON.stringify(message));
    });

    wsUserData.on('message', (message: string) => {
      const data = JSON.parse(message) as BinanceResponse;

      if (data.id === requestId) {
        resolve(data.result);
      }
    });

    wsUserData.on('error', (error) => {
      reject(error);
    });
  });
}

