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

interface ExchangeInfo {
    symbols: { symbol: string }[];
    // include other properties as needed
  }
  
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

async function getOrdersForSymbol(symbol:any) {
    if (!testApiSecret) {
        throw new Error("API secret is not defined!");
    }

    // Fetch server time from Binance and calculate latency
    const start = Date.now();
    let timeRes = await fetch(`${binanceTestUrl}/time`);
    let timeData = await timeRes.json() as TimeData;
    const end = Date.now();
    const latency = end - start;

    // Calculate the offset between your system time and Binance's server time
    const serverTime = timeData.serverTime;
    const localTime = start + Math.round(latency / 2);
    const timeOffset = serverTime - localTime;

    // Create signature
    let timestamp = Date.now();
    const recvWindow = "50000";

    const queryString = `symbol=${symbol}&recvWindow=${recvWindow}&timestamp=${timestamp}`;
    const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");

    let res = await fetchWithTimeout(
        `${binanceTestUrl}/allOrders?${queryString}&signature=${signature}`,
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MBX-APIKEY": testApiKey,
            },
        },
        5000,
    );
    const data = await res.json();

    return data;
}

export const GET = async (req:unknown, res:unknown) => {
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
            const symbols:any = data?.symbols.map(symbolInfo => symbolInfo.symbol);

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
}

export default withApiAuthRequired(GET);



 