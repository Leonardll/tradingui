import { Request } from 'express';
import {Server, WebSocket } from 'ws';
import http, { get } from 'http';
import { openTradeStream, getDataStreamListenKey, cancelOrder, getOrderStatusFromBinance, getPricefeedStreamForSymbol, checkConnection } from './services/binanceService';
import { eventEmitter } from './events/eventEmitter';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AllTrades} from './models/orderModels';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
import url from 'url';


let isUpdating = false;
const wsTestURL = process.env.BINANCE_TEST_WEBSOCKET_API_URL;
const streamUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL;
const  testApiKey = process.env.BINANCE_TEST_API_KEY;
const  testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY;
let exchangeInfo: ExchangeInfoData | null = null;


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

async function updateOrderInDatabase(orderData: ExecutionReportData) {
  // console.log('Updating order in database:', orderData.i)

  try {
  

     const count =  AllTrades.countDocuments({});
      console.log(`Total orders: ${count}`);
    }
  
  catch (error) {
    console.error('Error running test query:', error);
  }

  try {
    const updatedOrder = await AllTrades.findOneAndUpdate(
      { orderId: orderData.i }, // find a document with this orderId
      {
        status: 'FILLED',
        // ... any other fields you want to update
      },
      { new: true, 
        maxTimeMS: 2000,
      } // return the new updated document
    );
    console.log('updatedOrder:', updatedOrder);

    if (updatedOrder) {
      console.log('Successfully updated order in database:', updatedOrder);
    } else {
      console.log('Order not found in database:', orderData.i);
    }
  } catch (error) {
    console.error('Error updating order in database:', error);
  }
}


async function getAllOrdersFromMongo() {
    return await AllTrades.find({status: "NEW"}).lean();
}

 getAllOrdersFromMongo()
.then((orders) => {
  orders && orders.map((dbOrder) => {
    let orderStatus = dbOrder.status
    if (orderStatus === 'NEW') {

      getOrderStatusFromBinance(dbOrder.symbol, Number(dbOrder.orderId))
      .then( async (apiOrder) => {
        if (apiOrder.status === 'FILLED') {
          await AllTrades.findOneAndUpdate({orderid:apiOrder.orderId}, {status: 'FILLED'}, {new: true})
        }
        if (apiOrder.status === 'CANCELED') {
          await AllTrades.findOneAndUpdate({orderId: apiOrder.orderId}, {status: 'CANCELED'}, {new: true})
        }
        else {
          console.log('order status is still new', apiOrder.orderId)
        }
      }).catch((error) => {
        console.error('Error comparing order status from Binance API and DB :', error)
      })

    } 
  });
}).catch((error) => {
  console.error('Error finding order with status new:', error);
});








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




const wsExchangeInfo = new WebSocket(`${wsTestURL}`);
export async function setupExchangeInfoStream () {

  // Listen for the WebSocket connection to open
  wsExchangeInfo.on('open', () => {
    console.log('WebSocket connection to exchange info opened');
    const requestId = uuidv4();
    wsExchangeInfo.send(JSON.stringify({id: requestId, method: 'exchangeInfo', params: {} }));
  });

  
const exchangeInfoPromise = new Promise((resolve) => {
  wsExchangeInfo.on('message', (message:   string) => {
  
    try {
      const data = JSON.parse(message) as ExchangeInfoData;
      // console.log('data.method:', data); // New log statement

      if (data.result) {
        exchangeInfo = data;
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
return exchangeInfoPromise;


}

export  function setupWebSocketServer(server: http.Server, ) {
  const wss = new Server({ server });
  if (!testApiSecret) {
    throw new Error('No test API secret provided');

  }
  

  // Initialize the exchange info stream
  setupExchangeInfoStream().then((exchangeInfo) => {
    console.log('Exchange info initialized:', exchangeInfo);
  }).catch((error) => {
    console.error('Error initializing exchange info:', error);
  });
  
  wss.on('connection', async (wsClient: WebSocket, req: Request ) => {
    
    if (req.url === '/userTradeStream') {
  
   

      console.log('new client connected - userdatastream')
      
      const listenKey = await getDataStreamListenKey();
      const wsUserData = new WebSocket(`${streamUrl}/${listenKey}`);
      console.log('WebSocket connection to user data stream opened');
      let targetOrderId: string | null = null; // Store the target order ID here
      wsUserData.on('message', async (data) => {
        
        console.log('Received user data:',  data.toString());
        try {
          const userData = JSON.parse(data.toString()) as ExecutionReportData
          console.log('Received user data:', userData);
          // Handle the user data here, such as updating the database or triggering other actions
          // You can also send the data to the client if needed
    
          if  (userData.e === 'ORDER_TRADE_UPDATE') {
            // Extract the order update data
            const orderUpdateData = JSON.parse(userData.o) as Order;
    
            // Check if the order update data matches the target order ID
            if (targetOrderId && orderUpdateData.orderId === targetOrderId) {
              console.log('Received order update for target order ID:', targetOrderId, orderUpdateData);
    
              // Send the order update data to the client
              wsClient.send(JSON.stringify(orderUpdateData));
            }
          }
        
  
          if (userData.X === 'FILLED') {
            await updateOrderInDatabase(userData);
            // Update database for order
            // ...
           console.log('Order filled:', userData);
          } else if (userData.X === 'CANCELED') {
            console.log('Order canceled:', userData);
          } else if (userData.X === 'NEW') {
            console.log('Order Status New:', userData);
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
          return;
        }
      
      }); 

      
     wsClient.on('message', async (message: Buffer) => {
      console.log('Received message type:', typeof message);
      console.log('Received message content:', message);
      let data;
      const preProcessMessage = (msg: string): string => {
        return msg.replace(/(\w+):/g, '"$1":');
      };
      const messageStr = preProcessMessage(message.toString('utf-8').trim());
      if (messageStr.startsWith('{') || messageStr.startsWith('[')) {

      try {
        data = JSON.parse(messageStr) as Order;
        console.log('Successfully parsed message:', data); // <-- Add this log
      } catch (error) {
        console.error('Error parsing message:', error); // <-- Add this log
        // const symbol = messageStr.toString();
        return;
      }
    } else {
      console.log(`Received non-JSON message from client: ${messageStr}`);
      return;
    }
      console.log('Received message from client:', messageStr);

      //const data = JSON.parse(message) as Order;
      console.log('Parsed message:', data );
      if (data.action === 'deleteOrder') {
        // This is a request to delete an order
        const response = await cancelOrder(data);
        console.log('Cancel order response:', response);
        wsClient.send(JSON.stringify(response));
      }
      targetOrderId = data.orderId;
        console.log('Set target order ID:', targetOrderId);
      if (data.action === 'setTargetOrderId') {
        targetOrderId = data.orderId;
        console.log('Set target order ID:', targetOrderId);
      }

    });
      
      
    
    wsUserData.on('close', (code, reason) => {
      console.log(`WebSocket connection to user data closed, code: ${code}, reason: ${reason}`);
    });
    
    wsUserData.on('error', (error) => {
      console.error('Websocket error:', error);
    });
    }
   
    if (req.url.startsWith ('/priceFeed')) {
      console.log('Client connected to priceFeed');
      const location = url.parse(req.url, true);
      const symbol =location.query.symbol
      console.log(symbol, "log from getPricefeedStreamForSymbol binanceService.ts")
      if (!symbol) {
        console.error('Symbol parameter is missing');
        return;
      }
      const listenKey = await getDataStreamListenKey();
      const wsPriceFeed = `${streamUrl}/${listenKey}/${symbol}@kline_1s`;
      
      const binanceWsPriceFeed = new WebSocket(wsPriceFeed) 
      console.log('WebSocket connection to price feed opened');

      binanceWsPriceFeed.on('open', () => {
        console.log('WebSocket connection to price feed opened');
      })

      binanceWsPriceFeed.on('message', async (message:Buffer) => {
         const messageStr = message.toString('utf-8')
         try {
        const  msgJson = JSON.parse(messageStr) as PriceFeedMessage;
        wsClient.send(JSON.stringify(msgJson)) 
       // console.log('Received price feed message:', msgJson);
         } catch (error) {
           console.error('Error parsing price feed message:', error);
           return;
         }
      })

      binanceWsPriceFeed.on('error', (error) => {
        console.error('Websocket Price Feed error:', error);
      })

      binanceWsPriceFeed.on('close', (code, reason) => { 
        console.log(`WebSocket connection to price feed closed, code: ${code}, reason: ${reason}`);
       })

       

      // const wsBinancePriceFeed = await getPricefeedStreamForSymbol(req.query.symbol as string)  
      // console.log(req.query.symbol)
      // wsBinancePriceFeed.on('message', async (priceFeedMessage) => { 
      //   console.log('Received price feed message:', priceFeedMessage);
      //   wsClient.send(JSON.stringify(priceFeedMessage))
      // });

      // wsBinancePriceFeed.on('error', (error) => {
      //   console.error('Websocket Price Feed error:', error);
      // })

      // wsBinancePriceFeed.on('close', (code, reason) => {
      //   console.log(`WebSocket connection to price feed closed, code: ${code}, reason: ${reason}`);
      // })
    }
  



    wsExchangeInfo.on('error', (error) => { console.error('Websocket error:', error) });

    wsExchangeInfo.on('close', (code, reason) => {
      console.log(`WebSocket connection to exchange info closed, code: ${code}, reason: ${reason}`);
   //   // You could also try to reconnect here if you want
    });

    

    wsClient.on('close', function close() {
      console.log('Client disconnected');
      wsExchangeInfo.close();
     
      // Close any other WebSocket connections related to this client
      // ...
    });

    wsClient.on('error', function error(err) {
      console.log('WebSocket error:', err.message);
    });
  });

};


  



export async function getExchangeInfo() {
  if (!exchangeInfo) {
    throw new Error('Exchange info not initialized');
  }
  return exchangeInfo;
}

