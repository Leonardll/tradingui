import { on } from 'events';
import { set } from 'mongoose';
import { WebSocket } from 'ws';
import uuid from 'uuid';
import { EventEmitter } from 'events';



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
  type ParamsType = {
    symbols?: string[];
    // add other possible fields here
  };
  
  interface BinanceErrorType {
    code: number;
    msg: string;
} 
export function generateRandomId() {
     return uuid.v4();
} 
export function setupWebSocket(url: string, requestId: string, method: string, params: ParamsType) {
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
      return parsedMessage;
    } catch (e) {
      console.error('Error parsing message:', e);
      return;
    }


  });

  // Event handler for errors
  ws.addEventListener('error', (error) => {
    console.log(`WebSocket Error: ${error}`);
    // Handle errors here
  });

  ws.addEventListener('close', (event) => {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    
    // Handle different closure codes (these are just examples)
    switch(event.code) {
      case 1000:  // Normal Closure
        console.log("Connection closed normally.");
        break;
      case 1001:  // Going Away
        console.log("The server or client is going away.");
        break;
      case 1002:  // Protocol Error
        console.log("There was a protocol error.");
        break;
      case 1003:  // Unsupported Data
        console.log("Received data of unsupported type.");
        break;
      case 1005:  // No Status Received
        console.log("Expected close status, received none.");
        break;
      case 1006:  // Abnormal Closure
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


export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));




export class WebsocketManager {
    private socket: WebSocket | null = null
    private baseUrl: string 
    private reconnectDelay = 5000; // 5 seconds
    private eventEmitter: EventEmitter;
    private requestId: string ;
    private method: string;
    private params: ParamsType ;
    private pingInterval: NodeJS.Timeout | null = null;

    

     constructor(baseUrl: string, requestId: string, method: string, params: ParamsType) {
        this.baseUrl = baseUrl;
        this.requestId = requestId;
        this.method = method;
        this.params = params;
        this.socket = setupWebSocket(this.baseUrl, this.requestId, this.method, this.params);
        this.eventEmitter = new EventEmitter();
        
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
          this.socket!.ping(); // This sends a ping frame
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
      console.log('Received message: from websocket manager ', parsedMessage);
        this.eventEmitter.emit('message', parsedMessage);   
      } catch (error) {
        console.error('Error parsing message:', error);
        this.eventEmitter.emit('error', error);
      }
    }
    

    private onError(event: Event ) {
      console.log('WebSocket error:', event);
       this.eventEmitter.emit('error', event  );
        // Log the error to a monitoring service if you have one
      }
        // Close the socket if it's still open
      
      
        // Attempt to reconnect after a delay
      
      private onClose(event: CloseEvent) {
        console.log('WebSocket closed:', event);
      
        // Check if the closure was intentional or due to an error
        if (!event.wasClean) {
          console.log('Connection died, Attempting to reconnect...');
          setTimeout(() => {
            this.socket = setupWebSocket(this.baseUrl, this.requestId,this.method,this.params);
          }, this.reconnectDelay);
          console.log('Connection closed cleanly');
        }
          
          // Attempt to reconnect after a delay
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

class StreamManager {
  private websocketManager: WebsocketManager;
  private subscriptions: { [key: string]: Function[] } = {};

  constructor(websocketManager: WebsocketManager) {
    this.websocketManager = websocketManager;
  }

  public subscribe(topic: string, callback: WebsocketCallback) {
    if (!this.subscriptions[topic]) {
      this.subscriptions[topic] = [];
    }
    this.subscriptions[topic]!.push(callback);
  }

  // Other stream-specific methods
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
      // ... (add all other error codes and messages here)
      "-1100": "ILLEGAL_CHARS: Illegal characters found in a parameter.",
      "-1101": "TOO_MANY_PARAMETERS: Too many parameters sent for this endpoint.",
      "-1102": "MANDATORY_PARAM_EMPTY_OR_MALFORMED: A mandatory parameter was not sent, was empty/null, or malformed.",
      // ... (add all other error codes and messages here)
      // Add more error codes as needed
    };

    return new BinanceError(code, errorMessages[code.toString()] || "Unknown Error");
  }
}

export class HandleApiErrors {
  static BinanceError = BinanceError;
}

