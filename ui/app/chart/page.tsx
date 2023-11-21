"use client"
import React, { useEffect, useState } from "react"   
import { createChart, IChartApi, ISeriesApi, Time} from 'lightweight-charts';
import dynamic from 'next/dynamic';
import { CandleData } from '../components/tradingViewWidjet';
const Chart = dynamic<TradingViewChartProps>(() => import('../components/tradingViewWidjet'), { ssr: false });

  
interface TradingViewChartProps {
    data: CandleData[]; 
    suppressHydrationWarning?: boolean // Using the CandleData interface for the data prop
}
interface KlineData {
    t: number; // Open time
    o: string; // Open price
    h: string; // High price
    l: string; // Low price
    c: string; // Close price
    i: string; // Interval
    // Add other properties as needed
}

interface WebSocketMessage {
    e: string;
    E: number;
    s: string;
    k: KlineData;
}



// MainPage.tsx
const MyPage: React.FC = () => {
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1m'); // Default timeframe
  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
    // Additional logic to re-fetch data based on the new timeframe
};
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4001/binancePriceFeed?symbol=btcusdt&timeframes=1s,1m,5m');
    ws.onopen = () => console.log('WebSocket Connected');
    ws.onerror = (error) => console.error('WebSocket Error: ', error);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WebSocketMessage;

      if (message.e === 'kline' && message.k.i === selectedTimeframe) {
        const newCandle: CandleData = {
        time: message.k.t as unknown as Time, // Adjust based on the Time type
        open: parseFloat(message.k.o),
        high: parseFloat(message.k.h),
        low: parseFloat(message.k.l),
        close: parseFloat(message.k.c)
        };

        setCandleData(prevData => {
          // Combine and sort data
          const combinedData = [...prevData, newCandle].sort((a, b) =>( a.time as number )- (b.time as number));

          // Deduplicate: Keep only the latest for each timestamp
          const deduplicatedData = combinedData.reduce<CandleData[]>((acc, current) => {
            const index = acc.findIndex(item => item.time === current.time);
            if (index >= 0) {
              acc[index] = current; // Replace with the latest data
            } else {
              acc.push(current);
            }
            return acc;
          }, []);

          return deduplicatedData;
        });
      }
    };

    return () => ws.close();
  }, [selectedTimeframe]);
  const timeframes = ['1s', '1m', '5m'];

  return (
    <div>
        <select value={selectedTimeframe} onChange={e => handleTimeframeChange(e.target.value)}>
    {timeframes.map(timeframe => (
      <option key={timeframe} value={timeframe}>{timeframe}</option>
    ))}
  </select>
        <Chart data={candleData} suppressHydrationWarning={true} />
    </div>
  );
  {/* Timeframe selector and other UI components */}
    {/* <DataSelector
      onTimeframeChange={setTimeframe}
      onExchangeChange={setExchange}
    /> */}
};
  
  export default MyPage;



