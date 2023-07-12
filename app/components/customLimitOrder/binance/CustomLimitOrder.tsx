'use client'
import React, { use, useState,useEffect} from 'react';
import { useWebSocket }from '../../../hooks/useWebSocket';




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
  price?: number;
  stopPrice: number;
  takeProfitPrice: number;
  balances: number;
  icebergQty?: number;
  timeInForce?: string; 

};



const CustomLimitOrder =   () => {
  // const [order, setOrder] = useState(null);
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState('BUY');
  const [type, setType] = useState('LIMIT');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [icebergQty, setIcebergQty] = useState('');
  const [timeInForce, setTimeInForce] = useState<string | null>('GTC');
  const [balances, setBalances] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  // const [recvWindow, setRecvWindow] = useState('5000');
   const [stopPrice, setStopPrice] = useState('');
   const [debouncedSymbol, setDebouncedSymbol] = useState("");
; // delays update by 500ms

  const {data, error } = useWebSocket(debouncedSymbol)

  useEffect(() => {
    if (data) {
        const parsedData = JSON.parse(data);
        if (parsedData.eventType === "executionReport" && parsedData.orderStatus === "FILLED") {
            console.log("Limit order filled, placing OCO order...");

            // The body for your OCO order
            let ocoOrder: OCOOrder = {
                symbol: symbol,
                side: side,
                stopPrice: stopPrice === "" ? 0 : parseFloat(stopPrice),
                takeProfitPrice: takeProfitPrice === "" ? 0 : parseFloat(takeProfitPrice),
                quantity: quantity === "" ? 0 : parseFloat(quantity)
            };

            // The API request to place the OCO order
            fetch(
                '/api/binance/customOCOOrder',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(ocoOrder),
                }
            )
            .then(res => res.json())
            .then(data => console.log(data))
            .catch(err => console.log(err));
        }
    }
}, [data]);
  useEffect(() => {
    // set up a delay
    const timerId = setTimeout(() => {
      setDebouncedSymbol(symbol);
    }, 1000);
  
    // clean up function
    return () => {
      clearTimeout(timerId);
    };
  }, [symbol]);


const handleOrderTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const newType = e.target.value;
  setType(newType);

  // If the new order type is "LIMIT", set timeInForce to "GTC", otherwise set it to null
  if (newType === "LIMIT") {
    setTimeInForce("GTC");
  } else {
    setTimeInForce(null);
  }
};

const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  let body: MyOrder = {
    symbol: symbol,
    side: side,
    type: type,
    quantity: quantity === "" ? 0 : parseFloat(quantity),
    stopPrice: stopPrice === "" ? 0 : parseFloat(stopPrice),
    takeProfitPrice: takeProfitPrice === "" ? 0 : parseFloat(takeProfitPrice),
    balances: balances === "" ? 0 : parseFloat(balances)
  };

  if (type === "LIMIT") {
    body.price = parseFloat(price);

    if (timeInForce) {
      body.timeInForce = timeInForce;
    }

    if (icebergQty !== "") {
      body.icebergQty = parseFloat(icebergQty);
    }
  }

  console.log(`Sending request to server with body:`, body);

  const response = fetch(
    '/api/binance/customOrder',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    })
    .then((res) => { 
      console.log('Response from server:', res);
      return res.json();
    })
    .then((data) => { 
      console.log(data);
      setSymbol(symbol);
    })
    .catch((err) => console.log(err));
      
  return response;
};


  return (
    <form onSubmit={ handleSubmit}>
      <div className="grid grid-rows-auto">

      <input
        className='p-2'
        type="text"
        placeholder="Symbol"
        value={symbol}
        onChange={(e) => {
          setSymbol(e.target.value)}}
      />
      <select
        className='p-2'
        name="side"
        defaultValue="BUY"
        onChange={(e) => setSide(e.target.value)}
      >
        <option value="BUY">Buy</option>
        <option value="SELL">Sell</option>
      </select>
      <select
      className='p-2'
      name="type"
      defaultValue="LIMIT"
      onChange={handleOrderTypeChange}
      >
       
        <option value="LIMIT">LIMIT</option>
        <option value="MARKET">MARKET</option>
      </select>
      <input
        className='p-2'
        type="number"
        placeholder="Quantity"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <input
        className='p-2'
        type="number"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        disabled={type === "MARKET"}

      />
      <input
        className='p-2'
      type='number'
      placeholder='IcebergQty'
      value={icebergQty}
      onChange={(e) => setIcebergQty(e.target.value)}
      disabled={type === "MARKET"}

      />
      <input className='p-2'
      type='number'
      placeholder='StopPrice'
      value = {stopPrice} 
      onChange = {(e) => setStopPrice(e.target.value)}
      />
      {/* <input
        type="number"
        placeholder="StopPrice"
        value={stopPrice}
        onChange={(e) => setStopPrice(e.target.value)}
      /> */}
      </div>
      <div className="flex flex-col justify-center ">

      <button 
      className=' p-2 bg-red-300 text-center'
      onClick={() => console.log(' button clicked')}
      type="submit"
   >Place Order</button>
      </div>

    </form>
  );

};

export default CustomLimitOrder;