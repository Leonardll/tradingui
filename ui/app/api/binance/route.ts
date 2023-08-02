//export const runtime = 'edge'
import { withApiAuthRequired } from "@auth0/nextjs-auth0"
import { NextResponse } from "next/server"
import crypto from "crypto"

type ResponseData = {
    message: string
    error: string
    response: string
}

type header = {
    "Content-Type": string
    "API-Key": string
    "X-MBX-APIKEY": string
}

type timeout = {
    url: string
    options: string
    timeout: number
}

const apiKey = process.env.BINANCE_API_KEY
const apiSecret = process.env.BINANCE_SECRET_KEY

const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY
const binanceUrl = process.env.BINANCE_URL
const binanceTestUrl = process.env.BINANCE_TEST_URL


async function fetchWithTimeout(resource, options, timeout = 1000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(resource, { ...options, signal: controller.signal })
    clearTimeout(id)

    return response
}

export const GET = async () => {
    if (!testApiSecret) {
        throw new Error("API secret is not defined!")
    }
    // Fetch server time from Binance and calculate latency
    const start = Date.now()
    let timeRes = await fetch(`${binanceTestUrl}/time`)
    let timeData = await timeRes.json()
    const end = Date.now()
    const latency = end - start

    // Calculate the offset between your system time and Binance's server time
    const serverTime = timeData.serverTime
    const localTime = start + Math.round(latency / 2)
    const timeOffset = serverTime - localTime

 

    // Create signature
    let timestamp = Date.now()
    const recvWindow = "50000"
    const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`
    const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex")

    console.log(timestamp)
    console.log("hashing the string: ")
    console.log(`timestamp=${queryString}`)
    console.log("and return:", signature)
    let res = await fetchWithTimeout(
        `${binanceTestUrl}/account?${queryString}&signature=${signature}`,
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MBX-APIKEY": testApiKey,
            },
        },
        5000,
    )
    const data = await res.json()

    return NextResponse.json({ data })
}

export default withApiAuthRequired(GET)
