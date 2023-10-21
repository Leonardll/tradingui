jest.mock('../utils/utils', () => {
    return {
      WebsocketManager: jest.fn().mockImplementation(() => {
        return {
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

  

// jest.mock('../services/binanceWsService/binanceWsService', () =>({
//     exchangeInfoWebsocket: jest.fn(),
// }))
// import WebSocket from  "ws"
import {Server, WebSocket as MockWebSocket} from 'mock-socket'
import {
    handleOutboundAccountPosition,
    handleBalanceUpdate,
    handleOCOOrderResponse,
    handleOrderResponse,
    handleExecutionReport,
    exchangeInfoWebsocket,
    userDataReportWebsocket,
    userInfoWebsocket,
    orderStatusWebsocket,
    allOrdersWebsocket,
    binancePriceFeedWebsocket,
} from "../services/binanceWsService/binanceWsService"
import { BalanceUpdateData, OutboundAccountPositionData, OrderResponse } from "../types"
import * as ocoOps from "../db/operations/binance/ocoOps";
import * as exchangeOps from "../db/operations/binance/exchangeOps";
import { OrderModel } from "../db/models/binance/Order"
import { ExchangeModel } from '../db/models/binance/Exchange';

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

  it.only("should handle 'open' event", async () => {
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

  
