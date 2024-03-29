import { IOrder } from "./../../../ui/app/models/order"
import WebSocket from "ws"
import dotenv from "dotenv"

import { getDataStreamListenKey } from "../binanceService"
import { updateOrderInDatabase } from "../../db/operations/binance/orderOps"
import { OrderModel } from "../../db/models/binance/Order"
import { IExchangeInfo } from "../../db/models/binance/Exchange"
import { uploadOCOToDB } from "../../db/operations/binance/ocoOps"
import { IOCOOrder } from "../../db/models/binance/OCOOrders"
import { generateDate } from "../../utils/dateUtils"
import { generateBinanceSignature } from "../../utils/signatureUtils"
import { ParamsType } from "../../types"
import { WebsocketManager, BinanceStreamManager, generateRandomId } from "../../utils/utils"
import { updateExchangeInfoInDB } from "../../db/operations/binance/exchangeOps"
import {
    OutboundAccountPositionData,
    BalanceUpdateData,
    ExecutionReportData,
    ListStatusData,
    OrderResponse,
    OrderResult,
} from "../../types"
dotenv.config({ path: ".env.test" })

/**
 * Initialize and manage WebSocket connection for exchange info.
 * @param wsTestURL - The WebSocket test URL for the exchange.
 * @param streamUrl - The WebSocket stream URL for the exchange.
 * @param requestId - The request ID for the WebSocket connection.
 */

let recvWindow = 60000

export async function handleOutboundAccountPosition(data: OutboundAccountPositionData) {
    console.log("Debug: Entered function")
    console.log("Account Position Update:", data)

    // Extract relevant information
    // Extract relevant information
    const eventTime = data.E
    const lastAccountUpdate = data.u
    const balances = data.B

    console.log("Debug: balances type:", typeof balances) // Debug log
    console.log("Debug: balances value:", balances) // Debug log

    // Validate the data
    if (!Array.isArray(balances)) {
        console.error("Invalid balance data:", balances)
        return
    }

    console.log("Debug: Passed validation")
    // Process each balance
    balances.forEach((balance: any) => {
        const asset = balance.a
        const free = parseFloat(balance.f)
        const locked = parseFloat(balance.l)

        if (isNaN(free) || isNaN(locked)) {
            console.error("Invalid balance values:", balance)
            return
        }

        //  logic here, e.g., update database, trigger alerts, etc.
    })
}

// Function to handle 'balanceUpdate' event
export async function handleBalanceUpdate(data: BalanceUpdateData) {
    console.log("Balance Update:", data)

    // Extract relevant information
    const eventTime = data.E
    const asset = data.a
    const balanceDelta = parseFloat(data.d)
    const clearTime = data.T

    if (isNaN(balanceDelta)) {
        console.error("Invalid balance delta:", data.d)
        return
    }

    // logic here, e.g., update database, trigger alerts, etc.
}
function mapOrderResultToExecutionReportData(orderResult: OrderResult): ExecutionReportData {
    return {
        e: "executionReport", // Assuming this is a constant for execution reports
        E: orderResult.transactTime, // EventTime
        s: orderResult.symbol, // Symbol
        c: orderResult.clientOrderId, // ClientOrderId
        S: orderResult.side as "BUY" | "SELL", // Side
        o: orderResult.type as
            | "LIMIT"
            | "MARKET"
            | "STOP_LOSS"
            | "STOP_LOSS_LIMIT"
            | "TAKE_PROFIT"
            | "TAKE_PROFIT_LIMIT"
            | "LIMIT_MAKER", // Order type
        f: "", // Assuming this field doesn't map directly
        q: orderResult.origQty, // Original quantity
        p: orderResult.price, // Price
        P: "", // Assuming this field doesn't map directly
        F: "", // Assuming this field doesn't map directly
        g: -1, // Assuming this field doesn't map directly
        C: "", // Assuming this field doesn't map directly
        x: orderResult.status as
            | "NEW"
            | "PARTIALLY_FILLED"
            | "FILLED"
            | "CANCELED"
            | "PENDING_CANCEL"
            | "REJECTED"
            | "EXPIRED", // Order status
        X: "", // Assuming this field doesn't map directly
        r: "", // Assuming this field doesn't map directly
        i: orderResult.orderId, // OrderId
        l: "", // Assuming this field doesn't map directly
        z: "", // Assuming this field doesn't map directly
        L: "", // Assuming this field doesn't map directly
        n: "", // Assuming this field doesn't map directly
        N: "", // Assuming this field doesn't map directly
        T: orderResult.transactTime, // Assuming this maps to transactTime
        t: 0, // Assuming this field doesn't map directly
        I: 0, // Assuming this field doesn't map directly
        w: false, // Assuming this field doesn't map directly
        m: false, // Assuming this field doesn't map directly
        M: false, // Assuming this field doesn't map directly
        O: 0, // Assuming this field doesn't map directly
        Z: "", // Assuming this field doesn't map directly
        Y: "", // Assuming this field doesn't map directly
        Q: "", // Assuming this field doesn't map directly
        W: "", // Assuming this field doesn't map directly
        V: "", // Assuming this field doesn't map directly
    }
}

export async function handleOCOOrderResponse(data: any) {
    // Use any here
    if (data && data.status === 200 && data.result && Object.keys(data.result).length > 0) {
        const ocoOrderDataWithExchangeId = {
            ...data.result,
            exchangeId: "binance",
        }
        await uploadOCOToDB([ocoOrderDataWithExchangeId])
    } else {
        console.log(
            "Received an OCOOrderResponse with an error status or empty result:",
            data?.status,
        )
    }
}

export async function handleOrderResponse(data: OrderResponse) {
    if (data.status === 200 && data.result && Object.keys(data.result).length > 0) {
        console.log("Data to be saved:", data.result)
        const orderDataWithExchangeId = {
            ...data.result,
            exchangeId: "binance",
        }
        const newOrder = new OrderModel(orderDataWithExchangeId)
        try {
            const savedEntry = await newOrder.save()
            console.log("Saved entry with ID:", savedEntry._id)
        } catch (err) {
            console.log("An error occurred:", err)
        }
    } else {
        console.log("Received an OrderResponse with an error status or empty result:", data.status)
    }
}

export async function handleExecutionReport(data: ExecutionReportData) {
    console.log("Order Update:", data)

    // Extract relevant information
    const eventTime = data.E
    const symbol = data.s
    const clientOrderId = data.c
    const side = data.S
    const orderType = data.o
    const orderStatus = data.X
    const orderRejectReason = data.r
    const orderId = data.i

    //  logic here, e.g., update database, trigger alerts, etc.

    if (orderStatus !== "NEW") {
        // Handle all statuses except "NEW"
        if (
            orderStatus === "FILLED" ||
            orderStatus === "CANCELED" ||
            orderStatus === "REJECTED" ||
            orderStatus === "TRADE" ||
            orderStatus === "EXPIRED"
        ) {
            await updateOrderInDatabase(data, orderStatus)
        } else {
            console.error("Unknown order status:", orderStatus)
        }
    }
}
// Function to handle 'listStatus' event (for OCO orders)
function handleListStatus(data: ListStatusData) {
    console.log("List Status:", data)

    // Extract relevant information
    const eventTime = data.E
    const symbol = data.s
    const orderListId = data.g
    const contingencyType = data.c
    const listStatusType = data.l
    const listOrderStatus = data.L
    const listRejectReason = data.r

    //  logic here, e.g., update database, trigger alerts, etc.
    if (listOrderStatus === "EXECUTING") {
        // Handle executing lists
    } else if (listOrderStatus === "ALL_DONE") {
        // Handle completed lists
    } else {
        console.error("Unknown list order status:", listOrderStatus)
    }
}

// exchange data
export function exchangeInfoWebsocket(
    wsClient: WebSocket,
    wsTestURL: string,
    requestId: string,
): void {
    console.log("exchangeInfoWebsocket function called");  // Add this

    const wsExchangeInfoManager = new WebsocketManager(wsTestURL, requestId, "exchangeInfo", {})

    wsExchangeInfoManager.on("open", () => {
        console.log("Connection to exchange info opened")
    })
    let lastExchangeInfo: IExchangeInfo | null = null

    wsExchangeInfoManager.on("message", async (data: any) => {
        console.log("Raw data from exchange:", data)
        if (data && data.type === "ping") {
            console.log("Received a ping message, ignoring.")
            return
        }
        if (wsClient.readyState === WebSocket.OPEN) {
            console.log("wsClient exchange info is open. Sending data.", data)
            wsClient.send(JSON.stringify(data))
        } else {
            console.log("wsClient is not open. Cannot send data.")
        }
        
        console.log("Last exchange info data:", lastExchangeInfo)
        console.log('data result',data)
        try {
            if (Object.keys(data.result).length > 0) {
                const newExchangeInfoData: IExchangeInfo = {
                    // Map the fields from the raw data to your IExchangeInfo interface
                    // For example:
                    timezone: data.result.timezone,
                    serverTime: data.result.serverTime,
                    rateLimits: data.result.rateLimits,
                    exchangeFilters: data.result.exchangeFilters,
                    symbols: data.result.symbols,
                    sors: data.result.sors,
                    // ... add other fields
                }
                console.log("New exchange info data:", newExchangeInfoData)
                
                if (JSON.stringify(newExchangeInfoData) !== JSON.stringify(lastExchangeInfo)) {
                    const exchangeName = "Binance"
                    const userId = "leol" // Replace with actual user ID logic

                    await updateExchangeInfoInDB(userId, exchangeName, newExchangeInfoData).catch(err => console.error("Async error:", err));
                    console.log("Successfully updated DB.")

                    // Update lastExchangeInfo with newExchangeInfoData
                    lastExchangeInfo = newExchangeInfoData
                } else {
                    console.log("Exchange info has not changed. Skipping DB update.")
                }
            }

            // const exchangeName = "Binance";
            // const userId = generateRandomId(); // Replace with actual user ID logic
            // console.log("Data to update:", userId, exchangeName, exchangeInfoData);
            // await updateExchangeInfoInDB(userId, exchangeName, exchangeInfoData);
            // console.log("Successfully updated DB.");
        } catch (err) {
            console.error("Error updating exchange info in DB or parsing data:", err)
        }
    })

    wsExchangeInfoManager.on("error", (event) => {
        console.error("Websocket error:", JSON.stringify(event))
    })

    wsExchangeInfoManager.on("close", (code, reason) => {
        console.log(
            `WebSocket connection to exchange info closed, code: ${code}, reason: ${reason}`,
        )
    })
}



// user account info
export async function userInfoWebsocket(
    wsClient: WebSocket,
    wsTestURL: string,
    testApiKey: string,
    testApiSecret: string,
    requestId: string,
) {
    const timestamp = generateDate()
    const queryString = `apiKey=${testApiKey}&timestamp=${timestamp}`
    const signature = generateBinanceSignature(queryString, testApiSecret)
    const params: ParamsType = {
        apiKey: testApiKey,
        signature: signature,
        timestamp: timestamp,
    }
    if (!wsTestURL) {
        console.log("No test URL provided")
        wsClient.send("No test URL provided")
    } else {
        const wsUserInfoManager = new WebsocketManager(
            `${wsTestURL}`,
            requestId,
            "account.status",
            params,
        )
        wsUserInfoManager.on("open", () => {
            console.log("Connection to user info opened")
        })
        wsUserInfoManager.on("message", async (data: string | Buffer) => {
            console.log("Received user info message from exchange:", data)
            if (wsClient.readyState === WebSocket.OPEN) {
                console.log("wsClient is open. Sending  userinfo data.", data)

                if (typeof data === "object") {
                    wsClient.send(JSON.stringify(data))
                } else {
                    wsClient.send(JSON.stringify(data))
                }
                // Forward this data to the client
            } else {
                console.log("wsClient is not open. Cannot send data.")
            }
        })
        wsUserInfoManager.on("error", (error: any) => {
            console.error("User Info Websocket error:", JSON.stringify(error))
        })
        wsUserInfoManager.on("close", (code: number, reason: string) => {
            console.log(
                `WebSocket connection to user info closed, code: ${code}, reason: ${reason}`,
            )
        })
    }
}

// New Order

//Order info
export async function orderStatusWebsocket(
    wsClient: WebSocket,
    wsTestURL: string,
    requestId: string,
    testApiSecret: string,
    testApiKey: string,
    req: any,
) {
    console.log("Inside orderStatus condition")
    if (!testApiKey && !testApiSecret) {
        throw new Error("No test API key provided")
    }
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`) // Parse the URL and the query parameters

    const symbol = parsedUrl.searchParams.get("symbol")
    const orderId = parsedUrl.searchParams.get("orderId")

    const timestamp = generateDate()

    if (!symbol && !orderId) {
        throw new Error("No symbol or orderId provided")
    } else {
        const queryString = `apiKey=${testApiKey}&orderId=${orderId}&symbol=${symbol?.toUpperCase()}&timestamp=${timestamp}`
        const signature = generateBinanceSignature(queryString, testApiSecret)
        const params: ParamsType = {
            symbol: symbol!.toUpperCase(),
            orderId: Number(orderId),
            apiKey: testApiKey,
            signature: signature,
            // recvWindow: recvWindow,
            timestamp: timestamp,
        }
        console.log("Params for order status", params)
        const wsOrderStatusManager = new WebsocketManager(
            `${wsTestURL}`,
            requestId,
            "order.status",
            params,
        )
        wsOrderStatusManager.on("open", () => {
            console.log("Connection to order status opened")
        })
        wsOrderStatusManager.on("message", async (data: string | Buffer) => {
            console.log("Received order status message from exchange:", data)
            // You can forward this data to the client if needed

            if (wsClient.readyState === WebSocket.OPEN) {
                console.log("wsClient is open. Sending data.", data)

                if (typeof data === "object") {
                    wsClient.send(JSON.stringify(data))
                } else {
                    wsClient.send(JSON.stringify(data))
                }
                // Forward this data to the client
            } else {
                console.log("wsClient is not open. Cannot send data.")
            }
        })
        wsOrderStatusManager.on("error", (event) => {
            console.error("Order Status Websocket error:", JSON.stringify(event))
        })
        wsOrderStatusManager.on("close", (code, reason) => {
            console.log(
                `WebSocket connection to order status closed, code: ${code}, reason: ${reason}`,
            )
        })
    }
}

export function allOrdersWebsocket(
    wsClient: WebSocket,
    wsTestURL: string,
    requestId: string,
    testApiSecret: string,
    testApiKey: string,
    req: any,
) {
    if (!testApiKey && !testApiSecret) {
        throw new Error("No test API key provided")
    }
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`) // Parse the URL and the query parameters

    const symbol = parsedUrl.searchParams.get("symbol")

    const timestamp = generateDate()

    if (!symbol) {
        throw new Error("No symbol or orderId provided")
    } else {
        const queryString = `apiKey=${testApiKey}&symbol=${symbol}&timestamp=${timestamp}`
        const signature = generateBinanceSignature(queryString, testApiSecret)
        console.log(queryString)
        const params: ParamsType = {
            symbol: symbol!.toUpperCase(),
            apiKey: testApiKey,
            signature: signature,
            timestamp: timestamp,
        }
        console.log(params)
        const wsAllOrder4SymbolManager = new WebsocketManager(
            `${wsTestURL}`,
            requestId,
            "allOrders",
            params,
        )
        wsAllOrder4SymbolManager.on("open", () => {
            console.log("Connection to order status opened")
        })
        wsAllOrder4SymbolManager.on("message", async (data: string | Buffer) => {
            console.log("Received order status message from exchange:", data.length)
            // You can forward this data to the client if needed

            if (wsClient.readyState === WebSocket.OPEN) {
                console.log("wsClient is open. Sending data.", data)

                if (typeof data === "object") {
                    wsClient.send(JSON.stringify(data))
                } else {
                    wsClient.send(JSON.stringify(data))
                }
                // Forward this data to the client
            } else {
                console.log("wsClient is not open. Cannot send data.")
            }
        })
        wsAllOrder4SymbolManager.on("error", (event) => {
            console.error("Order Status Websocket error:", JSON.stringify(event))
        })
        wsAllOrder4SymbolManager.on("close", (code, reason) => {
            console.log(
                `WebSocket connection to order status closed, code: ${code}, reason: ${reason}`,
            )
        })
    }
}

// Trades info

