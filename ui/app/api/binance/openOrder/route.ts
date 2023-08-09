// export const runtime = 'edge'
// export const fetchCache = 'auto'

import { withApiAuthRequired } from "@auth0/nextjs-auth0"
import { NextResponse } from "next/server"
import crypto from "crypto"


const apiKey = process.env.BINANCE_API_KEY
const apiSecret = process.env.BINANCE_SECRET_KEY
const binanceUrl = process.env.BINANCE_URL

const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY
const binanceTestUrl = process.env.BINANCE_TEST_URL

let exchangeInfo = null;

interface SymbolInfo {
    symbol: string;
    // include other properties as needed
}

type ExchangeInfo = SymbolInfo[];

interface TimeData {
    serverTime: number;
}
  

  
async function fetchWithTimeout(resource:any, options:any, timeout = 5000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(resource, { ...options, signal: controller.signal })
    clearTimeout(id)

    return response
}


async function getOrdersForSymbol(symbol: any) {
    try {
      // Define the URL of your Express app server route for orders
      const url = `http://localhost:4000/allOrders?symbol=${symbol}`;
  
      // Make a GET request to your server route
      const res = await fetch(url);
  
      // Check if the request was successful
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
  
      // Parse the response data as JSON
      const data = await res.json();
  
      return data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      return null;
    }
  }
  

 const GET =  withApiAuthRequired(async (req:unknown, res:unknown) => {
    if (!testApiSecret) {
        throw new Error("API secret is not defined!");
    }

 
 
    const getAllSymbols = async () => {

        try {
           

            const response = await fetch(`http://localhost:4000/exchangeInfo`);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json() as ExchangeInfo;
          //  console.log('Data from /exchangeInfo endpoint:', data[0]); // Add this line
            const symbols:any = data?.map(symbolInfo => symbolInfo.symbol);
            // console.log('symbols', symbols) 
            return symbols;
        } catch (error:any) {
            if (error.message.includes('429')) {
               NextResponse.json({error : 'Too many requests, please try again later.' }, { status: 429 })
            } else {
                NextResponse.json({error : 'Something went wrong, please try again later.' }, { status: 500 })
            }
            
            console.error('Error getting symbols:', error, error.message);
            return [];
        } 
    }
    let  symbols = await getAllSymbols();
    setInterval(async () => {
        symbols = await getAllSymbols();
    }, 60000);

    let allOrdersPromises = symbols.map((symbol:string) => getOrdersForSymbol(symbol));
    let allOrdersArrays = await Promise.all(allOrdersPromises);
    let allOrders = allOrdersArrays.flat();


    return NextResponse.json({ allOrders });
})

export {GET};



 