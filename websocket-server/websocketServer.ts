import { Request } from 'express';
import {Server, WebSocket } from 'ws';
import http, { get, request } from 'http';
import {  getDataStreamListenKey, cancelOrder, /* getOrderStatusFromBinance */ } from './services/binanceService';
import { eventEmitter } from './events/eventEmitter';
import { v4 as uuidv4 } from 'uuid';
import { AllTrades} from './models/orderModels';
import { sleep, setupWebSocket, WebsocketManager , HandleApiErrors, BinanceStreamManager} from './utils/utils';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
import url from 'url';
import { set } from 'mongoose';
import crypto from 'crypto';
import { ParamsType } from './utils/utils';
import { generateRandomId } from './utils/utils';
let isUpdating = false;
const wsTestURL = process.env.BINANCE_TEST_WEBSOCKET_API_URL;
const streamUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL;
const  testApiKey = process.env.BINANCE_TEST_API_KEY;
const  testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY;
let exchangeInfo: ExchangeInfoData | null = null;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;


let ordersForSymbol: any = {};



interface Order {
  symbol: string;
  orderId: string;
  origClientOrderId: string;
  action?: string;
  order?: string;
  status?: string;
}

interface Data {
  e: string;
  x: string;
  i: string;
  l: string;
  s: string;
  id?: string; // Add this line
  result?: Order[];
}

interface RateLimit {
  rateLimitType: string;
  interval: string;
  intervalNum: number;
  limit: number;
}

interface ExchangeInfoData {
  id: string;
  status: number;
  method: string;
  result: {
    timezone: string;
    serverTime: number;
    rateLimits: RateLimit[];
    exchangeFilters: any[]; // replace 'any' with the actual type if you know it
    symbols: SymbolInfo[];
  };
  rateLimits: RateLimit[];
}

interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Filter[];
  permissions: string[];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}

interface Filter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
}

interface BinanceResponse {
  id: string;
  result: Order[];
}

interface ExecutionReportData {
  e: string;
  E: number;
  s: string;
  c: string;
  S: string;
  o: string;
  f: string;
  q: string;
  p: string;
  P: string;
  F: string;
  g: number;
  C: string;
  x: string;
  X: string;
  r: string;
  i: number;
  l: string;
  z: string;
  L: string;
  n: string;
  N: string;
  T: number;
  t: number;
  I: number;
  w: boolean;
  m: boolean;
  M: boolean;
  O: number;
  Z: string;
  Y: string;
  Q: string;
  W: string;
  V: string;
}
type ClientTradeData = {
  symbol: string;
  orderId: string;
};

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

interface BinanceWebSocketError {
  code?: number;
  msg?: string;
}



async function updateOrderInDatabase(orderData: ExecutionReportData) {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const updatedOrder = await AllTrades.findOneAndUpdate(
        { orderId: orderData.i },
        { status: 'FILLED' },
        { new: true, maxTimeMS: 2000 }
      );

      if (!updatedOrder) {
        throw new Error(`Order not found in database: ${orderData.i}`);
      }

      console.log(`Successfully updated order: ${orderData.i}`);
      return;
    } catch (error: any) {
      if (error.name === 'MongoTimeoutError') {
        console.log(`Timeout error, retrying... (${retries + 1}/${MAX_RETRIES})`);
        await sleep(RETRY_DELAY);
        retries++;
      } else {
        console.error(`Failed to update order: ${orderData.i}. Error: ${error.message}`);
        return;
      }
    }
  }

  console.error(`Max retries reached. Could not update order: ${orderData.i}`);
}




async function getAllOrdersFromMongo() {
    return await AllTrades.find({status: "NEW"}).lean().maxTimeMS(2000);
}

async function fetchAllOrdersFromMongo() {
  try {
    const orders = await  getAllOrdersFromMongo();
    return orders;
  } catch (error:any) {
    if (error.name === 'MongoTimeoutError') {
      console.error('MongoDB operation timed out. Retrying...');
      // Implement retry logic here

    } else {
    console.error(`Error finding order  with status new:`, error);
    }
  }

}



// fetchAllOrdersFromMongo()
// .then((orders) => {
//   orders && orders.map((dbOrder) => {
//     let orderStatus = dbOrder.status
//     if (orderStatus === 'NEW') {

//       getOrderStatusFromBinance(dbOrder.symbol, Number(dbOrder.orderId))
//       .then( async (apiOrder) => {

//         if (!apiOrder) {
//           console.log('apiOrder is null or undefined')
//           return;
//         }
//         if (apiOrder.status === 'FILLED') {
//           await AllTrades.findOneAndUpdate({orderid: apiOrder.orderId}, {status: 'FILLED'}, {new: true});
//         } else if (apiOrder.status === 'CANCELED') {
//           await AllTrades.findOneAndUpdate({orderid: apiOrder.orderId}, {status: 'CANCELED'}, {new: true});
//         } else if (apiOrder.status === 'NEW') {
//           console.log('order status is still new', apiOrder.orderId);
//         }
//       })
//       .catch((error) => {
//         console.error(`Error comparing order status ${dbOrder.orderId} from Binance API and DB:`, error);
//       });
//     }
//   });
// }).catch((error) => {
//   if (error.name === 'MongoTimeoutError') {
//     console.error('MongoDB operation timed out. Retrying...');
//     // Implement retry logic here
//   } else {
//   console.error(`Error finding order  with status new:`, error);
//   }
// });














// websocketServer.ts

export async function setupWebSocketServer(server: http.Server, ) {
  const wss = new Server({ server });
  console.log('WebSocket server created');
  if (!testApiSecret) {
    throw new Error('No test API secret provided');

  }
  const requestId = generateRandomId();
  const listenkey  = await getDataStreamListenKey()
 

  
  console.log('WebSocket connection to exchange opened');
  wss.on('connection', async (wsClient: WebSocket, req) => {
    // Log the request URL
    console.log('Request URL:', req.url);
  
    // Check if the request URL is '/exchangeInfo'
    if (req.url === '/exchangeInfo') {
      console.log('Inside exchangeInfo condition');
    
      // Instantiate WebsocketManager
      const wsExchangeInfoManager = new WebsocketManager(`${wsTestURL}`, requestId, 'exchangeInfo', {});
      wsExchangeInfoManager.on('open', () => {
        console.log('Connection to exchange info opened');
      });
      
      // Setup WebSocket connection to the exchange info
      wsExchangeInfoManager.on('message', async (data: string | Buffer) => {
        console.log('Received message from exchange:', data);
        // You can forward this data to the client if needed

        if (wsClient.readyState === WebSocket.OPEN) {
          console.log('wsClient is open. Sending data.', data);


          if (typeof data === 'object') {
            wsClient.send(JSON.stringify(data));
          }else {
            
            wsClient.send(JSON.stringify(data))
          }
          // Forward this data to the client
        } else {
          console.log('wsClient is not open. Cannot send data.');
        }
      });
    
      wsExchangeInfoManager.on('error', (event) => {
        console.error('Websocket error:', JSON.stringify(event));
      });
    
      wsExchangeInfoManager.on('close', (code, reason) => {
        console.log(`WebSocket connection to exchange info closed, code: ${code}, reason: ${reason}`);
      });
    
      // Test message to confirm data sending
     // wsClient.send('Test exchangeInfo message');
    } else if (req.url === '/userData') {
      if (!testApiKey && !testApiSecret) {
        throw new Error('No test API key provided');
      }
    }
    else if (req.url?.startsWith('/orderStatus')) {
      console.log('Inside orderStatus condition');
      if (!testApiKey && !testApiSecret) {
        throw new Error('No test API key provided');
      }
      const parsedUrl =  new URL(req.url, `http://${req.headers.host}` ); // Parse the URL and the query parameters

      const symbol = parsedUrl.searchParams.get('symbol');
      const orderId = parsedUrl.searchParams.get('orderId');
    
      const timestamp = Date.now();
      
      if (!symbol && !orderId) {
        throw new Error('No symbol or orderId provided');
       } else {

         const queryString = `apiKey=${testApiKey}&orderId=${orderId}&symbol=${symbol}&timestamp=${timestamp}`;
         const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");
         const params: ParamsType = {
           symbol: symbol!.toUpperCase() ,
           orderId: Number(orderId),
           apiKey: testApiKey,
           signature: signature,
           timestamp: timestamp
         };
         
         const wsOrderStatusManager = new WebsocketManager(`${wsTestURL}`, requestId, 'order.status', params);
         wsOrderStatusManager.on('open', () => {
           console.log('Connection to order status opened')
            
         })
         wsOrderStatusManager.on('message', async (data: string | Buffer) => {
           console.log('Received order status message from exchange:', data);
           // You can forward this data to the client if needed
   
           if (wsClient.readyState === WebSocket.OPEN) {
             console.log('wsClient is open. Sending data.', data);
   
   
             if (typeof data === 'object') {
               wsClient.send(JSON.stringify(data));
             }else {
               
               wsClient.send(JSON.stringify(data))
             }
             // Forward this data to the client
           } else {
             console.log('wsClient is not open. Cannot send data.');
           }
         });
         wsOrderStatusManager.on('error', (event) => {
           console.error('Order Status Websocket error:', JSON.stringify(event));
         });
         wsOrderStatusManager.on('close', (code, reason) => {
           console.log(`WebSocket connection to order status closed, code: ${code}, reason: ${reason}`);
         })
       } 
    
    }
    else if (req.url?.startsWith('/allOrders')) {
      console.log('Inside orderStatus condition');
      if (!testApiKey && !testApiSecret) {
        throw new Error('No test API key provided');
      }
      const parsedUrl =  new URL(req.url, `http://${req.headers.host}` ); // Parse the URL and the query parameters

      const symbol = parsedUrl.searchParams.get('symbol');
    
      const timestamp = Date.now();
      
      if (!symbol) {
        throw new Error('No symbol or orderId provided');
       } else {

         const queryString = `apiKey=${testApiKey}&symbol=${symbol}&timestamp=${timestamp}`;
         const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");
         const params: ParamsType = {
           symbol: symbol!.toUpperCase() ,
           apiKey: testApiKey,
           signature: signature,
           timestamp: timestamp
         };
         
         const wsAllOrder4SymbolManager = new WebsocketManager(`${wsTestURL}`, requestId, 'allOrders', params);
         wsAllOrder4SymbolManager.on('open', () => {
           console.log('Connection to order status opened')
            
         })
         wsAllOrder4SymbolManager.on('message', async (data: string | Buffer) => {
           console.log('Received order status message from exchange:', data);
           // You can forward this data to the client if needed
   
           if (wsClient.readyState === WebSocket.OPEN) {
             console.log('wsClient is open. Sending data.', data);
   
   
             if (typeof data === 'object') {
               wsClient.send(JSON.stringify(data));
             }else {
               
               wsClient.send(JSON.stringify(data))
             }
             // Forward this data to the client
           } else {
             console.log('wsClient is not open. Cannot send data.');
           }
         });
         wsAllOrder4SymbolManager.on('error', (event) => {
           console.error('Order Status Websocket error:', JSON.stringify(event));
         });
         wsAllOrder4SymbolManager.on('close', (code, reason) => {
           console.log(`WebSocket connection to order status closed, code: ${code}, reason: ${reason}`);
         })
       } 

    } else if (req.url?.startsWith('/priceFeed')) {
      console.log('Inside priceFeed condition');
    
      // Parse the URL to get the symbol for which the price feed is requested
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const symbol = parsedUrl.searchParams.get('symbol')?.toUpperCase();
      const timeframes = parsedUrl.searchParams.get('timeframes')?.split(',') || ['1s']; // Default to 1s if not provided

      let streamID = 1
      if (!symbol) {
        console.log('No symbol provided for price feed');
        wsClient.send('No symbol provided for price feed');
        return;
      }
    
    
      timeframes.forEach((timeframe) => {
        const wsPriceFeed = `${streamUrl}/${listenkey}/${symbol.toLowerCase()}@kline_${timeframe}`;
        const binanceStreamManager = new BinanceStreamManager(wsPriceFeed);
    
        binanceStreamManager.addListener(`${symbol}`, (data: PriceFeedMessage) => {
          console.log(`Received price feed data for ${timeframe}:`, data);
    
          if (wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify(data));
          } else {
            console.log('wsClient is not open. Cannot send price feed data.');
          }
        });
    
        // Handle errors
        binanceStreamManager.on('error', (error) => {
          console.error('An error occurred:', error);
        });
      
        // Handle close events
        binanceStreamManager.addListener('close', (code:number, reason:string) => {
          console.log(`WebSocket connection to price feed closed, code: ${code}, reason: ${reason}`);
        });
        // Subscribe to the kline stream for the given symbol and timeframe
        binanceStreamManager.subscribeToStream('kline', [`${symbol.toLowerCase()}@kline_${timeframe}`], streamID);
        streamID++;
      });
    
      
    }
    
  
    wsClient.addListener('message',  async function incoming(message) {
      wsClient.send(message);
    });
  
    wsClient.on('close', function close() {
      console.log('Client disconnected');
    });
  
    wsClient.on('error', function error(err) {
      console.log('WebSocket error:', err.message);
    });
  });
  



};




