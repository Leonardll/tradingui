import { Request } from 'express';
import {Server, WebSocket,} from 'ws';
import http from 'http';
import { getUserDataStream, cancelOrder } from './services/binanceService';
import { eventEmitter } from './events/eventEmitter';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { connectToMongoDB } from './mongodb'
import { AllTrades} from './models/orderModels';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
let isUpdating = false;
const wsTestURL = process.env.BINANCE_TEST_WS_URL;
const wsExchangeInfoURL = 'wss://testnet.binance.vision/ws-api/v3';
const  testApiKey = process.env.BINANCE_TEST_API_KEY;
const  testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY;
let exchangeInfo: any = null;
let ordersForSymbol: any = {};



interface Order {
  symbol: string;
  orderId: string;
  origClientOrderId: string;
  action?: string;
  order?: string;
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



async function getAllOrders() {
    return await AllTrades.find({}).lean();
}


async function updateOrderInDatabase(order: Order) {
  await AllTrades.updateOne({ orderId: order.orderId }, order);
}






// Create a WebSocket connection to the Binance exchange info endpoint
const wsExchangeInfo = new WebSocket(`wss://testnet.binance.vision/ws-api/v3`);

// Listen for the WebSocket connection to open
wsExchangeInfo.on('open', () => {
  console.log('WebSocket connection to exchange info opened');
  const requestId = uuidv4();
  wsExchangeInfo.send(JSON.stringify({id: requestId, method: 'exchangeInfo', params: {} }));
});



const exchangeInfoPromise = new Promise((resolve) => {
  wsExchangeInfo.on('message', (message: string) => {
    console.log('Received message from exchange info:', message);
  
    try {
      const data = JSON.parse(message) as ExchangeInfoData;
      // console.log('data.method:', data); // New log statement

      if (data.result) {
        exchangeInfo = data.result.symbols;
       // console.log('Received exchange info:', exchangeInfo);
        console.log('Emitting exchangeInfoAvailable event'); // Check if the event is being emitted

        try {
          eventEmitter.emit('exchangeInfoAvailable', exchangeInfo);
          console.log('Emitting exchangeInfoAvailable event'); // Check if the event is being emitted
        } catch (error) {
          console.error('Error emitting exchangeInfoAvailable event:', error);
        }
        resolve(exchangeInfo);
      }
     }
    catch (error) {
      console.log('Error parsing exchange info:', error);
    }
  });
});


// export function getOrdersForSymbol(symbol: string ) {
//   const orders = ordersForSymbol[symbol] || [];
//   console.log(`Getting Orders for ${symbol} `, orders);
//   return  orders;
// }

export async function getOrdersForSymbol(symbol: string) {
  try {
    const upperCaseSymbol = symbol.toUpperCase();
    // Find all orders with the given symbol
    const orders = await AllTrades.find({ symbol: upperCaseSymbol }).lean();
    console.log(`Getting Orders for ${upperCaseSymbol}`, orders);
    return orders;
  } catch (error) {
    console.error('Error fetching orders from MongoDB:', error);
    throw new Error('Error fetching orders');
  }
}

export function setupWebSocketServer(server: http.Server) {
  const wss = new Server({ server });
  if (!testApiSecret) {
    throw new Error('No test API secret provided');

  }
  wss.on('connection', async (wsClient: WebSocket, req: Request ) => {
    console.log('new client connected - userdatastream - trade status');

    const listenKey = await getUserDataStream();
    console.log('listenKey:', listenKey);
    const wsUrl = `${wsTestURL}/${listenKey}`
    console.log('wsUrl:', wsUrl);
    const wsUserData = new WebSocket(wsUrl);
    const symbol = new URL(req.url, `http://${req.headers.host}`).searchParams.get('symbol');
      

    wsUserData.on('open', async () => {
      console.log('WebSocket connection to user data opened');
    
      // Fetch the current orders from the database
      const currentOrders = await getAllOrders(); // Assume this function fetches all orders
    
      // Iterate through the orders and query each one
      for (const order of currentOrders) {
        const symbol = order.symbol;
        const orderId = order.orderId.toString();
        const requestId = uuidv4(); // Generate a unique request ID
    
        wsUserData.send(JSON.stringify({
          id: requestId,
          method: 'queryOrder',
          params: { symbol, orderId }
        }));
      }
    });
      wsUserData.on('message', async (message: string) => {


        const data = JSON.parse(message) as Data
        
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

          // await updateOrderInDatabase(updatedOrder); // Assume this function updates the order
          // console.log('Order updated:', updatedOrder);
          // Update the orders
         symbol && await updateOrdersForSymbol(symbol, data.result);
        }
      });
   

     
      
    


 
    wsExchangeInfo.on('error', (error) => { console.error('Websocket error:', error) });

    wsExchangeInfo.on('close', (code, reason) => {
      console.log(`WebSocket connection to exchange info closed, code: ${code}, reason: ${reason}`);
      // You could also try to reconnect here if you want
    });
 
    
    

    wsClient.on('message', async (message: string) => {
      let data;
      try {
        data = JSON.parse(message) as Order;
      } catch (error) {
        // If parsing fails, assume the message is a symbol string
        const symbol = message.toString();
        console.log(`Received symbol from client: ${symbol}`);
        // You can add code here to handle the symbol
        return;
      }
      console.log('Received message from client:', message);

      //const data = JSON.parse(message) as Order;
      console.log('Parsed message:', data);
      if (data.action === 'deleteOrder') {
        // This is a request to delete an order
        const response = await cancelOrder(data);
        console.log('Cancel order response:', response);
        wsClient.send(JSON.stringify(response));
      }
    });

    wsClient.on('close', function close() {
      console.log('Client disconnected');
      wsUserData.close();
      wsExchangeInfo.close();

    });

    wsClient.on('error', function error(err) {
      console.log('WebSocket error:', err.message);
    });
    wsUserData.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    wsUserData.onerror = (event) => {
      console.log('WebSocket error:', event.message);
    };
    wsUserData.on('close', (code, reason) => {
      console.log(`WebSocket connection closed, code: ${code}, reason: ${reason}`);
    });
  });
}

export async function getExchangeInfo() {
  if (!exchangeInfo) {
    exchangeInfo = await exchangeInfoPromise;
  }
  return exchangeInfo;
}
