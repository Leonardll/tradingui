import WebSocket from 'ws';
import { Observable } from 'rxjs';
import { IDataFeed, BinancePriceFeedMessage } from '../types';
import { binancePriceFeedWebsocket } from '../services/binanceWsService/binanceWsService';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const websocketUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL || 'wss://testnet.binance.vision/ws';

export class TaPriceFeed implements IDataFeed {
  getPriceFeed(symbol: string, timeframes: string[]): Observable<BinancePriceFeedMessage> {
    return new Observable<BinancePriceFeedMessage>(observer => {
      // Initialize your WebSocket connection here
      const wsClient = new WebSocket(`${websocketUrl}/${symbol.toLowerCase()}@trade`);

      // Assuming binancePriceFeedWebsocket is imported or defined
      binancePriceFeedWebsocket(wsClient, websocketUrl, 'req', 'listenkey', (data: BinancePriceFeedMessage) => {
        observer.next(data);
      });

      return () => {
        wsClient.close();
      };
    });
  }
}
