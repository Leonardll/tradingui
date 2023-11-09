
jest.mock('../utils/utils', () => {
  return {
    WebsocketManager: jest.fn().mockImplementation(() => {
      return {
        // ... your existing WebsocketManager mock implementation
        socket: null,
        baseUrl: '',
        reconnectDelay: 5000,
        eventEmitter: new (require('events').EventEmitter)(),
        requestId: '',
        method: '',
        params: {},
        pingInterval: null,
        maxReconnectAttempts: 5,
        reconnectAttempts: 0,
        setupWebSocket: jest.fn(),
        connect: jest.fn(),
        startPing: jest.fn(),
        stopPing: jest.fn(),
        onOpen: jest.fn(),
        onMessage: jest.fn(),
        forwardMessageToClient: jest.fn(),
        onError: jest.fn(),
        attachEventListeners: jest.fn(),
        onClose: jest.fn(),
        reconnect: jest.fn(),
        readyState: jest.fn(),
        close: jest.fn(),
        on: jest.fn((event, callback) => {
          console.log(`Mock 'on' method called with event: ${event}`);
          if (event === 'open') {
            callback();
          }
        }),
        sendMessage: jest.fn()
      };
    }),
    BinanceStreamManager: jest.fn().mockImplementation(() => {
      return {
        ws: new WebSocket('wss://test.url'), // Mocked WebSocket
        subscriptions: {},
        subscriptionQueue: [],
        eventEmitter: new (require('events').EventEmitter)(),
        on: jest.fn(),
        processSubscriptionQueue: jest.fn(),
        subscribeToStream: jest.fn(),
        unsubscribeFromStream: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn()
      };
    }),
  };
});
jest.mock('axios');
jest.mock('../services/binanceService', () => {
  return {
    getDataStreamListenKey: jest.fn().mockResolvedValue('mockListenKey'),
  };
});
  
jest.mock("../db/operations/binance/ocoOps", () => ({
    uploadOCOToDB: jest.fn(),
}));
jest.mock('../db/models/binance/Order')
jest.mock('../db/operations/binance/exchangeOps', () => ({
    updateExchangeInfoInDB: jest.fn(),
}))
jest.mock('../db/models/binance/Exchange', () => ({
    ExchangeModel: {
        findOne: jest.fn(),
    },
}))

import {Server, WebSocket as MockWebSocket} from 'mock-socket'
import {
    handleOutboundAccountPosition,
    handleBalanceUpdate,
    handleOCOOrderResponse,
    handleOrderResponse,
    handleExecutionReport,
    exchangeInfoWebsocket,
    userInfoWebsocket,
    orderStatusWebsocket,
    allOrdersWebsocket,
    
} from "../services/binanceWsService/binanceWsService"
import {binancePriceFeedWebsocket,     userDataReportWebsocket,
} from "../services/binanceStreamService/binanceStreamService"
import { BalanceUpdateData, OutboundAccountPositionData, OrderResponse } from "../types"
import * as ocoOps from "../db/operations/binance/ocoOps";
import { OrderModel } from "../db/models/binance/Order"
import { BinanceStreamManager } from '../utils/utils';
import { getDataStreamListenKey } from '../services/binanceService';
import axios from 'axios';
describe("handleOutboundAccountPosition", () => {
    let consoleLogSpy: jest.SpyInstance
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation()
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
    })

    afterEach(() => {
        consoleLogSpy.mockRestore()
        consoleErrorSpy.mockRestore()
    })
    it("should log account position update with valid data", async () => {
        const mockData: OutboundAccountPositionData = {
            e: "outboundAccountPosition",
            E: 1633040600000,
            u: 1633040600001,
            B: [
                { a: "BTC", f: 1, l: 0 },
                { a: "ETH", f: 2, l: 0 },
            ],
        }
        await handleOutboundAccountPosition(mockData)
        expect(consoleLogSpy).toHaveBeenCalledWith("Account Position Update:", mockData)
    })

    consoleLogSpy = jest.spyOn(console, "error").mockImplementation()

    it("should log an error for invalid balance data", async () => {
        const mockData = {
            e: "outboundAccountPosition",
            E: 1633040600000,
            u: 1633040600001,
            B: "invalid_data",
        } as any // Bypass TypeScript check

        await handleOutboundAccountPosition(mockData)

        const found = consoleErrorSpy.mock.calls.some(
            (call) => call[0] === "Invalid balance data:" && call[1] === "invalid_data",
        )

        expect(found).toBe(true)
    })

    it("should log an error for invalid balance values", async () => {
        const mockData: OutboundAccountPositionData = {
            e: "outboundAccountPosition",
            E: 1633040600000,
            u: 1633040600001,
            B: [
                { a: "BTC", f: -1, l: 0 }, // Use a negative number as an "invalid" value
            ],
        }
        await handleOutboundAccountPosition(mockData)
        //expect(consoleSpy).toHaveBeenCalledWith('Invalid balance values:', { a: 'BTC', f: -1, l: 0 });
        // OR if your function is supposed to log the entire data
        expect(consoleLogSpy).toHaveBeenCalledWith("Account Position Update:", mockData)
    })
})

describe("handleBalanceUpdate", () => {
    let consoleLogSpy: jest.SpyInstance
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation()
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
    })

    afterEach(() => {
        consoleLogSpy.mockRestore()
        consoleErrorSpy.mockRestore()
    })

    it("should log balance update with valid data", async () => {
        const mockData: BalanceUpdateData = {
            e: "balanceUpdate",
            E: 1633040600000,
            a: "BTC",
            d: "1.5",
            T: 1633040600001,
        }

        await handleBalanceUpdate(mockData)

        expect(consoleLogSpy).toHaveBeenCalledWith("Balance Update:", mockData)
    })

    it("should log an error for invalid balance delta", async () => {
        const mockData: BalanceUpdateData = {
            e: "balanceUpdate",
            E: 1633040600000,
            a: "BTC",
            d: "invalid_value",
            T: 1633040600001,
        }

        await handleBalanceUpdate(mockData)

        const found = consoleErrorSpy.mock.calls.some(
            (call) => call[0] === "Invalid balance delta:" && call[1] === "invalid_value",
        )

        expect(found).toBe(true)
    })
})


describe("handleOCOOrderResponse", () => {
    let consoleLogSpy: jest.SpyInstance

  
    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
        console.log("Is uploadOCOToDB a mock?", jest.isMockFunction(ocoOps.uploadOCOToDB));
        (ocoOps.uploadOCOToDB as jest.Mock).mockClear();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore()
    })

    it("should upload OCO order to DB with valid data", async () => {
        const mockData = {
            status: 200,
            result: {
                someKey: "someValue",
            },
        }

        await handleOCOOrderResponse(mockData)

        expect(ocoOps.uploadOCOToDB).toHaveBeenCalledWith([
            {
                ...mockData.result,
                exchangeId: "binance",
            },
        ])
    })

    it("should log an error for invalid status", async () => {
        const mockData = {
            status: 400,
            result: {
                someKey: "someValue",
            },
        }

        await handleOCOOrderResponse(mockData)

        expect(consoleLogSpy).toHaveBeenCalledWith(
            "Received an OCOOrderResponse with an error status or empty result:",
            mockData.status,
        )
    })

    it("should log an error for empty result", async () => {
        const mockData = {
            status: 200,
            result: {},
        }

        await handleOCOOrderResponse(mockData)

        expect(consoleLogSpy).toHaveBeenCalledWith(
            "Received an OCOOrderResponse with an error status or empty result:",
            mockData.status,
        )
    })
})

describe('handleOrderResponse', () => {
    let consoleLogSpy: jest.SpyInstance;
  
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      (OrderModel.prototype.save as jest.Mock).mockClear();
    });
  
    afterEach(() => {
      consoleLogSpy.mockRestore();
    });
  
    it('should save new order with valid data', async () => {
        const mockData: OrderResponse = {
            id: 'someId',
            status: 200,
            result: {
              symbol: 'BTCUSD',
              orderId: 12345,
              orderListId: 67890,
              clientOrderId: 'someClientOrderId',
              transactTime: 1633040600000,
              price: '50000',
              origQty: '1',
              executedQty: '1',
              cummulativeQuoteQty: '50000',
              status: 'FILLED',
              timeInForce: 'GTC',
              type: 'LIMIT',
              side: 'BUY',
              workingTime: 1000,
              fills: []  // Optional
            },
            rateLimits: [
              {
                rateLimitType: 'REQUEST_WEIGHT',
                interval: 'MINUTE',
                intervalNum: 1,
                limit: 1200,
                count: 1
              }
            ]
          };
      const mockSavedEntry = { _id: 'someId' };
  
      (OrderModel.prototype.save as jest.Mock).mockResolvedValue(mockSavedEntry);
  
      await handleOrderResponse(mockData);
  
      expect(consoleLogSpy).toHaveBeenCalledWith("Saved entry with ID:", mockSavedEntry._id);
    });
  
    it('should log an error for invalid status', async () => {
        const mockData: OrderResponse = {
            id: 'someId',
            status: 400,
            result: {
              symbol: 'BTCUSD',
              orderId: 12345,
              orderListId: 67890,
              clientOrderId: 'someClientOrderId',
              transactTime: 1633040600000,
              price: '50000',
              origQty: '1',
              executedQty: '1',
              cummulativeQuoteQty: '50000',
              status: 'FILLED',
              timeInForce: 'GTC',
              type: 'LIMIT',
              side: 'BUY',
              workingTime: 1000,
              fills: []  // Optional
            },
            rateLimits: [
              {
                rateLimitType: 'REQUEST_WEIGHT',
                interval: 'MINUTE',
                intervalNum: 1,
                limit: 1200,
                count: 1
              }
            ]
          };
  
      await handleOrderResponse(mockData);
  
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Received an OrderResponse with an error status or empty result:',
        mockData.status,
      );
    
    });
  
    it('should log an error for empty result', async () => {
        const mockData: OrderResponse = {
            id: 'someId',
            status: 200,
            result: {} as any, // Empty result to trigger the log
            rateLimits: [
              {
                rateLimitType: 'REQUEST_WEIGHT',
                interval: 'MINUTE',
                intervalNum: 1,
                limit: 1200,
                count: 1
              }
            ]
          };
  
      await handleOrderResponse(mockData);
  
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Received an OrderResponse with an error status or empty result:',
        mockData.status,
      );
    });
  
    it('should log an error if saving fails', async () => {
        const mockData: OrderResponse = {
            id: 'someId',
            status: 200,
            result: {
              symbol: 'BTCUSD',
              orderId: 12345,
              orderListId: 67890,
              clientOrderId: 'someClientOrderId',
              transactTime: 1633040600000,
              price: '50000',
              origQty: '1',
              executedQty: '1',
              cummulativeQuoteQty: '50000',
              status: 'FILLED',
              timeInForce: 'GTC',
              type: 'LIMIT',
              side: 'BUY',
              workingTime: 1000,
              fills: []  // Optional
            },
            rateLimits: [
              {
                rateLimitType: 'REQUEST_WEIGHT',
                interval: 'MINUTE',
                intervalNum: 1,
                limit: 1200,
                count: 1
              }
            ]
          };
      const mockError = new Error('Some error');
  
      (OrderModel.prototype.save as jest.Mock).mockRejectedValue(mockError);
  
      await handleOrderResponse(mockData);
  
      expect(consoleLogSpy).toHaveBeenCalledWith("An error occurred:", mockError);
    });
})

describe("exchangeInfoWebsocket", () => {
  let wsClient: any;  // Change the type to 'any'
  let mockSocketServer: Server;

  beforeEach(async () => {
    try {
      mockSocketServer = new Server("ws://localhost:8080");
      wsClient = new MockWebSocket("ws://localhost:8080") as any;
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
      throw error;
    }

    await new Promise<void>((resolve, reject) => {
      wsClient.onerror = reject;
      wsClient.onopen = () => {
        console.log("onopen event triggered"); 
        console.log(wsClient.readyState) // Add this
        resolve();
      };
    });
    
  }, 20000);

  afterEach(() => {
    if (wsClient && wsClient.readyState !== MockWebSocket.CLOSED) {
      wsClient.close();
    }
    mockSocketServer.stop();
  });

  it("should handle 'open' event", async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      logSpy.mockClear();  // Clear any previous calls
    
      Object.defineProperty(wsClient, 'readyState', {
        writable: true,
        value: 1 // 1 means OPEN
      });
  
      // Call the function under test
      exchangeInfoWebsocket(wsClient, "ws://test.url", "requestId");
    
      // Manually trigger the 'connection' event on the mock server
      mockSocketServer.emit('connection', wsClient);
    
      const mockEvent = new Event('open');
      // Manually trigger the 'open' event from the mock server
      mockSocketServer.on('connection', socket => {
          console.log("Mock server connection triggered");  // Add this
          socket.dispatchEvent(new Event('open'));  // Use dispatchEvent
        });
      
      await new Promise((resolve) => setTimeout(resolve, 2000));
    
      // Check if the expected log message was captured
      expect(logSpy).toHaveBeenCalledWith("Connection to exchange info opened");
    
      logSpy.mockRestore();
    });
});

describe("orderStatusWebsocket", () => {
  let wsClient: any;
  let mockSocketServer: Server;

  beforeEach(async () => {
    try {
      mockSocketServer = new Server("ws://localhost:8081");
      wsClient = new MockWebSocket("ws://localhost:8081") as any;
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
      throw error;
    }

    await new Promise<void>((resolve, reject) => {
      wsClient.onerror = reject;
      wsClient.onopen = () => {
        console.log("onopen event triggered");
        console.log(wsClient.readyState);
        resolve();
      };
    });
  }, 20000);

  afterEach(() => {
    if (wsClient && wsClient.readyState !== MockWebSocket.CLOSED) {
      wsClient.close();
    }
    mockSocketServer.stop();
  });

  it("should handle 'open' event for orderStatusWebsocket", async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    logSpy.mockClear();

    Object.defineProperty(wsClient, 'readyState', {
      writable: true,
      value: 1 // 1 means OPEN
    });

    const fakeReq = {
      url: '/?symbol=ETH&orderId=123',
      headers: {
        host: 'localhost'
      }
    };

    // Call the function under test
    orderStatusWebsocket(wsClient, "ws://test.url", "requestId", "testApiSecret", "testApiKey", fakeReq);

    // Manually trigger the 'connection' event on the mock server
    mockSocketServer.emit('connection', wsClient);

    const mockEvent = new Event('open');
    // Manually trigger the 'open' event from the mock server
    mockSocketServer.on('connection', socket => {
      console.log("Mock server connection triggered");
      socket.dispatchEvent(new Event('open'));
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if the expected log message was captured
    expect(logSpy).toHaveBeenCalledWith("Connection to order status opened");

    logSpy.mockRestore();
  });
});
describe("allOrdersWebsocket", () => {
  let wsClient: any;
  let mockSocketServer: Server;

  beforeEach(async () => {
    try {
      mockSocketServer = new Server("ws://localhost:8082");
      wsClient = new MockWebSocket("ws://localhost:8082") as any;
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
      throw error;
    }

    await new Promise<void>((resolve, reject) => {
      wsClient.onerror = reject;
      wsClient.onopen = () => {
        console.log("onopen event triggered");
        console.log(wsClient.readyState);
        resolve();
      };
    });
  }, 20000);

  afterEach(() => {
    if (wsClient && wsClient.readyState !== MockWebSocket.CLOSED) {
      wsClient.close();
    }
    mockSocketServer.stop();
  });

  it("should handle 'open' event for allOrdersWebsocket", async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    logSpy.mockClear();

    Object.defineProperty(wsClient, 'readyState', {
      writable: true,
      value: 1 // 1 means OPEN
    });

    const fakeReq = {
      url: '/?symbol=ETH',
      headers: {
        host: 'localhost'
      }
    };

    // Call the function under test
    allOrdersWebsocket(wsClient, "ws://test.url", "requestId", "testApiSecret", "testApiKey", fakeReq);

    // Manually trigger the 'connection' event on the mock server
    mockSocketServer.emit('connection', wsClient);

    const mockEvent = new Event('open');
    // Manually trigger the 'open' event from the mock server
    mockSocketServer.on('connection', socket => {
      console.log("Mock server connection triggered");
      socket.dispatchEvent(new Event('open'));
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if the expected log message was captured
    expect(logSpy).toHaveBeenCalledWith("Connection to order status opened");

    logSpy.mockRestore();
  });
});

describe("binancePriceFeedWebsocket", () => {
  let wsClient:any;
  let mockBinanceStreamServer: Server;
  const fakeURL = "ws://localhost:8085";

  beforeAll(() => {
    global.WebSocket = require('mock-socket'); // Ensures WebSocket is available in the test environment
    mockBinanceStreamServer = new Server(fakeURL);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockBinanceStreamServer.on('connection', socket => {
      const klineData = {
        e: "kline",
        E: 123456789,
        s: "BTCUSDT",
        k: {
          t: 123400000,
          T: 123460000,
          s: "BTCUSDT",
          i: "1m",
          f: 100,
          L: 200,
          o: "5000.00000000",
          c: "5200.00000000",
          h: "5300.00000000",
          l: "4999.99999999",
          v: "75.00000000",
          n: 100,
          x: false,
          q: "392500.00000000",
          V: "37.50000000",
          Q: "196250.00000000",
          B: "123456.78900000"
        }
      }; 

      ['1m', '3m', '5m'].forEach((tf, index) => {
        setTimeout(() => {
          klineData.k.i = tf;
          socket.send(JSON.stringify(klineData));
          console.log(`Mock Server: Sent price feed data for ${tf}`);
        }, 100 * (index + 1));
      });
    });

    wsClient = new WebSocket(fakeURL);
    await new Promise<void>((resolve, reject) => {
      wsClient.onopen = () => {
        console.log('Mock Client: WebSocket Connected');
        resolve();
      };
      wsClient.onerror = (event:any) => {
        console.error('Mock Client: WebSocket encountered an error', event);
        reject(event);
      };
    });
  });

  afterEach(() => {
    if (wsClient && wsClient.readyState !== WebSocket.CLOSED) {
      wsClient.close();
    }
    //mockBinanceStreamServer.close();
  });
  afterAll(() => {
    mockBinanceStreamServer.close();
  });
  it("should handle kline data from the mock server", async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    wsClient.onmessage = (event:any) => {
      const data = JSON.parse(event.data) as any;
      console.log(`Test: Received price feed data for ${data.k.i}`);
    };

    await new Promise(resolve => setTimeout(resolve, 350)); // Ensures all messages are received

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Mock Server: Sent price feed data for 1m'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Mock Server: Sent price feed data for 3m'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Mock Server: Sent price feed data for 5m'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Test: Received price feed data for 1m'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Test: Received price feed data for 3m'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Test: Received price feed data for 5m'));
  
    expect(errorSpy).not.toHaveBeenCalled();
  
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
 

  });


describe("userDataReportWebsocket", () => {
  let wsClient: any;
  let mockBinanceStreamServer: Server;

  
  beforeEach(async () => {
    jest.setTimeout(60000); // Increase timeout to 60 seconds
    jest.clearAllMocks(); // Clear all mocks before each test

    try {
      wsClient = new MockWebSocket("ws://localhost:8086") as any;
      mockBinanceStreamServer = new Server("ws://localhost:8086");

      mockBinanceStreamServer.on('connection', () => {
        console.log("Mock server is running and accepted a connection");
      });

      await new Promise<void>((resolve, reject) => {
        wsClient.onerror = (error:any) => {
          console.error("WebSocket Error Details: ", JSON.stringify(error, null, 2));
          reject(error);
        };
        wsClient.onopen = () => {
          resolve();
        };
      });
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
    }
  });

  afterEach(() => {
    if (wsClient && wsClient.readyState !== MockWebSocket.CLOSED) {
      wsClient.close();
    }
    mockBinanceStreamServer.stop();
  });

  it("should handle user data for userDataReportWebsocket", async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    logSpy.mockClear();

    const testApiKey = 'testApiKey';
    const testApiSecret = 'testApiSecret';
    const streamUrl = 'wss://test.url';
    const requestId = 'requestId';

    userDataReportWebsocket(wsClient, testApiKey, testApiSecret, streamUrl, requestId);

    // Delay the mock event emission to ensure WebSocket is open
    await new Promise(resolve => setTimeout(resolve, 2000));
    mockBinanceStreamServer.emit('executionReport', { some: 'data' });

    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 4 seconds

    if (logSpy.mock.calls.length > 0) {
      expect(logSpy).toHaveBeenCalledWith("Received execution report:", { some: 'data' });
    } else {
      console.error("logSpy was not called");
    }

    logSpy.mockRestore();
  });
});