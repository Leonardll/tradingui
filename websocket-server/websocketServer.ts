import {Server, WebSocket } from 'ws';
import http, { get, request } from 'http';
import {  getDataStreamListenKey, cancelOrder, /* getOrderStatusFromBinance */ } from './services/binanceService';
import { eventEmitter } from './events/eventEmitter';
import { OrderModel } from './db/models/Order';
import { sleep, setupWebSocket, WebsocketManager ,generateDate, HandleApiErrors,generateBinanceSignature, BinanceStreamManager} from './utils/utils';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
import url from 'url';
import { set } from 'mongoose';
import { ParamsType, generateRandomId, OrderController } from './utils/utils';
import { exchangeInfoWebsocket, userDataReportWebsocket, userInfoWebsocket, orderStatusWebsocket,allOrdersWebsocket,priceFeedWebsocket } from './services/binanceWsService/binanceWsService';
import test from 'node:test';



// env variables
const wsTestURL = process.env.BINANCE_TEST_WEBSOCKET_API_URL;
const streamUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL;
const  testApiKey = process.env.BINANCE_TEST_API_KEY;
const  testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY;


// Controller

// variables
let isUpdating = false;
let exchangeInfo: ExchangeInfoData | null = null;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
let ordersForSymbol: any = {};
const recvWindow = 60000;


// types
export type Asset = string;
export type EventTime = number;
export type OrderId = number;
export type ClientOrderId = string;
export type Symbol = string;
export type Balance = number;


// interfaces
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

export interface BalanceUpdateData {
  e: "balanceUpdate";
  E: EventTime;
  a: Asset;
  d: string;
  T: EventTime;
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

export interface ExecutionReportData {
  e: string;
  E:EventTime;
  s: Symbol;
  c: ClientOrderId;
  S: "BUY" | "SELL";
  o: "LIMIT" | "MARKET" | "STOP_LOSS" | "STOP_LOSS_LIMIT" | "TAKE_PROFIT" | "TAKE_PROFIT_LIMIT" | "LIMIT_MAKER";
  f: string;
  q: string;
  p: string;
  P: string;
  F: string;
  g: number;
  C: string;
  x: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "PENDING_CANCEL" | "REJECTED" | "EXPIRED";
  X: string;
  r: string;
  i: OrderId;
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

export interface ListStatusData {
  e: "listStatus";
  E: EventTime;
  s: Symbol;
  g: number; // OrderListId
  c: string; // Contingency Type
  l: string; // List Status Type
  L: string; // List Order Status
  r: string; // List Reject Reason
  C: string; // List Client Order Id
  T: EventTime; // Transaction Time
  O: Array<{
    s: Symbol;
    i: OrderId;
    c: ClientOrderId;
  }>;
}



export interface OutboundAccountPositionData {
  e: "outboundAccountPosition";
  E: EventTime;
  u: EventTime;
  B: Array<{
    a: Asset;
    f: Balance;
    l: Balance;
  }>;
}
export interface PriceFeedMessage {

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



// database functions 

async function updateOrderInDatabase(orderData: ExecutionReportData) {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const updatedOrder = await OrderModel.findOneAndUpdate(
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
    return await OrderModel.find({status: "NEW"}).lean().maxTimeMS(2000);
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














// websocket Server

export async function setupWebSocketServer(server: http.Server, ) {
  const wss = new Server({ server });
  console.log('WebSocket server created');
  if (!testApiSecret) {
    throw new Error('No test API secret provided');

  }
  const requestId = generateRandomId();
  const listenkey  = await getDataStreamListenKey()
  
  console.log('listenkey', listenkey);
  
  
  console.log('WebSocket connection to exchange opened');
  wss.on('connection', async (wsClient: WebSocket, req: any) => {
    // Log the request URL
    console.log('Request URL:', req.url);

    if (!wsTestURL) {
      console.error('No test WebSocket URL provided');
      wsClient.send('No test WebSocket URL provided');
      return;
    }
    const orderController = new OrderController( wsClient,wsTestURL, requestId, testApiSecret);
  
    // Check if the request URL is '/exchangeInfo'
    if (req.url === '/exchangeInfo') {
      console.log('Inside exchangeInfo condition');
    if (wsTestURL) {
      exchangeInfoWebsocket(wsClient, wsTestURL, requestId);

    } else { 
      console.error('No test WebSocket URL provided');
      wsClient.send('No test WebSocket URL provided');
    }
      // Test message to confirm data sending
     // wsClient.send('Test exchangeInfo message');
    }else if (req.url?.startsWith('/userDataReport')) {
    if (!testApiKey || !testApiSecret)  {
      console.log('No test API key or secret provided');
      wsClient.send('No test API key or secret provided');
      return;
    }
      if (!wsTestURL) {
        console.error('Incorrect WebSocket URL provided');
        wsClient.send('Incorrect Websocket URL provided');
       
      } else {

        userDataReportWebsocket(wsClient,testApiKey, testApiSecret, wsTestURL, requestId);
      }
    }
    else if (req.url?.startsWith('/userInfo')) {
      if (!testApiKey || !testApiSecret) {
        console.error('No test API key or secret provided');
        wsClient.send('No test API key or secret provided');
       
      } else {
        if (!wsTestURL) {
          console.error('Incorrect WebSocket URL provided');
          wsClient.send('Incorrect Websocket URL provided');
        } else {
          userInfoWebsocket(wsClient, wsTestURL, testApiKey, testApiSecret, requestId);
        }
      }
     
    }
    else if (req.url?.startsWith('/orderStatus')) {
      console.log('Inside orderStatus condition');
      if (!testApiKey || !testApiSecret) {
        console.log('No test API key or secret provided');
        wsClient.send('No test API key or secret provided') ;
      } else {
        if (!wsTestURL) {
          console.error('Incorrect WebSocket URL provided');
          wsClient.send('Incorrect Websocket URL provided');
        } else {
          orderStatusWebsocket(wsClient, wsTestURL, requestId, testApiSecret,testApiKey , req);

        }
      }
    
    }
    else if (req.url?.startsWith('/allOrders')) {
      console.log('Inside orderStatus condition');
      if (!testApiKey || !testApiSecret) {
        console.log('No test API key or secret provided');
        wsClient.send('No test API key or secret provided') ;
      } else {
        if (!wsTestURL) {
          console.error('Incorrect WebSocket URL provided');
          wsClient.send('Incorrect Websocket URL provided');
        } else { 

          allOrdersWebsocket(wsClient, wsTestURL, requestId, testApiSecret, testApiKey, req);
        }     
      }
    } else if (req.url?.startsWith('/priceFeed')) {
      console.log('Inside priceFeed condition');
      if (!streamUrl) {
        console.error('Incorrect WebSocket URL provided');
        wsClient.send('Incorrect Websocket URL provided');
      } else {
        priceFeedWebsocket(wsClient, streamUrl,req,listenkey,);
      }
      
      
    } else if (req.url?.startsWith('/marketOrder')) {
      console.log('Inside marketOrder condition');
      if (!testApiKey || !testApiSecret) {
        console.log('No test API key or secret provided');
        wsClient.send('No test API key or secret provided');
      } else {
        if (!wsTestURL) {
          console.error('Incorrect WebSocket URL provided');
          wsClient.send('Incorrect WebSocket URL provided');
        } else {
          // Assuming you have a function to parse and validate the request parameters
         // const params = parseMarketOrderRequest(req);
         const parsedUrl = url.parse(req.url, true);

         if (parsedUrl && parsedUrl.query ) {
          const { symbol, side, quantity } = parsedUrl.query;
          
          if (symbol && typeof(symbol) === 'string' && side && typeof(side) === 'string' && quantity && typeof(quantity) === 'string') {
            orderController.handleBinanceMarketOrder(
              wsClient,
    symbol,
    side,
    quantity,
    requestId,
    testApiKey,
    testApiSecret
            )
            .then(() => {
              wsClient.send('Market order successfully placed.');
            })
            .catch(err => {
              wsClient.send(`Error placing market order: ${err.message}`);
            });
          } else {
            wsClient.send('Missing required parameters: symbol, side, or quantity.');
          }
        } else {
          wsClient.send('Invalid request URL or missing parameters.');
        }
        }
      }
    } else if (req.url?.startsWith('/limitOrder')) {
      console.log('Inside limitOrder condition');
      
      if (!testApiKey || !testApiSecret) {
        console.log('No test API key or secret provided');
        wsClient.send('No test API key or secret provided');
      } else {
        if (!wsTestURL) {
          console.error('Incorrect WebSocket URL provided');
          wsClient.send('Incorrect WebSocket URL provided');
        } else {
          // Parse the limit order request to get necessary parameters
         // const { symbol, side, price, quantity, requestId } = parseLimitOrderRequest(req);
          
          // Create an instance of OrderController
          const orderController = new OrderController(wsClient, wsTestURL, testApiKey, testApiSecret);
          
          try {
            // Handle the limit order
            await orderController.handleBinanceLimitOrder(wsClient,req.url.params.symbol, req.url.params.side, req.url.params.quantity, req.url.params.price, requestId,testApiKey, testApiSecret);
            wsClient.send('Limit order placed successfully');
          } catch (error) {
            console.error('Error placing limit order:', error);
            wsClient.send('Error placing limit order');
          }
        }
      }
    }
    
    else if (req.url?.startsWith('/ocoOrder')) {}
    else if (req.url?.startsWith('/cancelOrder')) {}
    else if (req.url?.startsWith('/trades')) {}
    else if (req.url?.startsWith('/')) {}
    else if (req.url?.startsWith('/')) {}
    else if (req.url?.startsWith('/')) {}
    else if (req.url?.startWith('/')) {}
    
  
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




