import { on } from 'events';
import { set } from 'mongoose';
import { WebSocket } from 'ws';
import { v4 as uuidv4} from 'uuid';
import { EventEmitter } from 'events';
import { CombinedStreamPayload, StreamType, StreamPayload } from './streamTypes';
import crypto from 'crypto';
import { request } from 'http';
import { json } from 'stream/consumers';

export type StreamCallback = (data: StreamPayload) => void;



interface BinanceMessage {
    stream: string;
    data: any; // Replace 'any' with the actual type if known
  }

interface RateLimitInfo {
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
    count: number;
  }
  type WebsocketCallback = (message: string | Buffer) => void;
export   type ParamsType = {
    orderId?: number;
    signature?: string;
    timestamp?: number;
    symbols?: string[];
    symbol?: string;
    apiKey?: string;
    recvWindow?: number;
    // add other possible fields here
  };
  
  interface BinanceErrorType {
    code: number;
    msg: string;
} 
interface MarketOrderParams {
  symbol: string;
  side: string;
  type: 'MARKET';
  quantity: string;
  timestamp: number;
  recvWindow?: number;
  apiKey: string;
  signature: string;
}
interface LimitOrderParams {
  symbol: string;
  side: string;
  type: 'LIMIT';
  quantity: string;
  price: number;
  timeInForce: string;
  timestamp: number;
  recvWindow: number;
  apiKey: string;
  signature: string;
  icebergQty?: number;
  newClientOrderId?: string;
  newOrderRespType?: string;
  stopPrice?: number;
  workingType?: string;
  
}

interface CancelOrderParams {
  symbol: string;
  orderId: number;
  timestamp: number;
  recvWindow: number;
  apiKey: string;
  signature: string;
  newClientOrderId: boolean;

}
let recvWindow : number = 60000;
export function generateDate () {
  let currDate = Date.now();
  return currDate;
}
 /**
* Create a Binance API signature.
* @param queryString - The query string to be signed.
* @param apiSecret - The API secret key.
* @returns The generated signature.
*/
export function generateBinanceSignature(queryString: string, apiSecret: string): string {
 return crypto
   .createHmac('sha256', apiSecret)
   .update(queryString)
   .digest('hex');
}
export  function  generateRandomId() {
     let randomId = uuidv4();
     return randomId;
} 
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function setupWebSocket(url: string, requestId: string, method: string, params: ParamsType,  eventEmitter: EventEmitter) {
  // Initialize WebSocket
  const ws = new WebSocket(url);

  // Event handler for when the connection is opened
  ws.addEventListener('open',  () => {
    console.log(`WebSocket connection to ${url} opened `);
    const initialMessage = JSON.stringify({
      id: requestId,
      method: method,
      params: params,
    });
    ws.send(initialMessage);
    //console.log(`Sent message: ${initialMessage}`);
    // Send an initial message if needed, based on your API requirements
   
  });

  // Event handler for receiving messages
  ws.addEventListener('message',  (event) => {
   
    let message:string 
    if (typeof event.data === 'string') {
      message = event.data;
    } else if (event.data instanceof Buffer) {
      message = event.data.toString('utf-8');
      console.log(`Received Buffer message from ${url}, converted to string: ${message}`);
    } else {
      console.error('Unknown message type:', typeof event.data);
      return;
    }

    let parsedMessage;
    try {
    parsedMessage = JSON.parse(message);
    console.log(`Received message from setupwebsocket snippet in utils, url ${url}`, parsedMessage);
    eventEmitter.emit('message', parsedMessage);
    } catch (e) {
      console.error('Error parsing message:', e);
      return;
    }


  });

  // Event handler for errors
  ws.addEventListener('error', (event) => {
    console.log(`WebSocket Error: ${JSON.stringify(event)}`);
    eventEmitter.emit('error', event);
    // Handle errors here
  });

  ws.addEventListener('close', (event) => {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    
    // Handle different closure codes (these are just examples)
    switch(event.code) {
      case 1000:  // Normal Closure
        eventEmitter.emit('close', event.code, event.reason);
        console.log("Connection closed normally.");
        break;
      case 1001:  // Going Away
        eventEmitter.emit('close', event.code, event.reason);
        console.log("The server or client is going away.");
        break;
      case 1002:  // Protocol Error
        eventEmitter.emit('close', event.code, event.reason);
        console.log("There was a protocol error.");
        break;
      case 1003:  // Unsupported Data
        eventEmitter.emit('close', event.code, event.reason);
        console.log("Received data of unsupported type.");
        break;
      case 1005:  // No Status Received
      eventEmitter.emit('close', event.code, event.reason);
        console.log("Expected close status, received none.");
        break;
      case 1006:  // Abnormal Closure
      eventEmitter.emit('close', event.code, event.reason);
        console.log("Abnormal closure, no further detail available.");
      // Add more cases as needed
      default:
        console.log("Unknown closure code.");
    }
  
    // Maybe try to reconnect depending on the closure reason
    // For example:
    // if (event.code !== 1000) {
    //   setTimeout(() => setupWebSocket(), 5000);
    // }
  });

  return ws;
}


export class WebsocketManager {
    private socket: WebSocket | null = null
    private baseUrl: string 
    private reconnectDelay = 5000; // 5 seconds
    private eventEmitter: EventEmitter;
    private requestId: string ;
    private method: string;
    private params: ParamsType ;
    private pingInterval: NodeJS.Timeout | null = null;
    private maxReconnectAttempts: number = 5; // Maximum number of reconnection attempts
    private reconnectAttempts: number = 0; // Current number of reconnection attempts


    

     constructor(baseUrl: string, requestId: string, method: string, params: ParamsType) {
        this.baseUrl = baseUrl;
        this.requestId = requestId;
        this.method = method;
        this.params = params;
        this.eventEmitter = new EventEmitter();
        this.socket = setupWebSocket(this.baseUrl, this.requestId, this.method, this.params,this.eventEmitter);
        this.eventEmitter.on('close', this.onClose.bind(this));
        this.eventEmitter.on('error', this.onError.bind(this));
     }
     private setupWebSocket() {
      return new WebSocket(this.baseUrl);
    }
     public connect(query: string, handlers: { onOpen?: () => void, onMessage?: (message: string | Buffer) => void, onError?: (error: any) => void, onClose?: (event: CloseEvent) => void }) {
      const fullUrl = `${this.baseUrl}/${query}`;
      console.log('Connecting to:', fullUrl);
      this.socket = new WebSocket(fullUrl);
       
      if (handlers.onOpen) {
        this.socket.addEventListener('open', handlers.onOpen);
        
        this.startPing()
      }
  
      if (handlers.onMessage) {
        this.socket.addEventListener('message', (event) => {
          handlers.onMessage!(event.data as string | Buffer);
        });
      }
  
      if (handlers.onError) {
        this.socket.addEventListener('error', handlers.onError);
      }
  
      if (handlers.onClose) {
        this.socket.addEventListener('close', handlers.onClose as any);
      }
    }

    startPing() {
      // Send a ping frame every 30 seconds
      this.pingInterval = setInterval(() => {
        if ( this.socket!.readyState === WebSocket.OPEN) {

          try {
            this.socket!.ping();
            this.sendMessage(JSON.stringify({
              id: this.requestId,
              method: "ping"
            }));
          } catch (error) {
            console.error("Error sending ping:", error);
          }
           // This sends a ping frame
        }
      }, 30000);
  
      // Listen for pong frame
      this.socket!.on('pong', () => {
        console.log('Received pong from server');
      });
    }
  
    stopPing() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }



    
  

    private onOpen() {
      console.log('WebSocket opened');
      this.eventEmitter.emit('open');
     
    }
    
     private onMessage(message: string | Buffer) {
      try {
        const parsedMessage = JSON.parse(message.toString()) as BinanceMessage;
        if ('method' in parsedMessage && parsedMessage.method === "pong") {
          console.log('Received pong from server');
          
        } else {

          console.log('Received message: from websocket manager ', parsedMessage);
          this.eventEmitter.emit('message', parsedMessage);   
        }
      } catch (error) {
        console.error('Error parsing message:', error);
        this.eventEmitter.emit('error', error);
      }
    }
    public forwardMessageToClient(wsClient: WebSocket) {
      this.on('message', (data: string | Buffer) => {
        if (wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(data);
        }
      });
    }
    
    

    private onError(event: Event ) {
      console.log('WebSocket error:', event);
       this.eventEmitter.emit('error', event  );
        // Log the error to a monitoring service if you have one
      }
        // Close the socket if it's still open
      
      
        // Attempt to reconnect after a delay
        private attachEventListeners(handlers: { onOpen?: () => void, onMessage?: (message: string | Buffer) => void, onError?: (error: any) => void, onClose?: (event: CloseEvent) => void }) {
          if (this.socket) {
            if (handlers.onOpen) {
              this.socket.addEventListener('open', handlers.onOpen);
            }
            if (handlers.onMessage) {
              this.socket.addEventListener('message', (event) => {
                handlers.onMessage!(event.data as string | Buffer);
              });
            }
            if (handlers.onError) {
              this.socket.addEventListener('error', handlers.onError);
            }
            if (handlers.onClose) {
              this.socket.addEventListener('close', handlers.onClose as any);
            }
          }
        }
      private onClose(event: CloseEvent) {
        console.log('WebSocket closed:', event);
      
        // Check if the closure was intentional or due to an error
        if (!event.wasClean) {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('Connection died, Attempting to reconnect...');
            setTimeout(() => {
              this.reconnect();
            }, this.reconnectDelay);
          } else {
            console.log('Max reconnection attempts reached.');
          }
        } else {
          console.log('Connection closed cleanly.');
        }
      }
          
          // Attempt to reconnect after a delay
        
      private reconnect() {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts}`);
        this.socket = setupWebSocket(this.baseUrl, this.requestId, this.method, this.params, this.eventEmitter);
        // Reset the ping interval if needed
        this.startPing();
      }
      
      public readyState() {
        if (this.socket) {
          console.log('WebSocket readyState: from wsmanager', this.socket.readyState);
          return this.socket.readyState
        }
      }

      
      public close() {
        if (this.socket) {
          this.socket.close();
        } else {
          console.error('WebSocket is not initialized.');
        }
      }
      

  

  
    public on(event: string, listener: (...args: any[]) => void) {
      this.eventEmitter.on(event, listener);
    }

   

    public sendMessage(message: string) {
      console.log('Sending message:', message);
        if (this.socket?.readyState === WebSocket.OPEN) {
          console.log('Sending message:', message);
            this.socket.send(message);
        } else {
            
            console.error('WebSocket is not initialized.');
        }
    }

}

export class BinanceStreamManager {
  private ws: WebSocket;
  private subscriptions: { [key: string]: Function[] } = {};
  private subscriptionQueue: any[] = [];
  private eventEmitter: EventEmitter;

  constructor(baseEndpoint: string) {
    this.ws = new WebSocket(baseEndpoint);
    this.eventEmitter = new EventEmitter();
    this.ws.on('open', () => {
      console.log('WebSocket connection established.');
      this.processSubscriptionQueue();
    });

    this.ws.on('message', (message: Buffer | string) => {
      const messageStr = message.toString('utf8'); // Convert buffer to string
     // console.log("Received message as string:", typeof(messageStr));
      
     try {
      const parsedMessage: any = JSON.parse(messageStr);
      if ('e' in parsedMessage && 'E' in parsedMessage && 's' in parsedMessage && 'k' in parsedMessage) {
        const stream: string = parsedMessage.s;
        if (this.subscriptions[stream]) {
          this.subscriptions[stream]!.forEach(callback => callback(parsedMessage));
        }
        this.eventEmitter.emit('message', parsedMessage);
      } else {
        if ('code' in parsedMessage) {
          const binanceError = BinanceError.fromCode(parsedMessage.code);
          this.eventEmitter.emit('error', binanceError);
        } else {
          this.eventEmitter.emit('error', new Error("Unexpected message format"));
        }
      }
    } catch (error) {
      this.eventEmitter.emit('error', error);
    }
  });

  this.ws.on('error', (error) => {
    this.eventEmitter.emit('error', error);
  });
    
}
public on(event: string, listener: (...args: any[]) => void) {
  this.eventEmitter.on(event, listener);
}

  private processSubscriptionQueue() {
    console.log('Processing subscription queue...', this.subscriptionQueue);
    while (this.subscriptionQueue.length > 0) {
      const { streamType, params, id } = this.subscriptionQueue.shift();
      this.subscribeToStream(streamType, params, id);
    }
  }

  public subscribeToStream(streamType: string, params: string[], id: number | string) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket is not open. Queuing subscription.');
      this.subscriptionQueue.push({ streamType, params, id });
      return;
    }

    const payload = JSON.stringify({
      method: 'SUBSCRIBE',
      params: params.map(param => `${param}@${streamType}`),
      id: id,
    });

    this.ws.send(payload);
  }
  

  public unsubscribeFromStream(params: string[], id: number | string) {
    const payload = JSON.stringify({
      method: 'UNSUBSCRIBE',
      params,
      id,
    });

    this.ws.send(payload);
  }

  public addListener(stream: string, callback: Function) {
    if (!this.subscriptions[stream]) {
      this.subscriptions[stream] = [];
    }
    this.subscriptions[stream]!.push(callback);
  }

  public removeListener(stream: string, callback: Function) {
    if (this.subscriptions[stream]) {
      this.subscriptions[stream] = this.subscriptions[stream]!.filter(cb => cb !== callback);
    }
  }
}

export class RateLimitManager {
    private requestWeight: number = 0;
    private requestWeightLimit: number = 6000; // default
    private lastRequestTime: number = 0;
    private interval: number = 60000; // 1 minute in milliseconds
    private rateLimits: RateLimitInfo[] = [];

    public canMakeRequest(): boolean {
      const currentTime = Date.now();
      if (currentTime - this.lastRequestTime > this.interval) {
        this.requestWeight = 0;
        this.lastRequestTime = currentTime;
      }
      return this.requestWeight < this.requestWeightLimit;
    }
    public checkRateLimits(): { isExceeded: boolean; retryAfter: number } {
        let isExceeded = false;
        let retryAfter = 0;
      
        for (const rateLimit of this.rateLimits) {
          if (rateLimit.count >= rateLimit.limit) {
            isExceeded = true;
            retryAfter = this.calculateRetryAfter(rateLimit);
            break; // Exit the loop if any rate limit is exceeded
          }
        }
      
        return { isExceeded, retryAfter };
      }
      

    private calculateRetryAfter(rateLimit: RateLimitInfo): number {
        // Calculate the time to wait before the next request
        // This is a simplified example; you may need more complex logic
        if (rateLimit.interval === 'MINUTE') {
          return 60 * 1000; // 1 minute in milliseconds
        }
        // Add more intervals as needed
        return 0;
      }
  
    public updateRateLimits(rateLimits: any) {
      const weightLimitInfo = rateLimits.find((rl: any) => rl.rateLimitType === 'REQUEST_WEIGHT');
      if (weightLimitInfo) {
        this.requestWeight = weightLimitInfo.count;
        this.requestWeightLimit = weightLimitInfo.limit;
        this.interval = weightLimitInfo.intervalNum * 1000; // convert to milliseconds
      }
    }
  
    public handleRateLimitExceeded(retryAfter: number) {
        console.warn(`Rate limit exceeded. Next request will be delayed until ${new Date(retryAfter).toLocaleString()}`);
        
        // Delay the next request. You can use a Promise to resolve after the delay.
        return new Promise<void>(resolve => {
          setTimeout(() => {
            console.log("Resuming requests...");
            resolve();
          }, retryAfter - Date.now());
        });
      }
      
  
      public handleIpBan(retryAfter: number) {
        console.error(`IP banned until ${new Date(retryAfter).toLocaleString()}`);
        
        // Notify the user or take other actions. For example:
        alert(`Your IP has been banned until ${new Date(retryAfter).toLocaleString()}. Please refrain from making excessive requests.`);
      }
      
  }
  
  // TypeScript class to encapsulate Binance errors
 class BinanceError extends Error {
  public code: number;
  public message: string;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.message = message;
  }

  static fromCode(code: number): BinanceError {
    const errorMessages: { [key: string]: string } = {
      
      "-1000": "UNKNOWN: An unknown error occurred while processing the request.",
      "-1001": "DISCONNECTED: Internal error; unable to process your request. Please try again.",
      "-1002": "UNAUTHORIZED: You are not authorized to execute this request.",
      "-1003": "TOO_MANY_REQUESTS: Too many requests queued.",
      "-1004": "UNEXPECTED_RESP: An unexpected response was received from the message bus. Execution status unknown.",
      "-1005": "TIMEOUT: Timeout waiting for response from backend server. Send status unknown; execution status unknown.",
      "-1006": "UNKNOWN_ORDER_COMPOSITION: Unknown order sent.",
      "-1007": "TOO_MANY_ORDERS: Too many new orders.",
      "-1008": "SERVICE_SHUTTING_DOWN: This service is no longer available.",
      "-1009": "UNSUPPORTED_OPERATION: This operation is not supported.",
      "-1010": "INVALID_TIMESTAMP: Timestamp for this request is outside of the recvWindow.",
      "-1011": "INVALID_SIGNATURE: Signature for this request is not valid.",
      "-1012": "ILLEGAL_CHARS: Illegal characters found in a parameter.",
      "-1013": "INSUFFICIENT_BALANCE: Not enough balance to execute this request.",
      "-1014": "UNKNOWN_ORDER: Order does not exist.",
      "-1015": "UNKNOWN_TRADING_PAIR: Unsupported trading pair for this request.",
      "-1016": "INVALID_ORDER: Unsupported order type for this request.",
      "-1017": "INVALID_AMOUNT: Unsupported amount.",
      "-1018": "INVALID_PRICE: Unsupported price.",
      "-1019": "UNKNOWN_ERROR: An unknown error occurred while processing the request.",
      "-1020": "INVALID_PARAMETER: A mandatory parameter was not sent, was empty/null, or malformed.",
      "-1021": "NULL_PARAMETER: A parameter was sent that was null.",
      "-1022": "ALREADY_EXISTS: An attempt to insert an item that already exists was made.",
      "-1023": "INVALID_DATA: An invalid data value was sent and could not be processed.",
      "-1024": "NOT_FOUND: Requested resource was not found.",
      // ... (add all other error codes and messages here)
      "-1100": "ILLEGAL_CHARS: Illegal characters found in a parameter.",
      "-1101": "TOO_MANY_PARAMETERS: Too many parameters sent for this endpoint.",
      "-1102": "MANDATORY_PARAM_EMPTY_OR_MALFORMED: A mandatory parameter was not sent, was empty/null, or malformed.",
      "-1103": "UNKNOWN_PARAM: An unknown parameter was sent.",
      "-1104": "UNREAD_PARAMETERS: Not all sent parameters were read.",
      "-1105": "PARAM_EMPTY: A parameter was empty.",
      "-1106": "PARAM_NOT_REQUIRED: A parameter was sent when not required.",
      "-1112": "NO_DEPTH: No orders on book for symbol.",
      "-1114": "INVALID_LISTEN_KEY: This listenKey does not exist.",
      "-1115": "MORE_THAN_XX_HOURS: Lookup interval is too big.",
      "-1116": "OPTIONAL_PARAMS_BAD_COMBO: Combination of optional parameters invalid.",
      "-1117": "INVALID_PARAMETER: A mandatory parameter was not sent, was empty/null, or malformed.",
      "-1118": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
      "-1119": "DUPLICATE_API_KEY_DESC: Duplicate API key description.",
      "-1120": "INSUFFICIENT_BALANCE: Insufficient balance.",
      "-1121": "CANCEL_ALL_FAIL: Some error in canceling all open orders.",
      "-1125": "TIF_NOT_REQUIRED: TimeInForce parameter sent when not required.",
      "-1127": "INVALID_TIF: Invalid timeInForce.",
      "-1128": "INVALID_ORDER_TYPE: Invalid orderType.",
      "-1130": "INVALID_SIDE: Invalid side.",
      "-1131": "EMPTY_NEW_CL_ORD_ID: New client order ID was empty.",
      "-1132": "EMPTY_ORG_CL_ORD_ID: Original client order ID was empty.",
      "-1133": "BAD_INTERVAL: Invalid interval.",
      "-1134": "BAD_SYMBOL: Invalid symbol.",
      "-1135": "INVALID_LISTEN_KEY: This listenKey does not exist.",
      "-1136": "MORE_THAN_XX_HOURS: Lookup interval is too big.",
      "-1137": "OPTIONAL_PARAMS_BAD_COMBO: Combination of optional parameters invalid.",
      "-1138": "INVALID_PARAMETER: A mandatory parameter was not sent, was empty/null, or malformed.",
      "-1139": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
      "-1140": "NEW_ORDER_REJECTED: New order was rejected.",
      "-1141": "CANCEL_REJECTED: Cancel order was rejected.",
      "-1142": "CANCEL_ALL_FAIL: Some error in canceling all open orders.",
      "-1143": "NO_SUCH_ORDER: Specified order does not exist.",
      "-1144": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
      "-1145": "Invalid cancelRestrictions",
      "-1146": "DUPLICATE_API_KEY_DESC: Duplicate API key description.",
      "-1147": "INSUFFICIENT_BALANCE: Insufficient balance.",
      "-1148": "CANCEL_ALL_FAIL: Some error in canceling all open orders.",
      "-1149": "NO_SUCH_ORDER: Specified order does not exist.",
      "-1150": "BAD_API_ID: Invalid API-key, IP, or permissions for action.",
      "-1151": "EMPTY_ORG_CL_ORD_ID: Original client order ID was empty.",

      // Add more error codes as needed
      "-2008": "NO_DEPTH: No orders on book for symbol.",
      "-2010": "INVALID_LISTEN_KEY: This listenKey does not exist.",
      "-2011": "Order was not canceled due to cancel restrictions.",
      "-2012": "INVALID_INTERVAL: Invalid interval.",
      "-2013": "INVALID_DEPTH: Invalid depth.",
      "-2014": "INVALID_LIMIT: Invalid limit.",
      "-2015": "INVALID_START_TIME: Invalid start time.",

    };

    return new BinanceError(code, errorMessages[code.toString()] || "Unknown Error");
  }
}

export class HandleApiErrors {
  static BinanceError = BinanceError;
}

async function executeMarketOrderForBinance(
  wsClient: WebSocket,
  wsTestURL: string,
  testApiKey: string,
  testApiSecret: string,
  symbol: string,
  side: string,
  quantity: string,
  requestId: string,
  //recvWindow: number
) {
  if (!testApiKey || !testApiSecret) {
    throw new Error('Missing API credentials');
  }
  if (!symbol) throw new Error('Missing required parameter: symbol');
  if (!side) throw new Error('Missing required parameter: side');
  if (!quantity) throw new Error('Missing required parameter: quantity');

  const timestamp = generateDate();
  const queryString = `apiKey=${testApiKey}&quantity=${quantity}&side=${side.toUpperCase()}&symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&type=MARKET`;
  console.log('queryString', queryString)
  const signature = generateBinanceSignature(queryString, testApiSecret);
  console.log('signature', signature)
  const params: MarketOrderParams = {
    symbol: symbol.toUpperCase(),
    side: side.toUpperCase(),
    type: 'MARKET',
    timestamp: timestamp,
    quantity: quantity,
    apiKey: testApiKey,
    signature: signature,
    //recvWindow  // <-- Added this
  };

  const wsMarketOrderManager = new WebsocketManager(`${wsTestURL}`, requestId, 'order.place',params)
  console.log(params)
  wsMarketOrderManager.on('open',() => {
    console.log('Connection to limit order manager opened')
  })
  
  wsMarketOrderManager.on('message', async (data: string | Buffer) => {
    console.log('Received message from limit order manager', data)

    if (wsClient.readyState === WebSocket.OPEN) {
      console.log('Sending market order message to client:', data);

      if (typeof data === 'object') {
        console.log(data)
        wsClient.send(JSON.stringify(data));

      } else {
        console.log(data)
        wsClient.send(JSON.stringify(data));

      }
    } else {
      console.error('WebSocket is not initialized. Cannot send data');
    }
  })
  wsMarketOrderManager.on('error', (event) => {
    console.error('Market Order Connection Error:', JSON.stringify(event))
  })
  wsMarketOrderManager.on('close', (code, reason) => {
    console.log(`Market Order Connection closed: ${code} ${reason}`)
  })
}

async function cancelMarkOrderForBinance ( wsClient:WebSocket,  wsTestURL:string, testApiKey:string , testApiSecret:string, symbol:string, orderId:number, requestId:string) {
  if (!testApiKey || !testApiSecret) {
    throw HandleApiErrors.BinanceError.fromCode(-1002); // Replace with actual error code
  }
  const timestamp = generateDate();
  if (!symbol) {
    throw HandleApiErrors.BinanceError.fromCode(-1015); // Replace with actual error code
  }
  if (!orderId) {
    throw HandleApiErrors.BinanceError.fromCode(-1014); // Replace with actual error code
  }
  const queryString = `apikey=${testApiKey}&symbol=${symbol}&orderId=${orderId}&newClientOrderId=false&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const signature = generateBinanceSignature(queryString, testApiSecret);
  const params : CancelOrderParams = {
    symbol: symbol,
    orderId: orderId,
    apiKey: testApiKey,
    signature: signature,
    timestamp: timestamp,
    recvWindow: recvWindow,
    newClientOrderId: false,
  }
  const wsLimitOrderManager = new WebsocketManager(`${wsTestURL}`, requestId, 'order.cancel',params)
  wsLimitOrderManager.on('open',() => {
    console.log('Connection to limit order manager opened')
  })
  
  wsLimitOrderManager.on('message', async (data: string | Buffer) => {
    console.log('Received message from limit order manager', data)

    if (wsClient.readyState === WebSocket.OPEN) {
      console.log('Sending limit order message to client:', data);

      if (typeof data === 'object') {
        wsClient.send(JSON.stringify(data));

      } else {
        wsClient.send(JSON.stringify(data));

      }
    } else {
      console.error('WebSocket is not initialized. Cannot send data');
    }
  })
  wsLimitOrderManager.on('error', (event) => {
    console.error('Cancel Order Connection Error:', JSON.stringify(event))
  })
  wsLimitOrderManager.on('close', (code, reason) => {
    console.log(`Cancel Order Connection closed: ${code} ${reason}`)
  })
}

async function executeLimitOrderForBinance(
  wsClient: WebSocket,
  wsTestURL: string,
  testApiKey: string,
  testApiSecret: string,
  symbol: string,
  side: string,
  quantity: string,
  price: string,
  requestId: string,
  recvWindow: number,  // <-- Added this
  icebergQty?: number,
  // ... other optional params
) {
  if (!testApiKey || !testApiSecret) {
    throw new Error('Missing API credentials');
  }
  if (!symbol) throw new Error('Missing required parameter: symbol');
  if (!side) throw new Error('Missing required parameter: side');
  if (!quantity) throw new Error('Missing required parameter: quantity');
  if (!price) throw new Error('Missing required parameter: price');
  const timestamp = generateDate();
  let queryString = `apiKey=${testApiKey}&symbol=${symbol.toUpperCase()}&side=${side.toUpperCase()}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const signature = generateBinanceSignature(queryString, testApiSecret);

  const params: LimitOrderParams = {
    symbol,
    side,
    type: 'LIMIT',
    quantity: quantity,
    price: Number(price),
    timeInForce: 'GTC',
    apiKey: testApiKey,
    signature,
    timestamp: generateDate(),
    recvWindow,  // <-- Added this
    // ... conditionally add other optional params
  };
  const wsLimitOrderManager = new WebsocketManager(`${wsTestURL}`, requestId, 'sor.order.place',params)
  wsLimitOrderManager.on('open',() => {
    console.log('Connection to limit order manager opened')
  })
  
  wsLimitOrderManager.on('message', async (data: string | Buffer) => {
    console.log('Received message from limit order manager', data)

    if (wsClient.readyState === WebSocket.OPEN) {
      console.log('Sending limit order message to client:', data);

      if (typeof data === 'object') {
        wsClient.send(JSON.stringify(data));

      } else {
        wsClient.send(JSON.stringify(data));

      }
    } else {
      console.error('WebSocket is not initialized. Cannot send data');
    }
  })
  wsLimitOrderManager.on('error', (event) => {
    console.error('Limit Order Connection Error:', JSON.stringify(event))
  })
  wsLimitOrderManager.on('close', (code, reason) => {
    console.log(`Limit Order Connection closed: ${code} ${reason}`)
  })
}

export class OrderController {
  wsClient: WebSocket;
  wsTestURL: string;
  testApiSecret: string;
  testApiKey: string;
  recvWindow: number;


  constructor(wsClient: WebSocket, wsTestURL: string, testApiKey: string, testApiSecret: string) {
    this.wsClient = wsClient;
    this.wsTestURL = wsTestURL;
    this.testApiSecret = testApiSecret;
    this.testApiKey = testApiKey;
    this.recvWindow = recvWindow;
 
  }
 
  
 async handleBinanceMarketOrder(wsClient: WebSocket, symbol: string, side: string, quantity: string, requestId: string, testApiKey: string, testApiSecret: string) {
    try {
      await executeMarketOrderForBinance(
        wsClient,
        this.wsTestURL,
        testApiKey,
        testApiSecret,
        symbol,
        side,
        quantity,
        requestId,
        //recvWindow
        
      )
      console.log('Binance market order handled successfully');
      } catch (error) {
        console.error('Error executing Binance market order:', error);
      }
  }
 async handleBinanceLimitOrder( wsClient:WebSocket, symbol:string, side:string, quantity:string, price:string, requestId:string, testApiKey:string, testApiSecret:string,  ) {
    try {
      await executeLimitOrderForBinance(
        this.wsClient,
        this.wsTestURL,
        this.testApiKey,
        this.testApiSecret,
        symbol,
        side,
        quantity,
        price,
        requestId,
        recvWindow


      )
      console.log('Binance limit order handled successfully');
      } catch (error) {
        console.error('Error executing Binance limit order:', error);
      }
  }

  
 
  async handleBinanceStopLossOrder() {}
  async handleBinanceStopLossLimitOrder() {}
  async handleBinanceTakeProfitOrder() {}
  async handleBinanceTakeProfitLimitOrder() {}
  async handleBinanceLimitOcoOrder() {}
  async handleBinanceCancelOrder( symbol:string, orderId:number,requestId:string) {
    try {
      await cancelMarkOrderForBinance(
        this.wsClient,
        this.wsTestURL,
        this.testApiKey,
        this.testApiSecret,
        symbol,
        orderId,
        requestId
      )
      console.log('Binance limit order handled successfully');
      } catch (error) {
        console.error('Error executing Binance limit order:', error);
      }
  }
  async handleBinanceCancelAllOrders() {}
  async handleBinanceCancelOcoOrder() {}
  async handleBinanceReplaceOrder() {}

}

