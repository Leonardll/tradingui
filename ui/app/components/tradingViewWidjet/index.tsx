"use client"
import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import {Listbox, Transition} from '@headlessui/react'
export interface CandleData {
    time: Time  // Unix Timestamp or TradingView's time string format
    open: number;
    high: number;
    low: number;
    close: number;
}

interface TradingViewWidgetProps {
  symbol: string;
  interval: string;
  theme: 'light' | 'dark';
  // Add more props as needed...
}

interface ChartProps {
    data: Array<{ time: Time; open: number; high: number; low: number; close: number }>;
  }
  
  const Chart: React.FC<ChartProps> = ({ data }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chart = useRef<IChartApi | null>(null);
    const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState('1m'); // Default timeframe
    const handleTimeframeChange = (timeframe: string) => {
        setSelectedTimeframe(timeframe);
        // Additional logic to re-fetch data based on the new timeframe
    };
    useEffect(() => {
        if (chartContainerRef.current && !chart.current) {
            chart.current = createChart(chartContainerRef.current, {
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                timeScale: {
                    visible: true,
                    timeVisible: true,
                    secondsVisible: true,
                },
                layout: {
                    textColor: '#d1d4dc',
                }
            });
            
            series.current = chart.current.addCandlestickSeries({
                priceScaleId: 'right',
                priceFormat: {
                    type: 'price',
                    precision: 2,
                    minMove: 0.01,
                },
            });

            chart.current.priceScale('right').applyOptions({
                scaleMargins: {
                    top: 0.3,
                    bottom: 0.25,
                },
                borderVisible: false,
            });

            series.current.setData(data);
        }

        return () => {
            chart.current?.remove();
            chart.current = null;
        };
    }, []);

    useEffect(() => {
        series.current?.setData(data);
    }, [data]);

    return (
        <>
        <Listbox value={selectedTimeframe} onChange={handleTimeframeChange}>
            <Listbox.Button onClick={() => handleTimeframeChange('1m')}>Timeframe</Listbox.Button>
            <Listbox.Options>
                <Listbox.Option value="1m">1m</Listbox.Option>
                <Listbox.Option value="5m">5m</Listbox.Option>
                <Listbox.Option value="1h">1h</Listbox.Option>
            </Listbox.Options>
            {/* Add more timeframe buttons as needed */}
        </Listbox>
        <div ref={chartContainerRef} style={{ width: '100%', height: '800px' }} suppressHydrationWarning={true}></div>
    </>

    )

};

export default Chart;

  

