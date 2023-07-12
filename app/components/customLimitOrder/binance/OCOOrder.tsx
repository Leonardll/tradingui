// OCOOrder.tsx
import React, { useState } from 'react';

interface OCOOrderProps {
  symbol: string;
  quantity: number;
  stopPrice: number;
  stopLimitPrice: number;
  price: number;
}

export const OCOOrder = ({ symbol, quantity, stopPrice, stopLimitPrice, price }: OCOOrderProps) => {
  const [ocoOrder, setOcoOrder] = useState<OCOOrderProps | null>(null);

  const handleOCOSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // send the OCO order request to server
    console.log(`Sending OCO request to server with order:`, ocoOrder);

    const response = await fetch(
      '/api/binance/ocoOrder',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ocoOrder),
      }
    )
    const data = await response.json();

    console.log('Response from server:', data);
  };

  return (
    <form onSubmit={handleOCOSubmit}>
      {/* Render form inputs for OCO order here */}
    </form>
  );
}
