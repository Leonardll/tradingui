'use client'
import React, { use, useState} from 'react';
import { useEffect } from 'react';
import { NextResponse } from 'next/server';
import crypto from 'crypto';


import { useRouter } from 'next/navigation'

type Client = {
  apiKey: string;
  apiSecret: string;
  getTime: boolean;
};

type MyOrder = {
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  stopPrice: number;
  takeProfitPrice: number;
  balances: number;
};



const CustomLimitOrder =   () => {
  // const [order, setOrder] = useState(null);
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState('BUY');
  const [type, setType] = useState('LIMIT');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  // const [recvWindow, setRecvWindow] = useState('5000');
  // const [stopPrice, setStopPrice] = useState('10500');

  const handleSubmit =  (e) => {
    console.log(`Sending request to server with body:`, {
      symbol: symbol,
      side: side,
      type: type,
      quantity :quantity,
      price: price,
    });
    e.preventDefault();
    const response =  fetch(
      '/api/binance/customOrder',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: symbol,
          side: side,
          type: type,
          quantity :quantity,
          price: price,
        }),
      })
      .then((res) =>{ 
        console.log('Response from server:', res);
        res.json()
      })
      .then((data) => { console.log(data) })
      .catch((err) => console.log(err));

    return response;

  
  };

  return (
    <form onSubmit={ handleSubmit}>
      <input
        type="text"
        placeholder="Symbol"
        value={symbol}
        onChange={(e) => {
          setSymbol(e.target.value)}}
      />
      <select
        name="side"
        defaultValue="BUY"
        onChange={(e) => setSide(e.target.value)}
      >
        <option value="BUY">Buy</option>
        <option value="SELL">Sell</option>
      </select>
      <select
      name="type"
      defaultValue="LIMIT"
      onChange={(e) => setType(e.target.value)}
      >
        <option value="MARKET">Limit</option>
        <option value="LIMIT">Market</option>
      </select>
      <input
        type="number"
        placeholder="Quantity"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <input
        type="number"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
      />
      {/* <input
        type="number"
        placeholder="StopPrice"
        value={stopPrice}
        onChange={(e) => setStopPrice(e.target.value)}
      /> */}
      <button 
      onClick={() =>console.log(' button clicked')}
      type="submit"
   >Place Order</button>
    </form>
  );

};

export default CustomLimitOrder;