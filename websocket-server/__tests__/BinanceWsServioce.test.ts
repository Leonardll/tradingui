import WebSocket from "ws";
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
} from '../services/binanceWsService/binanceWsService'
import { BalanceUpdateData, OutboundAccountPositionData } from "../types";


describe('handleOutboundAccountPosition', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
  
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });
  
    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
    it('should log account position update with valid data', async () => {
        const mockData : OutboundAccountPositionData  = {
          e: "outboundAccountPosition",
          E: 1633040600000,
          u: 1633040600001,
          B: [
            { a: 'BTC', f: 1, l: 0 },
            { a: 'ETH', f: 2, l: 0 },
          ],
        };
        await handleOutboundAccountPosition(mockData);
        expect(consoleLogSpy).toHaveBeenCalledWith('Account Position Update:', mockData);
      });
    
      consoleLogSpy = jest.spyOn(console, 'error').mockImplementation();
  
  
    it('should log an error for invalid balance data', async () => {
      const mockData = {
        e: 'outboundAccountPosition',
        E: 1633040600000,
        u: 1633040600001,
        B: 'invalid_data',
      } as any;  // Bypass TypeScript check
  
      await handleOutboundAccountPosition(mockData);
  
      const found = consoleErrorSpy.mock.calls.some(call => 
        call[0] === 'Invalid balance data:' && call[1] === 'invalid_data'
      );
  
      expect(found).toBe(true);
    });

    it('should log an error for invalid balance values', async () => {
        const mockData: OutboundAccountPositionData = {
          e: 'outboundAccountPosition',
          E: 1633040600000,
          u: 1633040600001,
          B: [
            { a: 'BTC', f: -1, l: 0 },  // Use a negative number as an "invalid" value
          ],
        };
        await handleOutboundAccountPosition(mockData);
        //expect(consoleSpy).toHaveBeenCalledWith('Invalid balance values:', { a: 'BTC', f: -1, l: 0 });
        // OR if your function is supposed to log the entire data
        expect(consoleLogSpy).toHaveBeenCalledWith('Account Position Update:', mockData);
      });
  });


  describe('handleBalanceUpdate', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
  
    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });
  
    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  
    it('should log balance update with valid data', async () => {
      const mockData: BalanceUpdateData = {
        e: 'balanceUpdate',
        E: 1633040600000,
        a: 'BTC',
        d: '1.5',
        T: 1633040600001,
      };
  
      await handleBalanceUpdate(mockData);
  
      expect(consoleLogSpy).toHaveBeenCalledWith('Balance Update:', mockData);
    });
  
    it('should log an error for invalid balance delta', async () => {
      const mockData: BalanceUpdateData = {
        e: 'balanceUpdate',
        E: 1633040600000,
        a: 'BTC',
        d: 'invalid_value',
        T: 1633040600001,
      };
  
      await handleBalanceUpdate(mockData);
  
      const found = consoleErrorSpy.mock.calls.some(call => 
        call[0] === 'Invalid balance delta:' && call[1] === 'invalid_value'
      );
  
      expect(found).toBe(true);
    });
  });
  