// // export const dynamicParams = true;
// export const runtime = 'nodejs'

import { withApiAuthRequired, getSession } from "@auth0/nextjs-auth0"
import { NextResponse } from "next/server"
import crypto from "crypto"

const apiKey = process.env.BINANCE_API_KEY
const apiSecret = process.env.BINANCE_SECRET_KEY

const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY

const binanceUrl = process.env.BINANCE_URL
const binanceTestUrl = process.env.BINANCE_TEST_URL

async function fetchWithTimeout(resource: string, options: object, timeout = 1000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(resource, { ...options, signal: controller.signal })
    clearTimeout(id)

    return response
}

// Fetch the lot size and price filter
async function getFilters(symbol: string) {
    const response = await fetch(`${binanceTestUrl}/exchangeInfo`)
    const exchangeInfo = await response.json()
    const symbolInfo = exchangeInfo.symbols.find((s:any) => s.symbol === symbol)

    const lotSizeFilter = symbolInfo.filters.find((f:any) => f.filterType === "LOT_SIZE")
    const priceFilter = symbolInfo.filters.find((f:any) => f.filterType === "PRICE_FILTER")

    return { lotSizeFilter, priceFilter }
}

function roundToPrecision(num: number, precision: number) {
    const factor = Math.pow(10, precision)
    return Math.round(num * factor) / factor
}

export const POST = async (req: any) => {
    if (!apiSecret) {
        throw new Error("API secret is not defined!")
    }

    // let timeRes = await fetch("https://api.binance.com/api/v3/time")
    // let timeData = await timeRes.json()

    const body = await req.json()

    if (!body || !body.symbol || !body.side || !body.quantity || !body.price || !body.type) {
        throw new Error("Invalid request body!")
    }

    const { symbol, side, type, quantity, price } = body
    const { lotSizeFilter, priceFilter } = await getFilters(symbol)

    // calculate precision for quantity and price
    const quantityPrecision =
        parseFloat(lotSizeFilter.stepSize).toString().split(".")[1]?.length || 0
    const pricePrecision = parseFloat(priceFilter.tickSize).toString().split(".")[1]?.length || 0

    // adjust quantity and price to the correct precision
    let adjustedQuantity = roundToPrecision(parseFloat(quantity), quantityPrecision)
    let adjustedPrice = roundToPrecision(parseFloat(price), pricePrecision)

    // create the base query string
    let queryString = `symbol=${symbol}&side=${side}&type=${type}&quantity=${adjustedQuantity}`

    // Add price if order is not MARKET type
    if (type !== "MARKET") {
        queryString += `&price=${adjustedPrice}`

        // Logic to apply time in force only for limit orders
        const timeInForce = body.timeInForce ? body.timeInForce : "GTC"
        queryString += `&timeInForce=${timeInForce}`
    }

    // Logic to apply time in foroce only for limit orders

    // Create signature
    let timestamp = Date.now()
    const recvWindow = "50000"
    // Add timestamp and recvWindow
    queryString += `&recvWindow=${recvWindow}&timestamp=${timestamp}`
    const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex")

    console.log(timestamp)
    console.log("hashing the string for custom order: ")
    console.log(`timestamp=${queryString}`)
    console.log("and return:", signature)

    // Fetch binane order api with signature

    try {
        console.log(
            `Sending request to Binance API with URL: ${binanceTestUrl}/order?${queryString}&signature=${signature}`,
        )

        let response = await fetchWithTimeout(
            `${binanceTestUrl}/order?${queryString}&signature=${signature}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-MBX-APIKEY": testApiKey,
                },
             
            },
            5000,
        )

        if (response.ok) {
            const data = await response.json()
            console.log("Response from Binance API:", data)
            console.log("body data", body)
            return NextResponse.json({ data })
        } else {
            try {
                const errordata = await response.json()
                console.error("Error response from Binance API:", errordata)
            } catch (e: any) {
                console.error("Failed to parse error response from Binance API:", e)
                return NextResponse.json({ error: e.message })
            }
        }
    } catch (error: any) {
        console.error(error)
        return NextResponse.json({ error: error.message })
    }
}

export default withApiAuthRequired(POST)
