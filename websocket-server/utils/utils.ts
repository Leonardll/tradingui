import { OCOOrderModel } from "./../db/models/binance/OCOOrders"
import { on } from "events"
import { AnyObject, set } from "mongoose"
import { WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { EventEmitter } from "events"
import { StreamPayload } from "./streamTypes"
import { request } from "http"
import { OrderModel } from "../db/models/binance/Order"
import { ExchangeModel, IExchangeInfo } from "../db/models/binance/Exchange"
export type StreamCallback = (data: StreamPayload) => void
import { ParamsType, RateLimitInfo, BinanceMessage } from "../types"

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
        this.eventEmitter.setMaxListeners(50)

        // Debug: Print the number of listeners for each event
        console.log("Number of 'message' listeners:", this.eventEmitter.listenerCount("message"))
        console.log("Number of 'error' listeners:", this.eventEmitter.listenerCount("error"))
        console.log("Number of 'close' listeners:", this.eventEmitter.listenerCount("close"))
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
        this.eventEmitter.setMaxListeners(50)

        // Debug: Print the number of listeners for each event
        console.log("Number of 'message' listeners:", this.eventEmitter.listenerCount("message"))
        console.log("Number of 'error' listeners:", this.eventEmitter.listenerCount("error"))
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
