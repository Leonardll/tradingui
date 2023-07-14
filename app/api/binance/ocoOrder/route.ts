// export const runtime = 'nodejs'

import { withApiAuthRequired, getSession } from "@auth0/nextjs-auth0"
import { NextResponse } from "next/server"
import { saveOrderData, updateOrderData } from "@/app/utils/orderService";
import crypto from "crypto"
import { v4 as uuidv4 } from 'uuid';
const apiKey = process.env.BINANCE_API_KEY
const apiSecret = process.env.BINANCE_SECRET_KEY

async function fetchWithTimeout(resource: string, options: object, timeout = 1000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(resource, { ...options, signal: controller.signal })
    clearTimeout(id)

    return response
}

// Fetch the lot size and price filter
async function getFilters(symbol: string) {
    const response = await fetch("https://api.binance.com/api/v3/exchangeInfo")
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
    const body = await req.json()

    if (!body || !body.symbol || !body.side || !body.quantity || !body.price || !body.stopPrice || !body.stopLimitPrice) {
        throw new Error("Invalid request body!")
    }

    const { symbol, side, quantity, price, stopPrice, stopLimitPrice } = body
    const { lotSizeFilter, priceFilter } = await getFilters(symbol)

    // calculate precision for quantity and price
    const quantityPrecision =
        parseFloat(lotSizeFilter.stepSize).toString().split(".")[1]?.length || 0
    const pricePrecision = parseFloat(priceFilter.tickSize).toString().split(".")[1]?.length || 0

    // adjust quantity and price to the correct precision
    let adjustedQuantity = roundToPrecision(parseFloat(quantity), quantityPrecision)
    let adjustedPrice = roundToPrecision(parseFloat(price), pricePrecision)
    let adjustedStopPrice = roundToPrecision(parseFloat(stopPrice), pricePrecision)
    let adjustedStopLimitPrice = roundToPrecision(parseFloat(stopLimitPrice), pricePrecision)

    // create the base query string
    let queryString = `symbol=${symbol}&side=${side}&type=OCO&quantity=${adjustedQuantity}`

    queryString += `&price=${adjustedPrice}&stopPrice=${adjustedStopPrice}&stopLimitPrice=${adjustedStopLimitPrice}`
    

      // create unique client order ids
      const listClientOrderId = uuidv4();
      const limitClientOrderId = uuidv4();
      const stopClientOrderId = uuidv4();
  
      // add them to the query string
      queryString += `&listClientOrderId=${listClientOrderId}`;
      queryString += `&limitClientOrderId=${limitClientOrderId}`;
      queryString += `&stopClientOrderId=${stopClientOrderId}`;
  
      // handle newOrderRespType if provided
      const newOrderRespType = body.newOrderRespType ? body.newOrderRespType : null;
      if (newOrderRespType) {
          if (['ACK', 'RESULT', 'FULL'].includes(newOrderRespType)) {
              queryString += `&newOrderRespType=${newOrderRespType}`;
          } else {
              throw new Error("Invalid newOrderRespType. Valid values are 'ACK', 'RESULT', or 'FULL'");
          }
      }
  
    // Add timeInForce only for limit orders
    const timeInForce = body.timeInForce ? body.timeInForce : "GTC"
    queryString += `&timeInForce=${timeInForce}`

    // Create signature 
    let timestamp = Date.now()
    const recvWindow = "50000"
    // Add timestamp and recvWindow
    queryString += `&recvWindow=${recvWindow}&timestamp=${timestamp}`
    const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex")

    // Fetch binane order api with signature

    try {
        console.log(
            `Sending request to Binance API with URL: https://api.binance.com/api/v3/order/oco/test?${queryString}&signature=${signature}`,
        )

        let res = await fetchWithTimeout(
            `https://api.binance.com/api/v3/order/oco/test?${queryString}&signature=${signature}`,
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

        // Save order data
        saveOrderData(listClientOrderId, {request: body, response: data});

            return NextResponse.json({ data })
        } else {
            try {
                const errordata = await res.json()
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
