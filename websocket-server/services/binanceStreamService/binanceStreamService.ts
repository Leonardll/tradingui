import { BinanceStreamManager } from "../../utils/utils"
import { getDataStreamListenKey } from "../binanceService"
import { handleBalanceUpdate, handleExecutionReport, handleOutboundAccountPosition } from "../binanceWsService/binanceWsService"
import WebSocket from "ws"

export function binancePriceFeedWebsocket(
    wsClient: WebSocket,
    streamUrl: string,
    req: any,
    listenkey: string,
    callback?: (data: any) => void,
) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`)
    const symbol = parsedUrl.searchParams.get("symbol")?.toUpperCase()
    const timeframes = parsedUrl.searchParams.get("timeframes")?.split(",") || ["1s"]

    let streamID = 1
    if (!symbol) {
        console.log("No symbol provided for price feed")
        wsClient.send("No symbol provided for price feed")
        return
    }

    timeframes.forEach((timeframe) => {
        const wsPriceFeed = `${streamUrl}/${listenkey}/${symbol.toLowerCase()}@kline_${timeframe}`
        const binanceStreamManager = new BinanceStreamManager(wsPriceFeed)

        // Listen for kline messages
        binanceStreamManager.on("kline", (data) => {
            console.log(`Received price feed data for ${timeframe}:`, data)

            // Call the callback function if provided
            if (callback) {
                callback(data)
            }

            if (wsClient.readyState === WebSocket.OPEN) {
                wsClient.send(JSON.stringify(data))
            } else {
                console.log("wsClient is not open. Cannot send price feed data.")
            }
        })

        // Handle errors
        binanceStreamManager.on("error", (error) => {
            console.error("An error occurred:", error)
        })

        // Handle close events
        binanceStreamManager.on("close", (code: number, reason: string) => {
            console.log(
                `WebSocket connection to price feed closed, code: ${code}, reason: ${reason}`,
            )
        })

        // Subscribe to the kline stream for the given symbol and timeframe
        binanceStreamManager.subscribeToStream(
            "kline",
            [`${symbol.toLowerCase()}@kline_${timeframe}`],
            streamID,
        )
        streamID++
    })
}
export async function userDataReportWebsocket(
    wsClient: WebSocket,
    testApiKey: string,
    testApiSecret: string,
    streamUrl: string,
) {
    if (!testApiKey || !testApiSecret) {
        console.error("No test API key or secret provided")
        wsClient.send("No test API key or secret provided")
        return
    }

    // Generate listenKey using API (this part depends on how you've set up API calls)
    const listenKey = await getDataStreamListenKey()

    if (!listenKey) {
        console.error("Failed to generate listenKey")
        wsClient.send("Failed to generate listenKey")
        return
    }

    // Create WebSocket URL for user data stream
    const wsUserDataUrl = `${streamUrl}/${listenKey}`

    // Create a new BinanceStreamManager for the user data stream
    const binanceStreamManager = new BinanceStreamManager(wsUserDataUrl)

    binanceStreamManager.on("open", () => {
        console.log("Connection to user data report stream opened")
    })

    // Add specific listeners for different types of user data
    binanceStreamManager.on("executionReport", (data) => {
        console.log("Received execution report:", data)
        handleExecutionReport(data)
        wsClient.send(JSON.stringify(data))
    })

    binanceStreamManager.on("outboundAccountPosition", (data) => {
        console.log("Received outbound account position:", data)
        handleOutboundAccountPosition(data)
        wsClient.send(JSON.stringify(data))
    })

    binanceStreamManager.on("balanceUpdate", (data) => {
        console.log("Received balance update:", data)
        handleBalanceUpdate(data)
        wsClient.send(JSON.stringify(data))
    })

    // Handle errors
    binanceStreamManager.on("error", (error: any) => {
        console.error("User Data Websocket error:", JSON.stringify(error.message))
        wsClient.send(JSON.stringify(error.message))
    })

    // Handle close events
    binanceStreamManager.on("close", (code: number, reason: string) => {
        console.log(`WebSocket connection to user data closed, code: ${code}, reason: ${reason}`)
        wsClient.send(`WebSocket connection to user data closed, code: ${code}, reason: ${reason}`)
    })
}