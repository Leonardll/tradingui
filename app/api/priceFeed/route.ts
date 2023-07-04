
import { NextResponse } from 'next/server';

//export const runtime ='edge';
  



export async function GET() {
const start = Date.now();
let timeRes = await fetch('https://api.binance.com/api/v3/time');
let timeData = await timeRes.json();
const end = Date.now();
const latency = end - start;
const serverTime = timeData.serverTime;
const localTime = start + Math.round(latency / 2);  

let res = await fetch('https://api.binance.com/api/v3/ticker/price')

const data = await res.json();

return NextResponse.json({ data, serverTime, localTime, latency});

}



