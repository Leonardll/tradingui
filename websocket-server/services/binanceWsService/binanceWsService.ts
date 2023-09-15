import {WebsocketManager, BinanceStreamManager,generateDate, generateBinanceSignature, ParamsType } from '../../utils/utils'
import WebSocket from 'ws';
import { getDataStreamListenKey, updateOrderInDatabase} from '../binanceService';
import { PriceFeedMessage,EventTime, Symbol, OrderId, ClientOrderId, OutboundAccountPositionData, BalanceUpdateData, ExecutionReportData } from '../../websocketServer';
/**
 * Initialize and manage WebSocket connection for exchange info.
 * @param wsTestURL - The WebSocket test URL for the exchange.
 * @param requestId - The request ID for the WebSocket connection.
 */


interface ListStatusData {
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
 async function handleOutboundAccountPosition(data: OutboundAccountPositionData) {
    console.log('Account Position Update:', data);
    
    // Extract relevant information
    const eventTime = data.E;
    const lastAccountUpdate = data.u;
    const balances = data.B;
  
    // Validate the data
    if (!Array.isArray(balances)) {
      console.error('Invalid balance data:', balances);
      return;
    }
  
    // Process each balance
    balances.forEach((balance: any) => {
      const asset = balance.a;
      const free = parseFloat(balance.f);
      const locked = parseFloat(balance.l);
  
      if (isNaN(free) || isNaN(locked)) {
        console.error('Invalid balance values:', balance);
        return;
      }
  
      // Your logic here, e.g., update database, trigger alerts, etc.
    });
  }
  
  // Function to handle 'balanceUpdate' event
 async function handleBalanceUpdate(data: BalanceUpdateData ) {
    console.log('Balance Update:', data);
  
    // Extract relevant information
    const eventTime = data.E;
    const asset = data.a;
    const balanceDelta = parseFloat(data.d);
    const clearTime = data.T;
  
    if (isNaN(balanceDelta)) {
      console.error('Invalid balance delta:', data.d);
      return;
    }
  
    // Your logic here, e.g., update database, trigger alerts, etc.
  }
  
  // Function to handle 'executionReport' event
 async function handleExecutionReport(data: ExecutionReportData) {
    console.log('Order Update:', data);
  
    // Extract relevant information
    const eventTime = data.E;
    const symbol = data.s;
    const clientOrderId = data.c;
    const side = data.S;
    const orderType = data.o;
    const orderStatus = data.X;
    const orderRejectReason = data.r;
    const orderId = data.i;
  
    // Your logic here, e.g., update database, trigger alerts, etc.
    if (orderStatus === 'NEW') {
    // Handle new orders
    console.log(`New ${side} order for ${symbol} at ${eventTime}`);
    
    } else if (orderStatus === 'FILLED') {

    await updateOrderInDatabase(data,orderStatus);

    } else if (orderStatus === 'CANCELED') {
     // Handle canceled orders
    await updateOrderInDatabase(data,orderStatus);
    } else if (orderStatus === 'REJECTED') {
      // Handle rejected orders
      await updateOrderInDatabase(data, orderStatus);
    } else if (orderStatus === 'TRADE') {
      // Handle trades
      await updateOrderInDatabase(data, orderStatus);
    } else if (orderStatus === 'EXPIRED') {
      // Handle expired orders
    } else {
      console.error('Unknown order status:', orderStatus);
    }
  }
  // Function to handle 'listStatus' event (for OCO orders)
  function handleListStatus(data: ListStatusData) {
    console.log('List Status:', data);
  
    // Extract relevant information
    const eventTime = data.E;
    const symbol = data.s;
    const orderListId = data.g;
    const contingencyType = data.c;
    const listStatusType = data.l;
    const listOrderStatus = data.L;
    const listRejectReason = data.r;
  
    // Your logic here, e.g., update database, trigger alerts, etc.
    if (listOrderStatus === 'EXECUTING') {
      // Handle executing lists
    } else if (listOrderStatus === 'ALL_DONE') {
      // Handle completed lists
    } else {
      console.error('Unknown list order status:', listOrderStatus);
    }
  }

// exchange data 
  export function exchangeInfoWebsocket(wsClient: WebSocket, wsTestURL: string, requestId: string): void {
    const wsExchangeInfoManager = new WebsocketManager(wsTestURL, requestId, 'exchangeInfo', {});
  
    wsExchangeInfoManager.on('open', () => {
      console.log('Connection to exchange info opened');
    });
  
    wsExchangeInfoManager.on('message', async (data: string | Buffer) => {
      console.log('Received message from exchange:', data);
  
      if (wsClient.readyState === WebSocket.OPEN) {
        console.log('wsClient is open. Sending data.', data);
  
        // Forward this data to the client
        wsClient.send(JSON.stringify(data));
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
  }

// user data stream
export async function userDataReportWebsocket (wsClient: WebSocket,testApiKey:string,testApiSecret:string, wsTestURL: string, requestId: string) {
 

    if (!testApiKey || !testApiSecret) {
        console.error('No test API key or secret provided');
        wsClient.send('No test API key or secret provided');
        return;
      }
    
      // Generate listenKey using your API (this part depends on how you've set up API calls)
      const listenKey = await getDataStreamListenKey();
    
      if (!listenKey) {
        console.error('Failed to generate listenKey');
        wsClient.send('Failed to generate listenKey');
        return;
      }
    
      // Create WebSocket URL for user data stream
      const wsUserDataUrl = `${wsTestURL}/${listenKey}`;
    
      // Create a new BinanceStreamManager for the user data stream
      const binanceStreamManager = new BinanceStreamManager(wsUserDataUrl);
      console.log('connection  to user data stream opened');
      // Add a listener to handle incoming user data
      binanceStreamManager.on('message', (data: any) => {
        const eventType = data.e;  // Event type
        
        switch(eventType) {
          case 'outboundAccountPosition':
            handleOutboundAccountPosition(data);
            break;
          case 'balanceUpdate':
            handleBalanceUpdate(data);
            break;
          case 'executionReport':
            handleExecutionReport(data);
            break;
          case 'listStatus':
            handleListStatus(data);
            break;
          default:
            console.log('Unknown event type:', eventType);
        }
      
        if (wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify(data));
        } else {
          console.log('wsClient is not open. Cannot send user data.');
        }
      });
      
      // Function to handle 'outboundAccountPosition' event
 
    
      // Handle errors
      binanceStreamManager.on('error', (error: any) => {
        console.error('User Data Websocket error:', JSON.stringify(error));
      });
    
      // Handle close events
      binanceStreamManager.on('close', (code: number, reason: string) => {
        console.log(`WebSocket connection to user data closed, code: ${code}, reason: ${reason}`);
      });
}

// user account info
export async function userInfoWebsocket(wsClient:WebSocket,wsTestURL:string,requestId:string,testApiSecret:string, testApiKey:string){
    const timestamp = generateDate();
    const queryString = `apiKey=${testApiKey}&timestamp=${timestamp}`;
    const signature = generateBinanceSignature(queryString, testApiSecret);
    const params: ParamsType = {
      apiKey: testApiKey,
      signature: signature,
      timestamp: timestamp
    };
    if (!wsTestURL){
        console.log('No test URL provided');
        wsClient.send('No test URL provided');
        
    } else {

        const wsUserInfoManager = new WebsocketManager(`${wsTestURL}`, requestId, 'account.status', params);
        wsUserInfoManager.on('open', () => {
          console.log('Connection to user info opened');
    
        });
        wsUserInfoManager.on('message', async (data: string | Buffer) => {
          console.log('Received user info message from exchange:', data);
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
        wsUserInfoManager.on('error', (error:any) => {
          console.error('User Info Websocket error:', JSON.stringify(error));
        });
        wsUserInfoManager.on('close', (code:number, reason:string) => {
          console.log(`WebSocket connection to user info closed, code: ${code}, reason: ${reason}`);
        });
    }
}

// New Order & order status
export function orderStatusWebsocket(wsClient:WebSocket, wsTestURL:string, requestId:string, testApiSecret:string, testApiKey:string, req:any ) {
    console.log('Inside orderStatus condition');
    if (!testApiKey && !testApiSecret) {
      throw new Error('No test API key provided');
    }
    const parsedUrl =  new URL(req.url, `http://${req.headers.host}` ); // Parse the URL and the query parameters

    const symbol = parsedUrl.searchParams.get('symbol');
    const orderId = parsedUrl.searchParams.get('orderId');
  
    const timestamp = generateDate();
    
    if (!symbol && !orderId) {
      throw new Error('No symbol or orderId provided');
     } else {

       const queryString = `apiKey=${testApiKey}&orderId=${orderId}&symbol=${symbol}&timestamp=${timestamp}`;
       const signature = generateBinanceSignature(queryString, testApiSecret);
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

export function allOrdersWebsocket(wsClient:WebSocket, wsTestURL:string, requestId:string, testApiSecret:string, testApiKey:string, req:any ) {
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
         const signature = generateBinanceSignature(queryString, testApiSecret);
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

}

// Trades info


// market data stream
export function priceFeedWebsocket( wsClient:WebSocket, streamUrl:string, req:any, listenkey:string,  ) {

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
