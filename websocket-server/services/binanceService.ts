import { Symbol } from './../types/index';
import dotenv from "dotenv"
import axios from "axios"
import crypto from "crypto"
import { v4 as uuidv4 } from "uuid"
import http, { request } from "http"
import { OrderModel } from "../db/models/binance/Order"
import { IExchange, ExchangeModel } from "../db/models/binance/Exchange"
import {
    MarketOrderParams,
    LimitOrderParams,
    OCOOrderParams,
    CancelOrderParams,
    CancelAllOrdersParams,
    CancelOCOOrderParams,
    Order,
    BinanceConnectionCheck,
    OrderResponse,
    OCOOrderResponse,
    TradeOrder,
    Data,
    Filter,
    ExecutionReportData,
    CancelAndReplaceOrderParams,
    
} from "../types"
import { HandleApiErrors } from "../utils/errorUtils"
import { generateBinanceSignature } from "../utils/signatureUtils"
import { isValidLotSize } from "../utils/validationService"
import {
    handleOrderResponse,
    handleExecutionReport,
    handleOCOOrderResponse,
} from "./binanceWsService/binanceWsService"
import { updateOrderInDatabase, updateOrInsertOrder } from "../db/operations/binance/orderOps"
import { WebSocket, Server } from "ws"
import { setupWebSocket, WebsocketManager, RateLimitManager } from "../utils/utils"
import { generateDate } from "../utils/dateUtils"
import { getSymbolFilters } from "../db/operations/binance/exchangeOps"
import { set } from "mongoose"
dotenv.config({ path: ".env.test" })

console.log("NODE_ENV:", process.env.NODE_ENV)

let recvWindow: number = 50000
const apiKey = process.env.API_KEY
const apiSecret = process.env.API_SECRET
const binanceTestUrl = process.env.BINANCE_TEST_URL
const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY
const wsTestURL = process.env.BINANCE_TEST_WEBSOCKET_API_URL
const streamUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL

console.log("Debug: wsTestURL", wsTestURL)

let isUpdating = false
let ordersForSymbol: any = {}
if (!wsTestURL) {
    throw new Error("No test WebSocket URL provided")
}
// const rateLimitManager = new RateLimitManager()

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



export async function executeMarketOrderForBinance(
    wsClient: WebSocket,
    wsTestURL: string,
    testApiKey: string,
    testApiSecret: string,
    symbol: string,
    side: string,
    quantity: string,
    requestId: string,
    //recvWindow: number
) {
    try {
        if (!testApiKey || !testApiSecret) {
            throw HandleApiErrors.BinanceError.fromCode(-1002) // Unauthorized
        }
        if (!symbol) {
            throw HandleApiErrors.BinanceError.fromCode(-1015) // Invalid symbol
        }
        if (!side) {
            throw HandleApiErrors.BinanceError.fromCode(-1130) // Invalid side
        }
        if (!quantity) {
            throw HandleApiErrors.BinanceError.fromCode(-1017) // Invalid amount
        }

        const timestamp = generateDate()
        const queryString = `apiKey=${testApiKey}&quantity=${quantity}&recvWindow=${recvWindow}&side=${side.toUpperCase()}&symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&type=MARKET`
        console.log("queryString", queryString)
        const signature = generateBinanceSignature(queryString, testApiSecret)
        console.log("signature", signature)
        const params: MarketOrderParams = {
            symbol: symbol.toUpperCase(),
            side: side.toUpperCase(),
            type: "MARKET",
            timestamp: timestamp,
            quantity: quantity,
            apiKey: testApiKey,
            signature: signature,
            recvWindow: recvWindow, // <-- Added this
        }

        const wsMarketOrderManager = new WebsocketManager(
            `${wsTestURL}`,
            requestId,
            "order.place",
            params,
        )
        console.log(params)
        wsMarketOrderManager.on("open", () => {
            console.log("Connection to Market order manager opened")
        })

        wsMarketOrderManager.on("message", async (data: string | Buffer) => {
            console.log("Received message from market order manager", typeof data)
            if (typeof data === "string") {
                const parsedData = JSON.parse(data)
            } else if (Buffer.isBuffer(data)) {
                const parsedData = JSON.parse(data.toString())
            } else {
                const parsedData = data
                console.log("Received Order Response:", JSON.stringify(parsedData, null, 2))

                if ("status" in parsedData && (parsedData as any).status === 200) {
                    // This looks like an OrderResponse object with a successful status
                    await handleOrderResponse(parsedData as OrderResponse)
                } else if ("e" in (parsedData as any)) {
                    // This looks like an ExecutionReportData object
                    await handleExecutionReport(parsedData as ExecutionReportData)
                } else {
                    console.error("Unknown data type")
                }
            }
            if (wsClient.readyState === WebSocket.OPEN) {
                console.log("Sending market order message to client:", data)

                if (typeof data === "object") {
                    console.log(data)
                    wsClient.send(JSON.stringify(data))
                } else {
                    console.log(data)
                    wsClient.send(JSON.stringify(data))
                }
            } else {
                console.error("WebSocket is not initialized. Cannot send data")
            }
        })
        wsMarketOrderManager.on("error", (event) => {
            console.error("Market Order Connection Error:", JSON.stringify(event))
        })
        wsMarketOrderManager.on("close", (code, reason) => {
            console.log(`Market Order Connection closed: ${code} ${reason}`)
        })
    } catch (error) {
        console.error("An error occurred:", error)
        if (error instanceof HandleApiErrors.BinanceError) {
            // Handle Binance-specific errors
            console.error(`Binance Error: ${error.code} - ${error.message}`)
        } else {
            // Handle other errors
            console.error("Unknown Error:", error)
        }
    }
}

export async function cancelMarketOrderForBinance(
    wsClient: WebSocket,
    wsTestURL: string,
    requestId: string,
    testApiSecret: string,
    symbol: string,
    orderId: number,
    testApiKey: string,
) {
    if (!testApiKey || !testApiSecret) {
        throw HandleApiErrors.BinanceError.fromCode(-1002) // Replace with actual error code
    }
    if (!symbol) {
        throw HandleApiErrors.BinanceError.fromCode(-1015) // Replace with actual error code
    }
    if (!orderId) {
        throw HandleApiErrors.BinanceError.fromCode(-1014) // Replace with actual error code
    }
    const timestamp = generateDate()
    const queryString = `apiKey=${testApiKey}&newClientOrderId=false&orderId=${orderId}&recvWindow=${recvWindow}&symbol=${symbol}&timestamp=${timestamp}`
    console.log("queryString", queryString)
    const signature = generateBinanceSignature(queryString, testApiSecret)
    const params: CancelOrderParams = {
        symbol: symbol,
        orderId: orderId,
        apiKey: testApiKey,
        signature: signature,
        timestamp: timestamp,
        recvWindow: recvWindow,
        newClientOrderId: false,
    }
    console.log(params)
    console.log("params", params)
    const wsCancelOrderManager = new WebsocketManager(
        `${wsTestURL}`,
        requestId,
        "order.cancel",
        params,
    )
    wsCancelOrderManager.on("open", () => {
        console.log("Connection to cancel order manager opened")
    })

    wsCancelOrderManager.on("message", async (data: string | Buffer) => {
        console.log("Received message from cancel order manager", typeof data)

        let parsedData: any

        if (typeof data === "string") {
            parsedData = JSON.parse(data)
        } else if (Buffer.isBuffer(data)) {
            parsedData = JSON.parse(data.toString())
        } else {
            parsedData = data
        }

        // Check if the message is relevant for database update
        if ("status" in parsedData && parsedData.status === 200) {
            // This looks like an OrderResponse object with a successful status
            try {
                const orderId = parsedData.result.orderId // Replace with the actual field for orderId in your parsedData
                const newStatus = parsedData.result.status
                await updateOrderInDatabase(orderId, newStatus) // Assuming updateOrderInDatabase is an async function
                console.log("Database updated successfully")
            } catch (dbError) {
                console.error("Error updating database:", dbError)
            }
        } else if ("e" in parsedData) {
            // This looks like an ExecutionReportData object
            try {
                await handleExecutionReport(parsedData)
                console.log("Database updated with execution report")
            } catch (dbError) {
                console.error("Error updating database with execution report:", dbError)
            }
        } else {
            console.error("Unknown data type or not relevant for database update")
        }

        if (wsClient.readyState === WebSocket.OPEN) {
            console.log("Sending limit order message to client:", parsedData)

            // Always send as a JSON string
            wsClient.send(JSON.stringify(parsedData))
        } else {
            console.error("WebSocket is not initialized. Cannot send data")
        }
    })

    wsCancelOrderManager.on("error", (event) => {
        console.error("Cancel Order Connection Error:", JSON.stringify(event))
    })
    wsCancelOrderManager.on("close", (code, reason) => {
        console.log(`Cancel Order Connection closed: ${code} ${reason}`)
    })
}

export async function cancelOCOOrderForBinance(
    wsClient: WebSocket,
    wsTestURL: string,
    symbol: string,
    orderListId: number,
    testApiKey: string,
    requestId: string,
    testApiSecret: string,
) {
    if (!testApiKey || !testApiSecret) {
        throw HandleApiErrors.BinanceError.fromCode(-1002) // Replace with actual error code
    }
    const timestamp = generateDate()
    if (!symbol) {
        throw HandleApiErrors.BinanceError.fromCode(-1015) // Replace with actual error code
    }
    if (!orderListId) {
        throw HandleApiErrors.BinanceError.fromCode(-1014) // Replace with actual error code
    }
    console.log("orderListId", orderListId, "symbol", symbol)
    console.log(testApiKey)
    const queryString = `apiKey=${testApiKey}&newClientOrderId=false&orderListId=${orderListId}&recvWindow=${recvWindow}&symbol=${symbol}&timestamp=${timestamp}`
    console.log("queryString", queryString)
    const signature = generateBinanceSignature(queryString, testApiSecret)
    const params: CancelOCOOrderParams = {
        symbol: symbol,
        orderListId: orderListId,
        apiKey: testApiKey,
        signature: signature,
        timestamp: timestamp,
        recvWindow: recvWindow,
        newClientOrderId: false,
    }
    console.log("params", params)
    const wsCancelOCOOrderManager = new WebsocketManager(
        `${wsTestURL}`,
        requestId,
        "orderList.cancel",
        params,
    )
    wsCancelOCOOrderManager.on("open", () => {
        console.log("Connection to OCO order manager opened")
    })

    wsCancelOCOOrderManager.on("message", async (data: string | Buffer) => {
        console.log("Received message from limit order manager", data)

        // Check if data is a Buffer and convert it to a string
        if (Buffer.isBuffer(data)) {
            data = data.toString("utf8")
        }

        // Check if data is already an object
        let parsedData
        if (typeof data === "object") {
            parsedData = data
        } else {
            try {
                parsedData = JSON.parse(data.toString())
            } catch (error) {
                console.error("JSON parsing failed:", error)
            }
        }

        console.log("Parsed Data:", parsedData)

        if (wsClient.readyState === WebSocket.OPEN) {
            console.log("Sending limit order message to client:", parsedData)

            // Always send data as a string
            wsClient.send(JSON.stringify(parsedData))
        } else {
            console.error("WebSocket is not initialized. Cannot send data")
        }
    })
    wsCancelOCOOrderManager.on("error", (event) => {
        console.error("Cancel Order Connection Error:", JSON.stringify(event))
    })
    wsCancelOCOOrderManager.on("close", (code, reason) => {
        console.log(`Cancel Order Connection closed: ${code} ${reason}`)
    })
}
export async function executeLimitOrderForBinance(
    wsClient: WebSocket,
    wsTestURL: string,
    testApiKey: string,
    testApiSecret: string,
    symbol: string,
    side: string,
    quantity: string,
    price: string,
    requestId: string,
    recvWindow: number, // <-- Added this
    icebergQty?: number,
    newClientOrderId?: string,
    newOrderRespType?: string,
    stopPrice?: number,
    workingType?: string,

    // ... other optional params
) {
    let exchangeName = "Binance"
    const exchange: IExchange | null = await ExchangeModel.findOne({ exchangeName: exchangeName })
    if (!exchange || !exchange.exchangeInfo) {
        throw new Error("Could not fetch exchange info")
    }

    const tradingPairFilters: Symbol | null = await getSymbolFilters(exchangeName, symbol)

    if (!tradingPairFilters) {
        throw new Error("Could not fetch trading pair filters")
    }

    // Create a TradeOrder object to validate
    const tradeOrder: TradeOrder = {
        price,
        side,
        quantity: quantity,
        // ... (other fields)
    }

    // Validate the order using isValidLotSize
    // Validate the order using isValidLotSize
    if (tradingPairFilters) {
        const symbolFilters = await getSymbolFilters(exchangeName, symbol)

        if (symbolFilters) {
            const lotSizeFilter = symbolFilters.filters.find(
                (filter: Filter) => filter.filterType === "LOT_SIZE",
            )
            console.log(lotSizeFilter, "lotSizeFilter")
            if (lotSizeFilter) {
                const { minQty, maxQty, stepSize } = lotSizeFilter
                console.log(
                    quantity,
                    minQty,
                    maxQty,
                    stepSize,
                    "Arguments before calling isValidLotSize",
                )
                console.trace("About to call isValidLotSize")
                console.log("Before calling isValidLotSize:", quantity, minQty, maxQty, stepSize)

                const isValid = isValidLotSize(quantity, minQty!, maxQty!, stepSize!)
                console.log("isValid immediately after function call:", isValid)

                if (!isValid) {
                    throw new Error("Invalid order size in isValid check") // Differentiated error message
                }
            } else {
                console.log("No LOT_SIZE filter found")
            }
        } else {
            console.log("No symbol filters found")
        }

        console.log(tradeOrder, tradingPairFilters)
    } else {
        throw new Error("Invalid order size after logging tradeOrder and tradingPairFilters") // Differentiated error message
    }

    console.log("before if blocks checks")
    if (!testApiKey || !testApiSecret) {
        throw new Error("Missing API credentials")
    }
    if (!symbol) throw new Error("Missing required parameter: symbol")
    if (!side) throw new Error("Missing required parameter: side")
    if (!quantity) throw new Error("Missing required parameter: quantity")
    if (!price) throw new Error("Missing required parameter: price")
    const timestamp = generateDate()
    //let queryString = `apiKey=${testApiKey}&price=${price}&quantity=${quantity}&recvWindow=${recvWindow}&side=${side.toUpperCase()}&symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&timeInForce=GTC&type=LIMIT`

    const params: LimitOrderParams = {
        symbol: symbol.toUpperCase(),
        side: side.toUpperCase(),
        type: "LIMIT",
        timeInForce: "GTC",
        price: price,
        quantity: quantity,
        ...(icebergQty !== undefined ? { icebergQty } : {}),
        ...(newClientOrderId !== undefined ? { newClientOrderId } : {}),
        ...(newOrderRespType !== undefined ? { newOrderRespType } : {}),
        ...(stopPrice !== undefined ? { stopPrice } : {}),
        ...(workingType !== undefined ? { workingType } : {}),
        apiKey: testApiKey,
        signature: "",
        recvWindow: recvWindow,
        timestamp: timestamp,
        // ... conditionally add other optional params
    }

    const paramsWithoutSignature = { ...params }
    delete paramsWithoutSignature.signature
    //const paramsCopy = JSON.parse(JSON.stringify(params)) as LimitOrderParams;

    const sortedKeys = Object.keys(paramsWithoutSignature).sort()
    console.log(sortedKeys, "sortedKeys")
    const queryString = sortedKeys.map((key) => `${key}=${(params as any)[key]}`).join("&")
    console.log("queryString", queryString)
    let signature = generateBinanceSignature(queryString, testApiSecret)
    params.signature = signature

    const wsLimitOrderManager = new WebsocketManager(
        `${wsTestURL}`,
        requestId,
        "order.place",
        params,
    )
    wsLimitOrderManager.on("open", () => {
        console.log("Connection to limit order manager opened")
        wsClient.send(JSON.stringify(params))
    })

    wsLimitOrderManager.on("message", async (data: string | Buffer) => {
        console.log("Received message from limit order manager", data)

        let parsedData: any // Declare parsedData here

        if (typeof data === "string") {
            parsedData = JSON.parse(data)
        } else if (Buffer.isBuffer(data)) {
            parsedData = JSON.parse(data.toString())
        } else {
            parsedData = data
        }

        console.log("Received Order Response:", JSON.stringify(parsedData, null, 2))

        if ("status" in parsedData && parsedData.status === 200) {
            // This looks like an OrderResponse object with a successful status
            await handleOrderResponse(parsedData as OrderResponse) // You can define handleOrderResponse function
        } else if ("e" in parsedData) {
            // This looks like an ExecutionReportData object
            await handleExecutionReport(parsedData as ExecutionReportData) // You can define handleExecutionReport function
        } else {
            console.error("Unknown data type")
        }

        if (wsClient.readyState === WebSocket.OPEN) {
            console.log("Sending limit order message to client:", data)

            if (typeof data === "object") {
                wsClient.send(JSON.stringify(data))
            } else {
                wsClient.send(JSON.stringify(data))
            }
        } else {
            console.error("WebSocket is not initialized. Cannot send data")
        }
    })

    wsLimitOrderManager.on("error", (event) => {
        console.error("Limit Order Connection Error:", JSON.stringify(event))
    })
    wsLimitOrderManager.on("close", (code, reason) => {
        console.log(`Limit Order Connection closed: ${code} ${reason}`)
    })
}
export async function executeOCOForBinance(
    wsClient: WebSocket,
    wsTestURL: string,
    testApiKey: string,
    testApiSecret: string,
    symbol: string,
    side: string,
    price: string,
    quantity: string,
    stopPrice: string,
    stopLimitPrice: string,
    requestId: string,
    recvWindow: number,
) {
    try {
        if (!testApiKey || !testApiSecret) {
            throw HandleApiErrors.BinanceError.fromCode(-1002) // Unauthorized
        }
        if (!symbol || !side || !price || !quantity || !stopPrice || !stopLimitPrice) {
            throw HandleApiErrors.BinanceError.fromCode(-1015) // Invalid parameters
        }
        const timestamp = generateDate()
        const params: OCOOrderParams = {
            symbol: symbol.toUpperCase(),
            side: side.toUpperCase(),
            price: price,
            quantity: quantity,
            stopPrice: stopPrice,
            stopLimitPrice: stopLimitPrice,
            stopLimitTimeInForce: "GTC",
            apiKey: testApiKey,
            signature: "",
            recvWindow: recvWindow,
            timestamp: timestamp,
        }

        const paramsWithoutSignature = { ...params }
        delete paramsWithoutSignature.signature

        const sortedKeys = Object.keys(paramsWithoutSignature).sort()
        const queryString = sortedKeys.map((key) => `${key}=${(params as any)[key]}`).join("&")
        const signature = generateBinanceSignature(queryString, testApiSecret)
        params.signature = signature

        const wsOCOOrderManager = new WebsocketManager(
            `${wsTestURL}`,
            requestId,
            "orderList.place",
            params,
        )
        wsOCOOrderManager.on("open", (req) => {
            console.log("Connection to OCO order manager opened")
            console.log("sending params", params)
        })

        wsOCOOrderManager.on("message", async (data: string | Buffer) => {
            console.log("Received message from OCO order manager", data)

            let parsedData: any // Declare parsedData here

            if (typeof data === "string") {
                parsedData = JSON.parse(data)
            } else if (Buffer.isBuffer(data)) {
                parsedData = JSON.parse(data.toString())
            } else {
                parsedData = data
            }

            console.log("Received OCO Order Response:", JSON.stringify(parsedData, null, 2))

            if ("status" in parsedData && parsedData.status === 200) {
                // This looks like an OCO Order Response object with a successful status
                await handleOCOOrderResponse(parsedData as OCOOrderResponse)
            } else if ("e" in parsedData) {
                // This looks like an ExecutionReportData object
                await handleExecutionReport(parsedData as ExecutionReportData) //
            } else {
                console.error("Unknown data type")
            }

            if (wsClient.readyState === WebSocket.OPEN) {
                console.log("Sending OCO order message to client:", data)

                if (typeof data === "object") {
                    wsClient.send(JSON.stringify(data))
                } else {
                    wsClient.send(JSON.stringify(data))
                }
            } else {
                console.error("WebSocket is not initialized. Cannot send data")
            }
        })

        wsOCOOrderManager.on("error", (event) => {
            console.error("OCO Order Connection Error:", JSON.stringify(event))
        })

        wsOCOOrderManager.on("close", (code, reason) => {
            console.log(`OCO Order Connection closed: ${code} ${reason}`)
        })
    } catch (error) {
        console.error("An error occurred:", error)
        if (error instanceof HandleApiErrors.BinanceError) {
            console.error(`Binance Error: ${error.code} - ${error.message}`)
        } else {
            console.error("Unknown Error:", error)
        }
    }
}

export async function cancelAllOrdersForBinance(
    wsClient: WebSocket,
    wsTestURL: string,
    symbol: string,
    requestId: string,
    testApiKey: string,
    testApiSecret: string,
) {
    if (!testApiKey || !testApiSecret) {
        throw HandleApiErrors.BinanceError.fromCode(-1002) // Replace with actual error code
    }
    if (!symbol) {
        throw HandleApiErrors.BinanceError.fromCode(-1015) // Replace with actual error code
    }
  
    const timestamp = generateDate()
    const queryString = `apiKey=${testApiKey}&recvWindow=${recvWindow}&symbol=${symbol}&timestamp=${timestamp}`
    console.log("queryString", queryString)
    const signature = generateBinanceSignature(queryString, testApiSecret)
    const params: CancelAllOrdersParams = {
        symbol: symbol,
        apiKey: testApiKey,
        signature: signature,
        timestamp: timestamp,
        recvWindow: recvWindow,
        //newClientOrderId: false,
    }
    console.log("params", params)
    console.log(requestId)
    const wsCancelAllOrdersManager = new WebsocketManager(
        `${wsTestURL}`,
        requestId,
        "openOrders.cancelAll",
        params,
    )
    wsCancelAllOrdersManager.on("open", () => {
        console.log("Connection to cancel all orders manager opened")
    })

    wsCancelAllOrdersManager.on("message", async (data: string | Buffer) => {
        console.log("Received data type:", typeof data);  // Debugging line
        console.log("Received data:", data); 
        let parsedData: any;
    
        try {
            if (typeof data === "string") {
                parsedData = JSON.parse(data);
            } else if (Buffer.isBuffer(data)) {
                parsedData = JSON.parse(data.toString());
            } else if (typeof data === "object") {
                parsedData = data;  // Data is already an object, no need to parse
            } else {
                console.error("Unhandled data type:", typeof data);  // Debugging line
                throw new Error("Unknown data type received from WebSocket");
            }
        } catch (parseError) {
            console.error("Error parsing WebSocket data:", parseError);
            return;
        }
    
        if ("status" in parsedData && parsedData.status === 200) {
            try {
                if (Array.isArray(parsedData.result)) {
                    // Handle multiple orders
                    for (const order of parsedData.result) {
                        const orderId = order.orderId;
                        const newStatus = order.status;
                        await updateOrderInDatabase(orderId, newStatus);
                    }
                } else {
                    // Handle single order
                    const orderId = parsedData.result.orderId;
                    const newStatus = parsedData.result.status;
                    await updateOrderInDatabase(orderId, newStatus);
                }
                console.log("Database updated successfully");
            } catch (dbError) {
                console.error("Error updating database:", dbError);
            }
        } else if ("e" in parsedData) {
            // This looks like an ExecutionReportData object
            try {
                await handleExecutionReport(parsedData);
                console.log("Database updated with execution report");
            } catch (dbError) {
                console.error("Error updating database with execution report:", dbError);
            }
        } else {
            console.error("Unknown data type or not relevant for database update");
        }
    
        try {
            if (wsClient.readyState === WebSocket.OPEN) {
                console.log("Sending limit order message to client:", parsedData);
                wsClient.send(JSON.stringify(parsedData));
            } else {
                throw new Error("WebSocket is not initialized. Cannot send data");
            }
        } catch (wsError) {
            console.error("WebSocket error:", wsError);
        }
    });

    wsCancelAllOrdersManager.on("error", (event) => {
        console.error("Cancel Order Connection Error:", JSON.stringify(event))
    })
    wsCancelAllOrdersManager.on("close", (code, reason) => {
        console.log(`Cancel Order Connection closed: ${code} ${reason}`)
    })
}

export async function cancelAndReplaceOrderForBinance(
    wsClient: WebSocket,
    wsTestURL: string,
    symbol: string,
    cancelReplaceMode: string,
    cancelOrderId: number,
    side: string,
    type: string,
    quantity: string,
    price: string,
    requestId: string,
    testApiKey: string,
    testApiSecret: string,

) {

    console.log(cancelOrderId, "cancelOrderId")
    if (!testApiKey || !testApiSecret) {
        throw HandleApiErrors.BinanceError.fromCode(-1002) // Replace with actual error code
    }
    if (!symbol || !cancelReplaceMode || ! cancelOrderId || !side || !type) {
        throw HandleApiErrors.BinanceError.fromCode(-1102) // Replace with actual error code
    }

    function isCancelReplaceMode(mode: string): mode is "STOP_ON_FAILURE" | "ALLOW_FAILURE" {
        return mode === "STOP_ON_FAILURE" || mode === "ALLOW_FAILURE";
    }
    
    function isSide(side: string): side is "BUY" | "SELL" {
        return side === "BUY" || side === "SELL";
    }

    if (!isCancelReplaceMode(cancelReplaceMode)) {
        throw new Error("Invalid cancelReplaceMode");
    }
    
    if (!isSide(side.toUpperCase())) {
        throw new Error("Invalid side");
    }
    

    const timestamp = generateDate()
    const queryString = `apiKey=${testApiKey}&cancelOrderId=${cancelOrderId}&cancelReplaceMode=${cancelReplaceMode}&price=${price}&quantity=${quantity}&recvWindow=${recvWindow}&side=${side.toUpperCase()}&symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&timeInForce=GTC&type=${type.toUpperCase()}`
    
    const params: CancelAndReplaceOrderParams = {
        symbol: symbol.toUpperCase(),
        cancelReplaceMode: cancelReplaceMode,
        cancelOrderId: Number(cancelOrderId),
        side: side.toUpperCase()  as "BUY" | "SELL",
        type: type.toUpperCase(),
        timeInForce: "GTC",
        price: price,
        quantity: quantity,
        apiKey: testApiKey,
        signature: "",
        recvWindow: recvWindow,
        timestamp: timestamp,
    }

    const paramsWithoutSignature = { ...params };
    delete paramsWithoutSignature.signature;

    const sortedKeys = Object.keys(paramsWithoutSignature).sort();
    const sortedQueryString = sortedKeys.map((key) => `${key}=${(params as any)[key]}`).join('&');
    console.log("Sorted Query String:", sortedQueryString);
    const signature = generateBinanceSignature(sortedQueryString, testApiSecret)
    params.signature = signature;
   console.log("Generated Signature:", signature);
    console.log(" params", params)
    const wsCancelAndReplaceOrderManager = new WebsocketManager(`${wsTestURL}`, requestId, "order.cancelReplace", params)
    
     wsCancelAndReplaceOrderManager.on("open", () => {
        console.log("Connection to cancel and replace order manager opened")

     })
     wsCancelAndReplaceOrderManager.on("message", async (data: string | Buffer) => {
        let parsedData: any;
        try {
            if (typeof data === "string") {
                parsedData = JSON.parse(data);
            } else if (Buffer.isBuffer(data)) {
                parsedData = JSON.parse(data.toString());
            }  else if (typeof data === "object") {
                parsedData = data; // If it's already an object, no need to parse
            } else {
                throw new Error("Unknown data type received from WebSocket");
            }
        } catch (parseError) {
            console.error("Error parsing WebSocket data:", parseError);
            return;
        }

        if ("status" in parsedData) {
            const status = parsedData.status;
            switch (status) {
                case 200:
                    // Handle successful cancel and replace
                    if (parsedData.result) {
                        const { cancelResult, newOrderResult, cancelResponse, newOrderResponse } = parsedData.result;
                        if (cancelResult === "SUCCESS" && newOrderResult === "SUCCESS") {
                            try {
                                // Update or insert canceled order
                                await updateOrInsertOrder(cancelResponse);
    
                                // Update or insert new order
                                await updateOrInsertOrder(newOrderResponse);
    
                                console.log("Database updated successfully");
                            } catch (err) {
                                console.error("Error updating database:", err);
                            }
                        } else {
                            console.error("Cancel or Replace operation failed:", parsedData);
                        }
                    }
                    break;
                
                case 400:
                    // Handle both operations failed
                    console.error("Both operations failed:", parsedData.error.data);
                    break;
                    case 409:
                // Handle partial failure
                const partialData = parsedData.error.data;
                if (partialData.cancelResult === "FAILURE" && partialData.newOrderResult === "SUCCESS") {
                    console.warn("Cancel failed but new order succeeded:", partialData);
                    
                    // Insert the new order into the database
                    const newOrderData = partialData.newOrderResponse;
                    const newOrder = new OrderModel({
                        ...newOrderData,
                        exchangeId: "binance",  // Add any other necessary fields
                    });
                    try {
                        await newOrder.save();
                        console.log("New order inserted into database:", newOrder);
                    } catch (err) {
                        console.error("Error inserting new order into database:", err);
                    }
                }
                break;
        
                default:
                    // Handle other error cases
                    console.error("Error in cancel and replace operation:", parsedData.error.msg);
                    break;
            }
        }  else {
            console.error("Unknown data type or not relevant for database update");
        }

        try {
            if (wsClient.readyState === WebSocket.OPEN) {
                wsClient.send(JSON.stringify(parsedData));
            } else {
                throw new Error("WebSocket is not initialized. Cannot send data");
            }
        } catch (wsError) {
            console.error("WebSocket error:", wsError);
        }
    });
     
}
