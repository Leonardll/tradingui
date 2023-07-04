import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
// export const runtime = 'edge'

type ResponseData = {
  message: string;
  error: string;
  response: string;
};

type header = {
  'Content-Type': string;
  'API-Key': string;
  'X-MBX-APIKEY': string;
}

type timeout = {
  url: string;
  options: string;
  timeout: number;

}

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_SECRET_KEY;

 
async function fetchWithTimeout(resource, options, timeout = 1000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, { ...options, signal: controller.signal });
  clearTimeout(id);

  return response;
}

export const GET = async () => {

  if (!apiSecret) {
  throw new Error('API secret is not defined!');
  }
  // Fetch server time from Binance and calculate latency
  const start = Date.now();
  let timeRes = await fetch('https://api.binance.com/api/v3/time');
  let timeData = await timeRes.json();
  const end = Date.now();
  const latency = end - start;
  
  // Calculate the offset between your system time and Binance's server time
  const serverTime = timeData.serverTime;
  const localTime = start + Math.round(latency / 2);
  const timeOffset = serverTime - localTime;
  
  //  // exchangeInfo
  //  const exchange = await fetch('https://api.binance.com/api/v3/exchangeInfo');
  //  const exchangeData =  await exchange.json();
  
  //    // Fetch server time again
  // timeRes = await fetch('https://api.binance.com/api/v3/time');
  // timeData = await timeRes.json();
  // timestamp = timeData.serverTime;
  
  // Create signature
  let timestamp = Date.now()
  const recvWindow = '50000';
  const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', apiSecret)
  .update(queryString)
  .digest('hex');
  
  console.log(timestamp)
  console.log("hashing the string: ");
  console.log(`timestamp=${queryString}`);
  console.log("and return:", signature);
  let res = await fetchWithTimeout(`https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`, {
  method: 'GET',
  headers: {
  'Content-Type': 'application/json',
  'X-MBX-APIKEY': apiKey,
  
  
  },
  }, 5000);
  const data = await res.json();
  
  return NextResponse.json({ data});
  }

export default withApiAuthRequired(GET);
