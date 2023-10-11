import { OCOOrderModel } from "./../db/models/binance/OCOOrders"
import { on } from "events"
import { AnyObject, set } from "mongoose"
import { WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { EventEmitter } from "events"
import { StreamPayload } from "./streamTypes"
import { request } from "http"
import { OrderModel } from "../db/models/binance/Order"
import { ExchangeModel,IExchangeInfo } from "../db/models/binance/Exchange"
export type StreamCallback = (data: StreamPayload) => void
import {
    ParamsType,
    RateLimitInfo,
    BinanceMessage,
} from "../types"

import { executeLimitOrderForBinance, executeMarketOrderForBinance, cancelMarkOrderForBinance, cancelOCOOrderForBinance, executeOCOForBinance } from "../services/binanceService"
// You can then use these interfaces in code where you handle the WebSocket messages.

/**
 * Create a Binance API signature.
 * @param queryString - The query string to be signed.
 * @param testApiKey - The API secret key.
 * @param testApiSecret - The API secret key.
 * @returns The generated signature.
 */

let recvWindow: number = 50000

export function generateRandomId() {
    let randomId = uuidv4()
    return randomId
}
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function setupWebSocket(
    url: string,
    requestId: string,
    method: string,
    params: ParamsType,
    eventEmitter: EventEmitter,
) {
    // Initialize WebSocket
    const ws = new WebSocket(url)

    // Event handler for when the connection is opened
    ws.addEventListener("open", () => {
        console.log(`WebSocket connection to ${url} opened `)
        const initialMessage = JSON.stringify({
            id: requestId,
            method: method,
            params: params,
        })
        ws.send(initialMessage)
        //console.log(`Sent message: ${initialMessage}`);
        // Send an initial message if needed, based on API requirements
    })

    // Event handler for receiving messages
    ws.addEventListener("message", (event) => {
        let message: string
        if (typeof event.data === "string") {
            message = event.data
        } else if (event.data instanceof Buffer) {
            message = event.data.toString("utf-8")
            console.log(`Received Buffer message from ${url}, converted to string: ${message}`)
        } else {
            console.error("Unknown message type:", typeof event.data)
            return
        }

        let parsedMessage
        try {
            parsedMessage = JSON.parse(message)
            console.log(
                `Received message from setupwebsocket snippet in utils, url ${url}`,
                parsedMessage,
            )
            eventEmitter.emit("message", parsedMessage)
        } catch (e) {
            console.error("Error parsing message:", e)
            return
        }
    })

    // Event handler for errors
    ws.addEventListener("error", (event) => {
        console.log(`WebSocket Error: ${JSON.stringify(event)}`)
        eventEmitter.emit("error", event)
        // Handle errors here
    })

    ws.addEventListener("close", (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`)

        // Handle different closure codes (these are just examples)
        switch (event.code) {
            case 1000: // Normal Closure
                eventEmitter.emit("close", event.code, event.reason)
                console.log("Connection closed normally.")
                break
            case 1001: // Going Away
                eventEmitter.emit("close", event.code, event.reason)
                console.log("The server or client is going away.")
                break
            case 1002: // Protocol Error
                eventEmitter.emit("close", event.code, event.reason)
                console.log("There was a protocol error.")
                break
            case 1003: // Unsupported Data
                eventEmitter.emit("close", event.code, event.reason)
                console.log("Received data of unsupported type.")
                break
            case 1005: // No Status Received
                eventEmitter.emit("close", event.code, event.reason)
                console.log("Expected close status, received none.")
                break
            case 1006: // Abnormal Closure
                eventEmitter.emit("close", event.code, event.reason)
                console.log("Abnormal closure, no further detail available.")
            // Add more cases as needed
            default:
                console.log("Unknown closure code.")
        }

        // Maybe try to reconnect depending on the closure reason
        // For example:
        // if (event.code !== 1000) {
        //   setTimeout(() => setupWebSocket(), 5000);
        // }
    })

    return ws
}

export class WebsocketManager {
    private socket: WebSocket | null = null
    private baseUrl: string
    private reconnectDelay = 5000 // 5 seconds
    private eventEmitter: EventEmitter
    private requestId: string
    private method: string
    private params: ParamsType
    private pingInterval: NodeJS.Timeout | null = null
    private maxReconnectAttempts: number = 5 // Maximum number of reconnection attempts
    private reconnectAttempts: number = 0 // Current number of reconnection attempts

    constructor(baseUrl: string, requestId: string, method: string, params: ParamsType) {
        this.baseUrl = baseUrl
        this.requestId = requestId
        this.method = method
        this.params = params
        this.eventEmitter = new EventEmitter()
        this.socket = setupWebSocket(
            this.baseUrl,
            this.requestId,
            this.method,
            this.params,
            this.eventEmitter,
        )
        this.eventEmitter.on("close", this.onClose.bind(this))
        this.eventEmitter.on("error", this.onError.bind(this))
    }
    private setupWebSocket() {
        return new WebSocket(this.baseUrl)
    }
    public connect(
        query: string,
        handlers: {
            onOpen?: () => void
            onMessage?: (message: string | Buffer) => void
            onError?: (error: any) => void
            onClose?: (event: CloseEvent) => void
        },
    ) {
        const fullUrl = `${this.baseUrl}/${query}`
        console.log("Connecting to:", fullUrl)
        this.socket = new WebSocket(fullUrl)

        if (handlers.onOpen) {
            this.socket.addEventListener("open", handlers.onOpen)

            this.startPing()
        }

        if (handlers.onMessage) {
            this.socket.addEventListener("message", (event) => {
                handlers.onMessage!(event.data as string | Buffer)
            })
        }

        if (handlers.onError) {
            this.socket.addEventListener("error", handlers.onError)
        }

        if (handlers.onClose) {
            this.socket.addEventListener("close", handlers.onClose as any)
        }
    }

    startPing() {
        // Send a ping frame every 30 seconds
        this.pingInterval = setInterval(() => {
            if (this.socket!.readyState === WebSocket.OPEN) {
                try {
                    this.socket!.ping()
                    this.sendMessage(
                        JSON.stringify({
                            id: this.requestId,
                            method: "ping",
                        }),
                    )
                } catch (error) {
                    console.error("Error sending ping:", error)
                }
                // This sends a ping frame
            }
        }, 30000)

        // Listen for pong frame
        this.socket!.on("pong", () => {
            console.log("Received pong from server")
        })
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval)
            this.pingInterval = null
        }
    }

    private onOpen() {
        console.log("WebSocket opened")
        this.eventEmitter.emit("open")
    }

    private onMessage(message: string | Buffer) {
        try {
            const parsedMessage = JSON.parse(message.toString()) as BinanceMessage
            if ("method" in parsedMessage && parsedMessage.method === "pong") {
                console.log("Received pong from server")
            } else {
                console.log("Received message: from websocket manager ", parsedMessage)
                this.eventEmitter.emit("message", parsedMessage)
            }
        } catch (error) {
            console.error("Error parsing message:", error)
            this.eventEmitter.emit("error", error)
        }
    }
    public forwardMessageToClient(wsClient: WebSocket) {
        this.on("message", (data: string | Buffer) => {
            const parsedData = JSON.parse(data.toString()) as { method?: string }
            if (parsedData.method === "ping") {
                console.log("Received ping message, skipping forwarding.")
                return
            }
            if (wsClient.readyState === WebSocket.OPEN) {
                wsClient.send(data)
            }
        })
    }

    private onError(event: Event) {
        console.log("WebSocket error:", event)
        this.eventEmitter.emit("error", event)
        // Log the error to a monitoring service if you have one
    }
    // Close the socket if it's still open

    // Attempt to reconnect after a delay
    private attachEventListeners(handlers: {
        onOpen?: () => void
        onMessage?: (message: string | Buffer) => void
        onError?: (error: any) => void
        onClose?: (event: CloseEvent) => void
    }) {
        if (this.socket) {
            if (handlers.onOpen) {
                this.socket.addEventListener("open", handlers.onOpen)
            }
            if (handlers.onMessage) {
                this.socket.addEventListener("message", (event) => {
                    handlers.onMessage!(event.data as string | Buffer)
                })
            }
            if (handlers.onError) {
                this.socket.addEventListener("error", handlers.onError)
            }
            if (handlers.onClose) {
                this.socket.addEventListener("close", handlers.onClose as any)
            }
        }
    }
    private onClose(event: CloseEvent) {
        console.log("WebSocket closed:", event)

        // Check if the closure was intentional or due to an error
        if (!event.wasClean) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log("Connection died, Attempting to reconnect...")
                setTimeout(() => {
                    this.reconnect()
                }, this.reconnectDelay)
            } else {
                console.log("Max reconnection attempts reached.")
            }
        } else {
            console.log("Connection closed cleanly.")
        }
    }

    // Attempt to reconnect after a delay

    private reconnect() {
        this.reconnectAttempts++
        console.log(
            `Reconnection attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts}`,
        )
        this.socket = setupWebSocket(
            this.baseUrl,
            this.requestId,
            this.method,
            this.params,
            this.eventEmitter,
        )
        // Reset the ping interval if needed
        this.startPing()
    }

    public readyState() {
        if (this.socket) {
            console.log("WebSocket readyState: from wsmanager", this.socket.readyState)
            return this.socket.readyState
        }
    }

    public close() {
        if (this.socket) {
            this.socket.close()
        } else {
            console.error("WebSocket is not initialized.")
        }
    }

    public on(event: string, listener: (...args: any[]) => void) {
        this.eventEmitter.on(event, listener)
    }

    public sendMessage(message: string) {
        console.log("Sending message:", message)
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log("Sending message:", message)
            this.socket.send(message)
        } else {
            console.error("WebSocket is not initialized.")
        }
    }
}

export class BinanceStreamManager {
    private ws: WebSocket
    private subscriptions: { [key: string]: Function[] } = {}
    private subscriptionQueue: any[] = []
    private eventEmitter: EventEmitter

    constructor(baseEndpoint: string) {
        this.ws = new WebSocket(baseEndpoint)
        this.eventEmitter = new EventEmitter()

        this.ws.on("open", () => {
            console.log(`WebSocket stream connection established. To ${baseEndpoint}`)
            this.processSubscriptionQueue()
        })

        this.ws.on("message", (message: Buffer | string) => {
            const messageStr = message.toString("utf8")
            console.log("Received message as string:", messageStr)

            try {
                const parsedMessage: any = JSON.parse(messageStr)
                console.log(
                    JSON.stringify(parsedMessage, null, 2),
                    typeof parsedMessage,
                    "parsedMESSSAGE",
                )

                if ("e" in parsedMessage && "E" in parsedMessage) {
                    const eventType = parsedMessage.e
                    if (
                        eventType === "kline" ||
                        eventType === "executionReport" ||
                        eventType === "outboundAccountPosition"
                    ) {
                        this.eventEmitter.emit(eventType, parsedMessage)
                    } else {
                        this.eventEmitter.emit("error", new Error("Unexpected message format"))
                    }
                }
            } catch (error) {
                this.eventEmitter.emit("error", error)
            }
        })

        this.ws.on("error", (error) => {
            this.eventEmitter.emit("error", error)
        })
    }

    public on(event: string, listener: (...args: any[]) => void) {
        this.eventEmitter.on(event, listener)
    }

    private processSubscriptionQueue() {
        console.log("Processing subscription queue...", this.subscriptionQueue)
        while (this.subscriptionQueue.length > 0) {
            const { streamType, params, id } = this.subscriptionQueue.shift()
            this.subscribeToStream(streamType, params, id)
        }
    }

    public subscribeToStream(streamType: string, params: string[], id: number | string) {
        if (this.ws.readyState !== WebSocket.OPEN) {
            console.log("WebSocket is not open. Queuing subscription.")
            this.subscriptionQueue.push({ streamType, params, id })
            return
        }

        const payload = JSON.stringify({
            method: "SUBSCRIBE",
            params: params.map((param) => `${param}@${streamType}`),
            id: id,
        })

        this.ws.send(payload)
    }

    public unsubscribeFromStream(params: string[], id: number | string) {
        const payload = JSON.stringify({
            method: "UNSUBSCRIBE",
            params,
            id,
        })

        this.ws.send(payload)
    }

    public addListener(stream: string, callback: Function) {
        if (!this.subscriptions[stream]) {
            this.subscriptions[stream] = []
        }
        this.subscriptions[stream]!.push(callback)
    }

    public removeListener(stream: string, callback: Function) {
        if (this.subscriptions[stream]) {
            this.subscriptions[stream] = this.subscriptions[stream]!.filter(
                (cb) => cb !== callback,
            )
        }
    }
}

export class RateLimitManager {
    private requestWeight: number = 0
    private requestWeightLimit: number = 6000 // default
    private lastRequestTime: number = 0
    private interval: number = 60000 // 1 minute in milliseconds
    private rateLimits: RateLimitInfo[] = []

    public canMakeRequest(): boolean {
        const currentTime = Date.now()
        if (currentTime - this.lastRequestTime > this.interval) {
            this.requestWeight = 0
            this.lastRequestTime = currentTime
        }
        return this.requestWeight < this.requestWeightLimit
    }
    public checkRateLimits(): { isExceeded: boolean; retryAfter: number } {
        let isExceeded = false
        let retryAfter = 0

        for (const rateLimit of this.rateLimits) {
            if (rateLimit.count >= rateLimit.limit) {
                isExceeded = true
                retryAfter = this.calculateRetryAfter(rateLimit)
                break // Exit the loop if any rate limit is exceeded
            }
        }

        return { isExceeded, retryAfter }
    }

    private calculateRetryAfter(rateLimit: RateLimitInfo): number {
        // Calculate the time to wait before the next request
        // This is a simplified example; you may need more complex logic
        if (rateLimit.interval === "MINUTE") {
            return 60 * 1000 // 1 minute in milliseconds
        }
        // Add more intervals as needed
        return 0
    }

    public updateRateLimits(rateLimits: any) {
        const weightLimitInfo = rateLimits.find((rl: any) => rl.rateLimitType === "REQUEST_WEIGHT")
        if (weightLimitInfo) {
            this.requestWeight = weightLimitInfo.count
            this.requestWeightLimit = weightLimitInfo.limit
            this.interval = weightLimitInfo.intervalNum * 1000 // convert to milliseconds
        }
    }

    public handleRateLimitExceeded(retryAfter: number) {
        console.warn(
            `Rate limit exceeded. Next request will be delayed until ${new Date(
                retryAfter,
            ).toLocaleString()}`,
        )

        // Delay the next request. You can use a Promise to resolve after the delay.
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                console.log("Resuming requests...")
                resolve()
            }, retryAfter - Date.now())
        })
    }

    public handleIpBan(retryAfter: number) {
        console.error(`IP banned until ${new Date(retryAfter).toLocaleString()}`)

        // Notify the user or take other actions. For example:
        alert(
            `Your IP has been banned until ${new Date(
                retryAfter,
            ).toLocaleString()}. Please refrain from making excessive requests.`,
        )
    }
}

// TypeScript class to encapsulate Binance errors

// async function executeMarketOrderForBinance(
//     wsClient: WebSocket,
//     wsTestURL: string,
//     testApiKey: string,
//     testApiSecret: string,
//     symbol: string,
//     side: string,
//     quantity: string,
//     requestId: string,
//     //recvWindow: number
// ) {
//     try {
//         if (!testApiKey || !testApiSecret) {
//             throw HandleApiErrors.BinanceError.fromCode(-1002) // Unauthorized
//         }
//         if (!symbol) {
//             throw HandleApiErrors.BinanceError.fromCode(-1015) // Invalid symbol
//         }
//         if (!side) {
//             throw HandleApiErrors.BinanceError.fromCode(-1130) // Invalid side
//         }
//         if (!quantity) {
//             throw HandleApiErrors.BinanceError.fromCode(-1017) // Invalid amount
//         }

//         const timestamp = generateDate()
//         const queryString = `apiKey=${testApiKey}&quantity=${quantity}&recvWindow=${recvWindow}&side=${side.toUpperCase()}&symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&type=MARKET`
//         console.log("queryString", queryString)
//         const signature = generateBinanceSignature(queryString, testApiSecret)
//         console.log("signature", signature)
//         const params: MarketOrderParams = {
//             symbol: symbol.toUpperCase(),
//             side: side.toUpperCase(),
//             type: "MARKET",
//             timestamp: timestamp,
//             quantity: quantity,
//             apiKey: testApiKey,
//             signature: signature,
//             recvWindow: recvWindow, // <-- Added this
//         }

//         const wsMarketOrderManager = new WebsocketManager(
//             `${wsTestURL}`,
//             requestId,
//             "order.place",
//             params,
//         )
//         console.log(params)
//         wsMarketOrderManager.on("open", () => {
//             console.log("Connection to Market order manager opened")
//         })

//         wsMarketOrderManager.on("message", async (data: string | Buffer) => {
//             console.log("Received message from market order manager", typeof data)
//             if (typeof data === "string") {
//                 const parsedData = JSON.parse(data)
//             } else if (Buffer.isBuffer(data)) {
//                 const parsedData = JSON.parse(data.toString())
//             } else {
//                 const parsedData = data
//                 console.log("Received Order Response:", JSON.stringify(parsedData, null, 2))

//                 if ("status" in parsedData && (parsedData as any).status === 200) {
//                     // This looks like an OrderResponse object with a successful status
//                     await handleOrderResponse(parsedData as OrderResponse)
//                 } else if ("e" in (parsedData as any)) {
//                     // This looks like an ExecutionReportData object
//                     await handleExecutionReport(parsedData as ExecutionReportData)
//                 } else {
//                     console.error("Unknown data type")
//                 }
//             }
//             if (wsClient.readyState === WebSocket.OPEN) {
//                 console.log("Sending market order message to client:", data)

//                 if (typeof data === "object") {
//                     console.log(data)
//                     wsClient.send(JSON.stringify(data))
//                 } else {
//                     console.log(data)
//                     wsClient.send(JSON.stringify(data))
//                 }
//             } else {
//                 console.error("WebSocket is not initialized. Cannot send data")
//             }
//         })
//         wsMarketOrderManager.on("error", (event) => {
//             console.error("Market Order Connection Error:", JSON.stringify(event))
//         })
//         wsMarketOrderManager.on("close", (code, reason) => {
//             console.log(`Market Order Connection closed: ${code} ${reason}`)
//         })
//     } catch (error) {
//         console.error("An error occurred:", error)
//         if (error instanceof HandleApiErrors.BinanceError) {
//             // Handle Binance-specific errors
//             console.error(`Binance Error: ${error.code} - ${error.message}`)
//         } else {
//             // Handle other errors
//             console.error("Unknown Error:", error)
//         }
//     }
// }

// async function cancelMarkOrderForBinance(
//     wsClient: WebSocket,
//     wsTestURL: string,
//     requestId: string,
//     testApiSecret: string,
//     symbol: string,
//     orderId: number,
//     testApiKey: string,
// ) {
//     if (!testApiKey || !testApiSecret) {
//         throw HandleApiErrors.BinanceError.fromCode(-1002) // Replace with actual error code
//     }
//     if (!symbol) {
//         throw HandleApiErrors.BinanceError.fromCode(-1015) // Replace with actual error code
//     }
//     if (!orderId) {
//         throw HandleApiErrors.BinanceError.fromCode(-1014) // Replace with actual error code
//     }
//     const timestamp = generateDate()
//     const queryString = `apiKey=${testApiKey}&newClientOrderId=false&orderId=${orderId}&recvWindow=${recvWindow}&symbol=${symbol}&timestamp=${timestamp}`
//     console.log("queryString", queryString)
//     const signature = generateBinanceSignature(queryString, testApiSecret)
//     const params: CancelOrderParams = {
//         symbol: symbol,
//         orderId: orderId,
//         apiKey: testApiKey,
//         signature: signature,
//         timestamp: timestamp,
//         recvWindow: recvWindow,
//         newClientOrderId: false,
//     }
//     console.log(params)
//     console.log("params", params)
//     const wsCancelOrderManager = new WebsocketManager(
//         `${wsTestURL}`,
//         requestId,
//         "order.cancel",
//         params,
//     )
//     wsCancelOrderManager.on("open", () => {
//         console.log("Connection to limit order manager opened")
//     })

//     wsCancelOrderManager.on("message", async (data: string | Buffer) => {
//         console.log("Received message from limit order manager", typeof data)

//         let parsedData: any

//         if (typeof data === "string") {
//             parsedData = JSON.parse(data)
//         } else if (Buffer.isBuffer(data)) {
//             parsedData = JSON.parse(data.toString())
//         } else {
//             parsedData = data
//         }

//         // Check if the message is relevant for database update
//         if ("status" in parsedData && parsedData.status === 200) {
//             // This looks like an OrderResponse object with a successful status
//             try {
//                 const orderId = parsedData.result.orderId // Replace with the actual field for orderId in your parsedData
//                 const newStatus = parsedData.result.status
//                 await updateOrderInDatabase(orderId, newStatus) // Assuming updateOrderInDatabase is an async function
//                 console.log("Database updated successfully")
//             } catch (dbError) {
//                 console.error("Error updating database:", dbError)
//             }
//         } else if ("e" in parsedData) {
//             // This looks like an ExecutionReportData object
//             try {
//                 await handleExecutionReport(parsedData)
//                 console.log("Database updated with execution report")
//             } catch (dbError) {
//                 console.error("Error updating database with execution report:", dbError)
//             }
//         } else {
//             console.error("Unknown data type or not relevant for database update")
//         }

//         if (wsClient.readyState === WebSocket.OPEN) {
//             console.log("Sending limit order message to client:", parsedData)

//             // Always send as a JSON string
//             wsClient.send(JSON.stringify(parsedData))
//         } else {
//             console.error("WebSocket is not initialized. Cannot send data")
//         }
//     })

//     wsCancelOrderManager.on("error", (event) => {
//         console.error("Cancel Order Connection Error:", JSON.stringify(event))
//     })
//     wsCancelOrderManager.on("close", (code, reason) => {
//         console.log(`Cancel Order Connection closed: ${code} ${reason}`)
//     })
// }

// async function cancelOCOOrderForBinance(
//     wsClient: WebSocket,
//     wsTestURL: string,
//     symbol: string,
//     orderListId: number,
//     testApiKey: string,
//     requestId: string,
//     testApiSecret: string,
// ) {
//     if (!testApiKey || !testApiSecret) {
//         throw HandleApiErrors.BinanceError.fromCode(-1002) // Replace with actual error code
//     }
//     const timestamp = generateDate()
//     if (!symbol) {
//         throw HandleApiErrors.BinanceError.fromCode(-1015) // Replace with actual error code
//     }
//     if (!orderListId) {
//         throw HandleApiErrors.BinanceError.fromCode(-1014) // Replace with actual error code
//     }
//     console.log("orderListId", orderListId, "symbol", symbol)
//     console.log(testApiKey)
//     const queryString = `apiKey=${testApiKey}&newClientOrderId=false&orderListId=${orderListId}&recvWindow=${recvWindow}&symbol=${symbol}&timestamp=${timestamp}`
//     console.log("queryString", queryString)
//     const signature = generateBinanceSignature(queryString, testApiSecret)
//     const params: CancelOCOOrderParams = {
//         symbol: symbol,
//         orderListId: orderListId,
//         apiKey: testApiKey,
//         signature: signature,
//         timestamp: timestamp,
//         recvWindow: recvWindow,
//         newClientOrderId: false,
//     }
//     console.log("params", params)
//     const wsCancelOCOOrderManager = new WebsocketManager(
//         `${wsTestURL}`,
//         requestId,
//         "orderList.cancel",
//         params,
//     )
//     wsCancelOCOOrderManager.on("open", () => {
//         console.log("Connection to limit order manager opened")
//     })

//     wsCancelOCOOrderManager.on("message", async (data: string | Buffer) => {
//         console.log("Received message from limit order manager", data)

//         // Check if data is a Buffer and convert it to a string
//         if (Buffer.isBuffer(data)) {
//             data = data.toString("utf8")
//         }

//         // Check if data is already an object
//         let parsedData
//         if (typeof data === "object") {
//             parsedData = data
//         } else {
//             try {
//                 parsedData = JSON.parse(data.toString())
//             } catch (error) {
//                 console.error("JSON parsing failed:", error)
//             }
//         }

//         console.log("Parsed Data:", parsedData)

//         if (wsClient.readyState === WebSocket.OPEN) {
//             console.log("Sending limit order message to client:", parsedData)

//             // Always send data as a string
//             wsClient.send(JSON.stringify(parsedData))
//         } else {
//             console.error("WebSocket is not initialized. Cannot send data")
//         }
//     })
//     wsCancelOCOOrderManager.on("error", (event) => {
//         console.error("Cancel Order Connection Error:", JSON.stringify(event))
//     })
//     wsCancelOCOOrderManager.on("close", (code, reason) => {
//         console.log(`Cancel Order Connection closed: ${code} ${reason}`)
//     })
// }
// async function executeLimitOrderForBinance(
//     wsClient: WebSocket,
//     wsTestURL: string,
//     testApiKey: string,
//     testApiSecret: string,
//     symbol: string,
//     side: string,
//     quantity: string,
//     price: string,
//     requestId: string,
//     recvWindow: number, // <-- Added this
//     icebergQty?: number,
//     newClientOrderId?: string,
//     newOrderRespType?: string,
//     stopPrice?: number,
//     workingType?: string,

//     // ... other optional params
// ) {
//     let exchangeName = "Binance"
//     const exchange: IExchange | null = await ExchangeModel.findOne({ exchangeName: exchangeName })
//     if (!exchange || !exchange.exchangeInfo) {
//         throw new Error("Could not fetch exchange info")
//     }

//     const tradingPairFilters: Symbol | null = await getSymbolFilters(exchangeName, symbol)

//     if (!tradingPairFilters) {
//         throw new Error("Could not fetch trading pair filters")
//     }

//     // Create a TradeOrder object to validate
//     const tradeOrder: TradeOrder = {
//         price,
//         side,
//         quantity: quantity,
//         // ... (other fields)
//     }

//     // Validate the order using isValidLotSize
//     // Validate the order using isValidLotSize
//     if (tradingPairFilters) {
//         const symbolFilters = await getSymbolFilters(exchangeName, symbol)

//         if (symbolFilters) {
//             const lotSizeFilter = symbolFilters.filters.find(
//                 (filter: Filter) => filter.filterType === "LOT_SIZE",
//             )
//             console.log(lotSizeFilter, "lotSizeFilter")
//             if (lotSizeFilter) {
//                 const { minQty, maxQty, stepSize } = lotSizeFilter
//                 console.log(
//                     quantity,
//                     minQty,
//                     maxQty,
//                     stepSize,
//                     "Arguments before calling isValidLotSize",
//                 )
//                 console.trace("About to call isValidLotSize")
//                 console.log("Before calling isValidLotSize:", quantity, minQty, maxQty, stepSize)

//                 const isValid = isValidLotSize(quantity, minQty!, maxQty!, stepSize!)
//                 console.log("isValid immediately after function call:", isValid)

//                 if (!isValid) {
//                     throw new Error("Invalid order size in isValid check") // Differentiated error message
//                 }
//             } else {
//                 console.log("No LOT_SIZE filter found")
//             }
//         } else {
//             console.log("No symbol filters found")
//         }

//         console.log(tradeOrder, tradingPairFilters)
//     } else {
//         throw new Error("Invalid order size after logging tradeOrder and tradingPairFilters") // Differentiated error message
//     }

//     console.log("before if blocks checks")
//     if (!testApiKey || !testApiSecret) {
//         throw new Error("Missing API credentials")
//     }
//     if (!symbol) throw new Error("Missing required parameter: symbol")
//     if (!side) throw new Error("Missing required parameter: side")
//     if (!quantity) throw new Error("Missing required parameter: quantity")
//     if (!price) throw new Error("Missing required parameter: price")
//     const timestamp = generateDate()
//     //let queryString = `apiKey=${testApiKey}&price=${price}&quantity=${quantity}&recvWindow=${recvWindow}&side=${side.toUpperCase()}&symbol=${symbol.toUpperCase()}&timestamp=${timestamp}&timeInForce=GTC&type=LIMIT`

//     const params: LimitOrderParams = {
//         symbol: symbol.toUpperCase(),
//         side: side.toUpperCase(),
//         type: "LIMIT",
//         timeInForce: "GTC",
//         price: price,
//         quantity: quantity,
//         ...(icebergQty !== undefined ? { icebergQty } : {}),
//         ...(newClientOrderId !== undefined ? { newClientOrderId } : {}),
//         ...(newOrderRespType !== undefined ? { newOrderRespType } : {}),
//         ...(stopPrice !== undefined ? { stopPrice } : {}),
//         ...(workingType !== undefined ? { workingType } : {}),
//         apiKey: testApiKey,
//         signature: "",
//         recvWindow: recvWindow,
//         timestamp: timestamp,
//         // ... conditionally add other optional params
//     }

//     const paramsWithoutSignature = { ...params }
//     delete paramsWithoutSignature.signature
//     //const paramsCopy = JSON.parse(JSON.stringify(params)) as LimitOrderParams;

//     const sortedKeys = Object.keys(paramsWithoutSignature).sort()
//     console.log(sortedKeys, "sortedKeys")
//     const queryString = sortedKeys.map((key) => `${key}=${(params as any)[key]}`).join("&")
//     console.log("queryString", queryString)
//     let signature = generateBinanceSignature(queryString, testApiSecret)
//     params.signature = signature

//     const wsLimitOrderManager = new WebsocketManager(
//         `${wsTestURL}`,
//         requestId,
//         "order.place",
//         params,
//     )
//     wsLimitOrderManager.on("open", () => {
//         console.log("Connection to limit order manager opened")
//         wsClient.send(JSON.stringify(params))
//     })

//     wsLimitOrderManager.on("message", async (data: string | Buffer) => {
//         console.log("Received message from limit order manager", data)

//         let parsedData: any // Declare parsedData here

//         if (typeof data === "string") {
//             parsedData = JSON.parse(data)
//         } else if (Buffer.isBuffer(data)) {
//             parsedData = JSON.parse(data.toString())
//         } else {
//             parsedData = data
//         }

//         console.log("Received Order Response:", JSON.stringify(parsedData, null, 2))

//         if ("status" in parsedData && parsedData.status === 200) {
//             // This looks like an OrderResponse object with a successful status
//             await handleOrderResponse(parsedData as OrderResponse) // You can define handleOrderResponse function
//         } else if ("e" in parsedData) {
//             // This looks like an ExecutionReportData object
//             await handleExecutionReport(parsedData as ExecutionReportData) // You can define handleExecutionReport function
//         } else {
//             console.error("Unknown data type")
//         }

//         if (wsClient.readyState === WebSocket.OPEN) {
//             console.log("Sending limit order message to client:", data)

//             if (typeof data === "object") {
//                 wsClient.send(JSON.stringify(data))
//             } else {
//                 wsClient.send(JSON.stringify(data))
//             }
//         } else {
//             console.error("WebSocket is not initialized. Cannot send data")
//         }
//     })

//     wsLimitOrderManager.on("error", (event) => {
//         console.error("Limit Order Connection Error:", JSON.stringify(event))
//     })
//     wsLimitOrderManager.on("close", (code, reason) => {
//         console.log(`Limit Order Connection closed: ${code} ${reason}`)
//     })
// }
// async function executeOCOForBinance(
//     wsClient: WebSocket,
//     wsTestURL: string,
//     testApiKey: string,
//     testApiSecret: string,
//     symbol: string,
//     side: string,
//     price: string,
//     quantity: string,
//     stopPrice: string,
//     stopLimitPrice: string,
//     requestId: string,
//     recvWindow: number,
// ) {
//     try {
//         if (!testApiKey || !testApiSecret) {
//             throw HandleApiErrors.BinanceError.fromCode(-1002) // Unauthorized
//         }
//         if (!symbol || !side || !price || !quantity || !stopPrice || !stopLimitPrice) {
//             throw HandleApiErrors.BinanceError.fromCode(-1015) // Invalid parameters
//         }
//         const timestamp = generateDate()
//         const params: OCOOrderParams = {
//             symbol: symbol.toUpperCase(),
//             side: side.toUpperCase(),
//             price: price,
//             quantity: quantity,
//             stopPrice: stopPrice,
//             stopLimitPrice: stopLimitPrice,
//             stopLimitTimeInForce: "GTC",
//             apiKey: testApiKey,
//             signature: "",
//             recvWindow: recvWindow,
//             timestamp: timestamp,
//         }

//         const paramsWithoutSignature = { ...params }
//         delete paramsWithoutSignature.signature

//         const sortedKeys = Object.keys(paramsWithoutSignature).sort()
//         const queryString = sortedKeys.map((key) => `${key}=${(params as any)[key]}`).join("&")
//         const signature = generateBinanceSignature(queryString, testApiSecret)
//         params.signature = signature

//         const wsOCOOrderManager = new WebsocketManager(
//             `${wsTestURL}`,
//             requestId,
//             "orderList.place",
//             params,
//         )
//         wsOCOOrderManager.on("open", (req) => {
//             console.log("Connection to OCO order manager opened")
//             console.log("sending params", params)
//         })

//         wsOCOOrderManager.on("message", async (data: string | Buffer) => {
//             console.log("Received message from OCO order manager", data)

//             let parsedData: any // Declare parsedData here

//             if (typeof data === "string") {
//                 parsedData = JSON.parse(data)
//             } else if (Buffer.isBuffer(data)) {
//                 parsedData = JSON.parse(data.toString())
//             } else {
//                 parsedData = data
//             }

//             console.log("Received OCO Order Response:", JSON.stringify(parsedData, null, 2))

//             if ("status" in parsedData && parsedData.status === 200) {
//                 // This looks like an OCO Order Response object with a successful status
//                 await handleOCOOrderResponse(parsedData as OCOOrderResponse)
//             } else if ("e" in parsedData) {
//                 // This looks like an ExecutionReportData object
//                 await handleExecutionReport(parsedData as ExecutionReportData) //
//             } else {
//                 console.error("Unknown data type")
//             }

//             if (wsClient.readyState === WebSocket.OPEN) {
//                 console.log("Sending OCO order message to client:", data)

//                 if (typeof data === "object") {
//                     wsClient.send(JSON.stringify(data))
//                 } else {
//                     wsClient.send(JSON.stringify(data))
//                 }
//             } else {
//                 console.error("WebSocket is not initialized. Cannot send data")
//             }
//         })

//         wsOCOOrderManager.on("error", (event) => {
//             console.error("OCO Order Connection Error:", JSON.stringify(event))
//         })

//         wsOCOOrderManager.on("close", (code, reason) => {
//             console.log(`OCO Order Connection closed: ${code} ${reason}`)
//         })
//     } catch (error) {
//         console.error("An error occurred:", error)
//         if (error instanceof HandleApiErrors.BinanceError) {
//             console.error(`Binance Error: ${error.code} - ${error.message}`)
//         } else {
//             console.error("Unknown Error:", error)
//         }
//     }
// }

export class OrderController {
    wsClient: WebSocket
    wsTestURL: string
    testApiSecret: string
    testApiKey: string
    recvWindow: number

    constructor(
        wsClient: WebSocket,
        wsTestURL: string,
        testApiKey: string,
        testApiSecret: string,
    ) {
        this.wsClient = wsClient
        this.wsTestURL = wsTestURL
        this.testApiSecret = testApiSecret
        this.testApiKey = testApiKey
        this.recvWindow = recvWindow
    }

    async handleBinanceMarketOrder(
        wsClient: WebSocket,
        symbol: string,
        side: string,
        quantity: string,
        requestId: string,
        testApiKey: string,
        testApiSecret: string,
    ) {
        try {
            await executeMarketOrderForBinance(
                wsClient,
                this.wsTestURL,
                testApiKey,
                testApiSecret,
                symbol,
                side,
                quantity,
                requestId,
                //recvWindow
            )
            console.log("Binance market order handled successfully")
        } catch (error) {
            console.error("Error executing Binance market order:", error)
        }
    }
    async handleBinanceLimitOrder(
        wsClient: WebSocket,
        symbol: string,
        side: string,
        quantity: string,
        price: string,
        requestId: string,
        testApiKey: string,
        testApiSecret: string,
    ) {
        try {
            await executeLimitOrderForBinance(
                wsClient,
                this.wsTestURL,
                testApiKey,
                testApiSecret,
                symbol,
                side,
                quantity,
                price,
                requestId,
                recvWindow,
            )
            console.log("Binance limit order handled successfully")
        } catch (error) {
            console.error("Error executing Binance limit order:", error)
        }
    }

    async handleBinanceStopLossOrder() {}
    async handleBinanceStopLossLimitOrder() {}
    async handleBinanceTakeProfitOrder() {}
    async handleBinanceTakeProfitLimitOrder() {}
    async handleBinanceLimitOcoOrder(
        wsClient: WebSocket,
        symbol: string,
        side: string,
        quantity: string,
        price: string,
        stopPrice: string,
        stopLimitPrice: string,
        requestId: string,
        testApiKey: string,
        testApiSecret: string,
    ) {
        try {
            await executeOCOForBinance(
                wsClient,
                this.wsTestURL,
                testApiKey,
                testApiSecret,
                symbol,
                side,
                quantity,
                price,
                stopPrice,
                stopLimitPrice,
                requestId,
                recvWindow,
            )
        } catch (error) {}
    }
    async handleBinanceCancelOrder(
        wsClient: WebSocket,
        symbol: string,
        orderId: number,
        requestId: string,
        testApiKey: string,
        testApiSecret: string,
    ) {
        try {
            await cancelMarkOrderForBinance(
                wsClient,
                this.wsTestURL,
                this.testApiKey,
                this.testApiSecret,
                symbol,
                orderId,
                requestId,
            )
            console.log("Binance limit order handled successfully")
        } catch (error) {
            console.error("Error executing Binance limit order:", error)
        }
    }
    async handleBinanceCancelAllOrders() {}
    async handleBinanceCancelOCOOrder(
        wsClient: WebSocket,
        symbol: string,
        orderListId: number,
        requestId: string,
        testApiKey: string,
        testApiSecret: string,
    ) {
        try {
            await cancelOCOOrderForBinance(
                wsClient,
                this.wsTestURL,
                symbol,
                orderListId,
                requestId,
                this.testApiKey,
                this.testApiSecret,
            )
            console.log("Binance limit order handled successfully")
        } catch (error) {
            console.error("Error executing Binance limit order:", error)
        }
    }
    async handleBinanceReplaceOrder() {}
}

export const updateExchangeInfoInDB = async (
    userId: string,
    exchangeName: string,
    exchangeInfo: IExchangeInfo,
) => {
    console.log("Attempting to update DB with:", userId, exchangeName, exchangeInfo)
    try {
        await ExchangeModel.findOneAndUpdate(
            { userId, exchangeName },
            { $set: { exchangeInfo } },
            { upsert: true },
        )
        console.log("Successfully updated DB.")
    } catch (err) {
        console.error("Failed to update DB:", err)
    }
}
