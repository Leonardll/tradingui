//export const runtime ='edge';




import { NextResponse } from "next/server"

interface TimeData {
    serverTime: number
}

const binanceUrl = process.env.BINANCE_URL
const binanceTestUrl = process.env.BINANCE_TEST_URL
export async function GET() {
    const start = Date.now()
    let timeRes = await fetch(`${binanceUrl}/time`,{cache:'no-store'})
    let timeData = await timeRes.json() as TimeData
     if (!timeData) {
        throw new Error("No time data")
     }
    const end = Date.now()
    const latency = end - start
    const serverTime =  timeData.serverTime
    const localTime = start + Math.round(latency / 2)

    let res = await fetch(`${binanceUrl}/ticker/price`,{ cache: 'no-store' ,  next: { revalidate: 0 }})
    const data = await res.json()

    return NextResponse.json({ data, serverTime, localTime, latency, revalided:true, now:Date.now() })
}





