

import { OrderModel } from "./../db/models/Order"
import axios from "axios"
import crypto from "crypto"
import http from "http"
import dotenv from "dotenv"



 dotenv.config({ path: '.env.test' });


console.log("NODE_ENV:", process.env.NODE_ENV);







import { v4 as uuidv4 } from "uuid"
import { WebSocket, Server } from "ws"
import { setupWebSocket, WebsocketManager, RateLimitManager} from "../utils/utils"
import { ExecutionReportData} from "../websocketServer"

import { set } from "mongoose"


const apiKey = process.env.API_KEY
const apiSecret = process.env.API_SECRET
const binanceTestUrl = process.env.BINANCE_TEST_URL
const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY
const wsTestURL = process.env.BINANCE_TEST_WEBSOCKET_API_URL
const streamUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL

interface Order {
    symbol: string
    orderId: string
    origClientOrderId: string
    newOrderRespType?: string
    action?: string
    order?: string
    status?: string
}
interface OrderStatusResponse {
    result: [symbol: string, orderId: number]
    rateLimits: object[]
}

interface BinanceResponse {
    id: string
    result: []
}

interface BinanceConnectionCheck {
    id: string
    status: number
    result: object[]
    rateLimits: object[]
}
interface Data {
    e: string
    x: string
    i: string
    l: string
    s: string
    o: string
    id?: string // Add this line
    result?: Order[]
}

interface PriceFeedMessage {
    e: string
    E: number
    s: string
    p: string
    P: string
    w: string
    x: string
    c: string
    Q: string
    b: string
    B: string
    a: string
    A: string
    o: string
    h: string
    l: string
    v: string
    q: string
    O: number
    C: number
    F: number
    L: number
    n: number
}
interface BinanceErrorType {
    code: number
    msg: string
}
console.log("Debug: wsTestURL", wsTestURL);

let isUpdating = false
let ordersForSymbol: any = {}
if (!wsTestURL) {
    throw new Error("No test WebSocket URL provided")
}
const rateLimitManager = new RateLimitManager()

let reconnectAttempts = 0
let reconnectInterval = 1000 // 1 second
let maxReconnectInterval = 30000 // 30 seconds


export async function getDataStreamListenKey() {
    const { data } = await axios.post(`${binanceTestUrl}/userDataStream`, null, {
        headers: { "X-MBX-APIKEY": testApiKey },
    })
    return data.listenKey
}

export async function cancelOrder(order: Order) {
    // Construct the URL and query parameters for the Binance API
    console.log("Canceling order:", order)
    const url = `${binanceTestUrl}/order`

    const params = {
        symbol: order.symbol,
        orderId: order.orderId,
        origClientOrderId: order.origClientOrderId,
        timestamp: Date.now().toString(), // Convert timestamp to string
    }

    // Create the signature
    const queryString = new URLSearchParams(params).toString()
    console.log("queryString", queryString)
    if (!testApiSecret) {
        throw new Error("API secret is not defined!")
    }

    const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex")
    console.log("signature", signature)

    const fullUrl = `${url}?${queryString}&signature=${signature}`
    console.log("Full URL:", fullUrl)
    // Make the DELETE request to the Binance API
    try {
        const response = await axios.delete(`${url}?${queryString}&signature=${signature}`, {
            headers: { "X-MBX-APIKEY": testApiKey },
        })
        console.log("Response from Binance API:", response.data)
        // Return the response data
        return response.data
    } catch (error: any) {
        console.error("Error deleting order:", error)
        return { error: error.message }
    }
}
export async function checkConnection(): Promise<BinanceConnectionCheck> {
    return new Promise(async (resolve, reject) => {
        const wsServerConnection = new WebSocket(`${wsTestURL}`)
        console.log("wsServerConnection", wsServerConnection.readyState)
        const requestId = uuidv4()

        wsServerConnection.on("open", () => {
            console.log("websocket connection test open")
            const message = { id: requestId, method: "ping", params: {} }
            wsServerConnection.send(JSON.stringify(message))
        })

        wsServerConnection.on("message", (message: string) => {
            try {
                const data = JSON.parse(message) as BinanceConnectionCheck
                if (data.status === 200) {
                    wsServerConnection.close() // Close if you don't need the connection anymore
                    resolve(data)
                }
            } catch (error) {
                console.log("Error parsing connection check:", error)
                reject(error)
            }
        })

        wsServerConnection.on("close", (code, reason) => {
            console.log(`WebSocket connection test closed, code: ${code}, reason: ${reason}`)
        })

        wsServerConnection.on("error", (error) => {
            console.error("WebSocket connection test  error:", error)
            reject(error)
        })

        // Timeout to reject the promise if no response is received within 10 seconds
        setTimeout(() => {
            wsServerConnection.close() // Close the WebSocket connection
            reject(new Error("Request timed out"))
        }, 10000)
    })
}

async function updateOrdersForSymbol(symbol: string, newOrders: Order[]) {
    try {
        while (isUpdating) {
            // Wait a bit before checking again
            await new Promise((resolve) => setTimeout(resolve, 100))
        }

        isUpdating = true
        console.log(`Updating orders for ${symbol}:`, newOrders)

        // Update the orders
        ordersForSymbol[symbol] = newOrders
        console.log(`Updated orders for ${symbol}:`, ordersForSymbol[symbol])

        isUpdating = false
    } catch (error) {
        console.error("Error updating orders for symbol:", error)
    }
}

export async function handleUserDataMessage(wsClient: WebSocket, symbol: string, message: string) {
    const data = JSON.parse(message) as Data
    console.log("Received message from user data stream:", data)
    if (data.e === "executionReport" && data.x === "TRADE" && data.s === symbol) {
        // This is an update about an order being filled
        const symbol = data.s
        const orderId = data.i
        try {
            console.log("attempt update trade status")
            const result = await OrderModel.updateOne({ symbol, orderId }, { status: "FILLED" })
            console.log("Update result", result)
        } catch (error) {
            console.error("Error updating order status:", error)
        }
        console.log(`Order ${data.i} was filled. Executed quantity: ${data.l}`)
        wsClient.send(JSON.stringify({ orderFilled: true, orderId: orderId }))

        if (!ordersForSymbol[symbol]) {
            ordersForSymbol[symbol] = []
        }
        ordersForSymbol[symbol].push(data)
        console.log(`Updated orders for symbol ${symbol}:`, ordersForSymbol[symbol]) // Log the updated orders
        symbol && (await updateOrdersForSymbol(symbol, [...(ordersForSymbol[symbol] || []), data]))
    } else if (data.id && data.result) {
        const updatedOrder = data.result[0] as Order
        console.log("Order updated:", updatedOrder)
        // await updateOrderInDatabase(updatedOrder); // Assume this function updates the order
        // console.log('Order updated:', updatedOrder);
        // Update the orders
        symbol && (await updateOrdersForSymbol(symbol, data.result))
    }
}

export async function updateOrderInDatabase(orderData: ExecutionReportData, orderStatus: string) {
    try {
        if (!orderData || Object.keys(orderData).length === 0 || !orderData.e || !orderData.i) {
            console.log("Invalid order data, skipping database operation.");
            return;
        }

        // Check for WebSocket ping
        // if (isWebSocketPing(orderData)) {
        //     console.log("Received WebSocket ping, skipping database operation.");
        //     return;
        // }
        
        let count = await OrderModel.countDocuments({});
        console.log(`Total orders: ${count}`);
        console.log("Order Data before updating:", orderData);

        switch (orderStatus) {
            case "NEW":
                // Insert new order into the database
                const newOrder = new OrderModel({
                    ...orderData,
                    status: "NEW",
                });
                await newOrder.save();
                console.log("New order inserted into database:", newOrder);
                break;

            case "PARTIALLY_FILLED":
                // Handle the partially filled order status
                // Update logic here if needed
                break;

            case "FILLED":
                // Update the order as filled
                const updateFilledOrder = await OrderModel.findOneAndUpdate(
                    { orderId: orderData.i },
                    { status: "FILLED" },
                    { new: true, maxTimeMS: 2000 }
                );
                if (updateFilledOrder) {
                    console.log("Successfully updated filled order in database:", updateFilledOrder);
                } else {
                    console.log("Order not found in database:", orderData.i);
                }
                break;

            // ... (rest of the cases remain the same)

            default:
                console.log("Unknown order status:", orderStatus);
        }

    } catch (error) {
        console.error("Error updating order in database:", error);
    }
}
