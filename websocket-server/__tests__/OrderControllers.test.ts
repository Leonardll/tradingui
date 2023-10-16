import { OrderController } from '../controllers/OrderControllers';
import * as binanceService from '../services/binanceService';

// Spy and mock the function
const executeMarketOrderSpy = jest.spyOn(binanceService, 'executeMarketOrderForBinance');
const executeLimitOrderSpy = jest.spyOn(binanceService, 'executeLimitOrderForBinance'); // Assuming this function exists

executeMarketOrderSpy.mockImplementation(() => Promise.resolve());
executeLimitOrderSpy.mockImplementation(() => Promise.resolve());

// Mock console methods
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();
global.console = {
  log: mockConsoleLog,
  error: mockConsoleError,
} as any;

// Cleanup after each test
afterEach(() => {
  // Reset the mock implementations to ensure there's no carryover between tests
  executeMarketOrderSpy.mockReset();
  mockConsoleLog.mockReset();
  mockConsoleError.mockReset();

  // Additional cleanup logic here, if needed
});


test('handleBinanceMarketOrder should call executeMarketOrderForBinance with correct arguments and log success', async () => {
  const mockWsClient = {} as any; // Mock WebSocket client
  const controller = new OrderController(mockWsClient, 'wsTestURL', 'testApiKey', 'testApiSecret');

  await controller.handleBinanceMarketOrder(mockWsClient, 'BTCUSDT', 'BUY', '0.1', 'requestId', 'testApiKey', 'testApiSecret');

  expect(executeMarketOrderSpy).toHaveBeenCalledWith(
    mockWsClient,
    'wsTestURL',
    'testApiKey',
    'testApiSecret',
    'BTCUSDT',
    'BUY',
    '0.1',
    'requestId',
  );
  expect(console.log).toHaveBeenCalledWith('Binance market order handled successfully');
});

test('handleBinanceMarketOrder should log error if executeMarketOrderForBinance throws', async () => {
  executeMarketOrderSpy.mockImplementationOnce(() => {
    throw new Error('Some error');
  });

  const mockWsClient = {} as any; // Mock WebSocket client
  const controller = new OrderController(mockWsClient, 'wsTestURL', 'testApiKey', 'testApiSecret');

  await controller.handleBinanceMarketOrder(mockWsClient, 'BTCUSDT', 'BUY', '0.1', 'requestId', 'testApiKey', 'testApiSecret');

  expect(console.error).toHaveBeenCalledWith('Error executing Binance market order:', new Error('Some error'));
});

// New Limit Order Tests
test('handleBinanceLimitOrder should call executeLimitOrderForBinance with correct arguments and log success', async () => {
    const mockWsClient = {} as any;
    const controller = new OrderController(mockWsClient, 'wsTestURL', 'testApiKey', 'testApiSecret');
  
    await controller.handleBinanceLimitOrder(mockWsClient, 'BTCUSDT', 'BUY', '0.1', '20000', 'requestId', 'testApiKey', 'testApiSecret');
  
    expect(executeLimitOrderSpy).toHaveBeenCalledWith(
      mockWsClient,
      'wsTestURL',
      'testApiKey',
      'testApiSecret',
      'BTCUSDT',
      'BUY',
      '0.1',
      '20000', // Price
      'requestId',
      50000
    );
    expect(console.log).toHaveBeenCalledWith('Binance limit order handled successfully');
  });
  
  test('handleBinanceLimitOrder should log error if executeLimitOrderForBinance throws', async () => {
    executeLimitOrderSpy.mockImplementationOnce(() => {
      throw new Error('Some limit order error');
    });
  
    const mockWsClient = {} as any;
    const controller = new OrderController(mockWsClient, 'wsTestURL', 'testApiKey', 'testApiSecret');
  
    await controller.handleBinanceLimitOrder(mockWsClient, 'BTCUSDT', 'BUY', '0.1', '20000', 'requestId', 'testApiKey', 'testApiSecret');
  
    expect(console.error).toHaveBeenCalledWith('Error executing Binance limit order:', new Error('Some limit order error'));
  });
