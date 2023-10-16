import { Request, Response } from "express"
import { WebSocket } from "ws"
import {
    executeLimitOrderForBinance,
    executeMarketOrderForBinance,
    executeOCOForBinance,
    cancelMarketOrderForBinance,
    cancelOCOOrderForBinance,
    cancelAllOrdersForBinance,
    cancelOrder as cancelBinanceOrder,
    cancelAndReplaceOrderForBinance

} from "../services/binanceService"

let recvWindow: number = 50000

export const cancelOrder = async (req: Request, res: Response) => {
    const order = req.body
    try {
        const result = await cancelBinanceOrder(order)
        res.json(result)
    } catch (error: any) {
        console.error("Error deleting order:", error)
        res.status(500).json({ error: error.toString() })
    }
}

// export class OrderController {
//     wsClient: WebSocket
//     wsTestURL: string
//     testApiSecret: string
//     testApiKey: string
//     recvWindow: number

//     constructor(
//         wsClient: WebSocket,
//         wsTestURL: string,
//         testApiKey: string,
//         testApiSecret: string,
//     ) {
//         this.wsClient = wsClient
//         this.wsTestURL = wsTestURL
//         this.testApiSecret = testApiSecret
//         this.testApiKey = testApiKey
//         this.recvWindow = recvWindow
//     }

//     async handleBinanceMarketOrder(
//         wsClient: WebSocket,
//         symbol: string,
//         side: string,
//         quantity: string,
//         requestId: string,
//         testApiKey: string,
//         testApiSecret: string,
//     ) {
//         try {
//             await executeMarketOrderForBinance(
//                 wsClient,
//                 this.wsTestURL,
//                 testApiKey,
//                 testApiSecret,
//                 symbol,
//                 side,
//                 quantity,
//                 requestId,
//                 //recvWindow
//             )
//             console.log("Binance market order handled successfully")
//         } catch (error) {
//             console.error("Error executing Binance market order:", error)
//         }
//     }
//     async handleBinanceLimitOrder(
//         wsClient: WebSocket,
//         symbol: string,
//         side: string,
//         quantity: string,
//         price: string,
//         requestId: string,
//         testApiKey: string,
//         testApiSecret: string,
//     ) {
//         try {
//             await executeLimitOrderForBinance(
//                 wsClient,
//                 this.wsTestURL,
//                 testApiKey,
//                 testApiSecret,
//                 symbol,
//                 side,
//                 quantity,
//                 price,
//                 requestId,
//                 recvWindow,
//             )
//             console.log("Binance limit order handled successfully")
//         } catch (error) {
//             console.error("Error executing Binance limit order:", error)
//         }
//     }

//     async handleBinanceStopLossOrder() {}
//     async handleBinanceStopLossLimitOrder() {}
//     async handleBinanceTakeProfitOrder() {}
//     async handleBinanceTakeProfitLimitOrder() {}
//     async handleBinanceLimitOcoOrder(
//         wsClient: WebSocket,
//         symbol: string,
//         side: string,
//         quantity: string,
//         price: string,
//         stopPrice: string,
//         stopLimitPrice: string,
//         requestId: string,
//         testApiKey: string,
//         testApiSecret: string,
//     ) {
//         try {
//             await executeOCOForBinance(
//                 wsClient,
//                 this.wsTestURL,
//                 testApiKey,
//                 testApiSecret,
//                 symbol,
//                 side,
//                 quantity,
//                 price,
//                 stopPrice,
//                 stopLimitPrice,
//                 requestId,
//                 recvWindow,
//             )
//         } catch (error) {}
//     }
//     async handleBinanceCancelOrder(
//         wsClient: WebSocket,
//         symbol: string,
//         orderId: number,
//         requestId: string,
//         testApiKey: string,
//         testApiSecret: string,
//     ) {
//         try {
//             await cancelMarkOrderForBinance(
//                 wsClient,
//                 this.wsTestURL,
//                 testApiKey,
//                 testApiSecret,
//                 symbol,
//                 orderId,
//                 requestId,
//             )
//             console.log("Binance limit order handled successfully")
//         } catch (error) {
//             console.error("Error executing Binance limit order:", error)
//         }
//     }
//     async handleBinanceCancelAllOrders(
//         wsClient: WebSocket,
//         symbol: string,
//         requestId: string,
//         testApiKey: string,
//         testApiSecret: string,
//     ) {
//         try {
//             await cancelAllMarkOrdersForBinance(
//                 wsClient,
//                 this.wsTestURL,
//                 testApiKey,
//                 testApiSecret,
//                 symbol,
//                 requestId,
//             )
//         } catch (error) {
//             console.error(`Error cancelling all orders for ${symbol}:`, error)
//          }
//     }
   
//     async handleBinanceCancelAllOCOOrders() {}
//     async handleBinanceReplaceOrder() {}
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
            console.log("Binance OCO order handled successfully");  // Add this line

        } catch (error) {
            console.error("Error executing Binance OCO order:", error)
        }
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
            await cancelMarketOrderForBinance(
                wsClient,
                this.wsTestURL,
                testApiKey,
                testApiSecret,
                symbol,
                orderId,
                requestId,
            )
            console.log("Binance limit order handled successfully")
        } catch (error) {
            console.error("Error executing Binance limit order:", error)
        }
    }
async handleBinanceCancelAllOrders(
                wsClient: WebSocket,
                symbol: string,
                requestId: string,
                testApiKey: string,
                testApiSecret: string,
            ) {
                try {
                    await cancelAllOrdersForBinance(
                        wsClient,
                        this.wsTestURL,
                        symbol,
                        requestId,
                        testApiKey,
                        testApiSecret,
                    )
                    console.log('Binance OCO order handled successfully');

                } catch (error) {
                    console.error(`Error cancelling all orders for ${symbol}:`, error)
                 }
}    

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
                testApiKey,
                testApiSecret,
            )
            console.log("Binance limit order handled successfully")
        } catch (error) {
            console.error("Error executing Binance limit order:", error)
        }
    }
async handleBinanceCancelReplaceOrder(
        wsClient: WebSocket,
        symbol: string,
        cancelReplace: "ALLOW_FAILURE" | "STOP_ON_FAILURE",
        cancelOrderId: number,
        side: string,
        type: string,
        quantity: string,
        price: string,
        requestId: string,
        testApiKey: string,
        testApiSecret: string,
        
) {
    try {
        await cancelAndReplaceOrderForBinance(
            wsClient,
            this.wsTestURL,
            symbol,
            cancelReplace,
            cancelOrderId,
            side,
            type,
            quantity,
            price,
            requestId,
            testApiKey,
            testApiSecret,
        )
    } catch (error) { 
        console.error("Error executing Binance limit order:", error)
    }
}
}
