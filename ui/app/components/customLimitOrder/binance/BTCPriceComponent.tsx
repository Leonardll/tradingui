"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react';

function BTCPriceComponent() {
  const [btcPrice, setBtcPrice] = useState(null);
  const [symbol, setSymbol] = useState(null);

 
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000/priceFeed?symbol=btcusdt');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as any
      setBtcPrice(data.k.c);
      setSymbol(data.s);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    ws.onerror = (error) => {
      console.log('WebSocket Error:', error);
    };

    return () => {
      ws.close();
    };
  }, [])

  useEffect(() => {
    //console.log(btcPrice);
  }, [btcPrice]);


  return (
    <div>
     {` Current price for ${symbol}: ${btcPrice}`}
    </div>
  );
}

export default BTCPriceComponent;
