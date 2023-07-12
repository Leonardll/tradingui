// // export const dynamicParams = true;
// export const runtime = 'nodejs'

import { withApiAuthRequired, getSession } from "@auth0/nextjs-auth0"
import { NextResponse } from "next/server"
import crypto from "crypto"

const apiKey = process.env.BINANCE_API_KEY
const apiSecret = process.env.BINANCE_SECRET_KEY

async function fetchWithTimeout(resource: string, options: object, timeout = 1000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(resource, { ...options, signal: controller.signal })
    clearTimeout(id)

    return response
}

export const POST = async (req: any) => {
    if (!apiSecret) {
        throw new Error("API secret is not defined!")
    }

    const start = Date.now()
    let timeRes = await fetch("https://api.binance.com/api/v3/time")
    let timeData = await timeRes.json()
    const end = Date.now()
    const latency = end - start

    const body = await req.json()

    if (
        !body ||
        !body.symbol ||
        !body.side ||
        !body.quantity ||
        !body.price ||
        !body.type ||
        !body.icebergQty
    ) {
        throw new Error("Invalid request body!")
    }

    const { symbol, side, type, quantity, price, icebergQty, stopPrice } = body
    // Create the base query string
    let queryString = `symbol=${symbol}&side=${side}&type=${type}&quantity=${quantity}`

    // Add price if order is not MARKET type
    if (type !== "MARKET") {
        queryString += `&price=${price}`
    }

    // Add icebergQty if it's not undefined
    if (icebergQty !== undefined) {
        queryString += `&icebergQty=${icebergQty}`
    }

    // Add stopPrice if it's not undefined
    if (stopPrice !== undefined) {
        queryString += `&stopPrice=${stopPrice}`
    }

    // Logic to apply time in foroce only for limit orders
    const timeInForce = type !== "MARKET" ? "GTC" : null
    // if (icebergQty) {
    //   queryString += `&icebergQty=${icebergQty}`;
    // }
    // Create signature
    let timestamp = Date.now()
    const recvWindow = "50000"
    // Add timestamp and recvWindow
    queryString += `&recvWindow=${recvWindow}&timestamp=${timestamp}`
    const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex")

    console.log(timestamp)
    console.log("hashing the string for custom order: ")
    console.log(`timestamp=${queryString}`)
    console.log("and return:", signature)

    // Fetch binane order api with signature

    try {
        console.log(
            `Sending request to Binance API with URL: https://api.binance.com/api/v3/order/test?${queryString}&signature=${signature}`,
        )

        let res = await fetchWithTimeout(
            `https://api.binance.com/api/v3/order/test?${queryString}&signature=${signature}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-MBX-APIKEY": apiKey,
                },
            },
            5000,
        )

        if (res.ok) {
            const data = await res.json()
            console.log("Response from Binance API:", data)
            console.log("body data", body)
            return NextResponse.json({ data })
        } else {
            try {
                const errordata = await res.json()
                console.error("Error response from Binance API:", errordata)
            } catch (e) {
                console.error("Failed to parse error response from Binance API:", e)
            }
        }
    } catch (error: any) {
        console.error(error)
        return NextResponse.json({ error: error.message })
    }
}

export default withApiAuthRequired(POST)
