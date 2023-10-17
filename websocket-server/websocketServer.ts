import { Server, WebSocket } from "ws"
import http, { get, request } from "http"
import {
    cancelOrder,
    getDataStreamListenKey,
} from "./services/binanceService"
import { OrderModel } from "./db/models/binance/Order"
import { sleep } from "./utils/utils"
import dotenv from "dotenv"
dotenv.config({ path: ".env.test" })
import url from "url"
import { set } from "mongoose"
import { generateRandomId } from "./utils/utils"
import { OrderController } from "./controllers/OrderControllers"
import { userDataReportWebsocket, allOrdersWebsocket, orderStatusWebsocket,exchangeInfoWebsocket,userInfoWebsocket, binancePriceFeedWebsocket } from "./services/binanceWsService/binanceWsService"
import { ExchangeInfoData, ExecutionReportData } from "./types"
// env variables
const wsTestURL = process.env.BINANCE_TEST_WEBSOCKET_API_URL
const streamUrl = process.env.BINANCE_TEST_WEBSOCKET_STREAM_URL
const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY

// Controller

// variables
let isUpdating = false
let exchangeInfo: ExchangeInfoData | null = null
const MAX_RETRIES = 3
const RETRY_DELAY = 2000
let ordersForSymbol: any = {}
const recvWindow = 60000

// types

// interfaces

// database functions

async function updateOrderInDatabase(orderData: ExecutionReportData) {
    let retries = 0

    while (retries < MAX_RETRIES) {
        try {
            const updatedOrder = await OrderModel.findOneAndUpdate(
                { orderId: orderData.i },
                { status: "FILLED" },
                { new: true, maxTimeMS: 2000 },
            )

            if (!updatedOrder) {
                throw new Error(`Order not found in database: ${orderData.i}`)
            }

            console.log(`Successfully updated order: ${orderData.i}`)
            return
        } catch (error: any) {
            if (error.name === "MongoTimeoutError") {
                console.log(`Timeout error, retrying... (${retries + 1}/${MAX_RETRIES})`)
                await sleep(RETRY_DELAY)
                retries++
            } else {
                console.error(`Failed to update order: ${orderData.i}. Error: ${error.message}`)
                return
            }
        }
    }

    console.error(`Max retries reached. Could not update order: ${orderData.i}`)
}

async function getAllOrdersFromMongo() {
    return await OrderModel.find({ status: "NEW" }).lean().maxTimeMS(2000)
}

async function fetchAllOrdersFromMongo() {
    try {
        const orders = await getAllOrdersFromMongo()
        return orders
    } catch (error: any) {
        if (error.name === "MongoTimeoutError") {
            console.error("MongoDB operation timed out. Retrying...")
            // Implement retry logic here
        } else {
            console.error(`Error finding order  with status new:`, error)
        }
    }
}

// fetchAllOrdersFromMongo()
// .then((orders) => {
//   orders && orders.map((dbOrder) => {
//     let orderStatus = dbOrder.status
//     if (orderStatus === 'NEW') {

//       getOrderStatusFromBinance(dbOrder.symbol, Number(dbOrder.orderId))
//       .then( async (apiOrder) => {

//         if (!apiOrder) {
//           console.log('apiOrder is null or undefined')
//           return;
//         }
//         if (apiOrder.status === 'FILLED') {
//           await AllTrades.findOneAndUpdate({orderid: apiOrder.orderId}, {status: 'FILLED'}, {new: true});
//         } else if (apiOrder.status === 'CANCELED') {
//           await AllTrades.findOneAndUpdate({orderid: apiOrder.orderId}, {status: 'CANCELED'}, {new: true});
//         } else if (apiOrder.status === 'NEW') {
//           console.log('order status is still new', apiOrder.orderId);
//         }
//       })
//       .catch((error) => {
//         console.error(`Error comparing order status ${dbOrder.orderId} from Binance API and DB:`, error);
//       });
//     }
//   });
// }).catch((error) => {
//   if (error.name === 'MongoTimeoutError') {
//     console.error('MongoDB operation timed out. Retrying...');
//     // Implement retry logic here
//   } else {
//   console.error(`Error finding order  with status new:`, error);
//   }
// });

// websocket Server

export async function setupWebSocketServer(server: http.Server) {
    const wss = new Server({ server })
    console.log("WebSocket server created")
    if (!testApiSecret || !testApiKey) {
        throw new Error("No test API secret provided")
    }
    const requestId = generateRandomId()
    const listenkey = await getDataStreamListenKey()

    console.log("listenkey", listenkey)

    console.log("WebSocket connection to exchange opened")

    wss.on("connection", async (wsClient: WebSocket, req: any) => {
        // Log the request URL
        console.log("Request URL:", req.url)
        if (!wsTestURL || !streamUrl) {
            console.error("No test WebSocket URL provided")
            wsClient.send("No test WebSocket URL provided")
            return
        }
        await userDataReportWebsocket(wsClient, testApiKey, testApiSecret, streamUrl, requestId)
        const orderController = new OrderController(wsClient, wsTestURL, requestId, testApiSecret)
        // Check if the request URL is '/exchangeInfo'
        if (req.url?.startsWith("/binanceAllOrders")) {
            console.log("Inside orderStatus condition")
            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                if (!wsTestURL) {
                    console.error("Incorrect WebSocket URL provided")
                    wsClient.send("Incorrect Websocket URL provided")
                } else {
                    allOrdersWebsocket(
                        wsClient,
                        wsTestURL,
                        requestId,
                        testApiSecret,
                        testApiKey,
                        req,
                    )
                }
            }
        } 

        else if (req.url?.startsWith("/binanceCancelAndReplaceOrder")) {
            console.log("Inside cancelAndReplaceOrder condition");
        
            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided");
                wsClient.send("No test API key or secret provided");
            } else {
                const parsedUrl = url.parse(req.url, true);
                if (parsedUrl && parsedUrl.query) {
                    const { symbol, cancelReplaceMode, cancelOrderId, side, type, quantity, price } = parsedUrl.query;
        
                    if (
                        symbol &&
                        typeof symbol === "string" &&
                        cancelReplaceMode &&
                        (cancelReplaceMode === "STOP_ON_FAILURE" || cancelReplaceMode === "ALLOW_FAILURE") &&
                        cancelOrderId &&
                        typeof cancelOrderId === "string" &&
                        side &&
                        (side === "BUY" || side === "SELL") &&
                        type &&
                        typeof type === "string" &&
                        quantity &&
                        typeof quantity === "string" &&
                        price &&
                        typeof price === "string"
                    ) {
                        orderController
                            .handleBinanceCancelReplaceOrder(
                                wsClient,
                                symbol,
                                cancelReplaceMode,
                                Number(cancelOrderId),
                                side,
                                type,
                                quantity,
                                price,
                                requestId,
                                testApiKey,
                                testApiSecret,
                            )
                            .then(() => {
                                wsClient.send("Order successfully canceled and replaced.");
                            })
                            .catch((err) => {
                                wsClient.send(`Error canceling and replacing order: ${err.message}`);
                            });
                    } else {
                        console.log("Invalid request URL or missing parameters.");
                        wsClient.send("Invalid request URL or missing parameters.");
                    }
                } else {
                    console.log("Invalid request URL or missing parameters.");
                    wsClient.send("Invalid request URL or missing parameters.");
                }
            }
        }  
        else if (req.url?.startsWith("/binanceCancelOCOOrder")) {
            console.log("Inside cancelOCOOrder condition")

            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                const parsedUrl = url.parse(req.url, true)
                if (parsedUrl && parsedUrl.query) {
                    const { symbol, orderListId } = parsedUrl.query

                    if (
                        symbol &&
                        typeof symbol === "string" &&
                        orderListId &&
                        typeof orderListId === "string"
                    ) {
                        orderController
                            .handleBinanceCancelOCOOrder(
                                wsClient,
                                symbol,
                                Number(orderListId),
                                testApiKey,
                                testApiSecret,
                                requestId,
                            )
                            .then(() => {
                                wsClient.send("OCO order successfully canceled.")
                            })
                            .catch((err) => {
                                wsClient.send(`Error canceling OCO order: ${err.message}`)
                            })
                    }
                } else {
                    console.log("Invalid request URL or missing parameters.")
                }
            }
        } else if (req.url?.startsWith("/binanceCancelAllOrders")) {
            console.log("Inside cancelAllOrders condition")
  
            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                const parsedUrl = url.parse(req.url, true)
                if (parsedUrl && parsedUrl.query) {
                    const { symbol } = parsedUrl.query

                    if (
                        symbol &&
                        typeof symbol === "string" 
                    ) {
                        orderController
                            .handleBinanceCancelAllOrders(
                                wsClient,
                                symbol,
                                requestId,
                                testApiKey,
                                testApiSecret,
                            )
                            .then(() => {
                                wsClient.send("Order successfully canceled.")
                            })
                            .catch((err) => {
                                wsClient.send(`Error canceling order: ${err.message}`)
                            })
                    }
                } else {
                    console.log("Invalid request URL or missing parameters.")
                }
            }
        } else if (req.url?.startsWith("/binanceCancelOrder")) {
            console.log("Inside cancelOrder condition")

            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                const parsedUrl = url.parse(req.url, true)
                if (parsedUrl && parsedUrl.query) {
                    const { symbol, orderId } = parsedUrl.query

                    if (
                        symbol &&
                        typeof symbol === "string" &&
                        orderId &&
                        typeof orderId === "string"
                    ) {
                        orderController
                            .handleBinanceCancelOrder(
                                wsClient,
                                symbol,
                                Number(orderId),
                                testApiKey,
                                testApiSecret,
                                requestId,
                            )
                            .then(() => {
                                wsClient.send("Order successfully canceled.")
                            })
                            .catch((err) => {
                                wsClient.send(`Error canceling order: ${err.message}`)
                            })
                    }
                } else {
                    console.log("Invalid request URL or missing parameters.")
                }
            }
        } else if (req.url?.startsWith("/binanceExchangeInfo")) {
            console.log("Inside exchangeInfo condition")
            if (wsTestURL) {
                exchangeInfoWebsocket(wsClient, wsTestURL, requestId)
            } else {
                console.error("No test WebSocket URL provided")
                wsClient.send("No test WebSocket URL provided")
            }
            // Test message to confirm data sending
            // wsClient.send('Test exchangeInfo message');
        } else if (req.url?.startsWith("/binanceLimitOrder")) {
            console.log("Inside limitOrder condition")

            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                if (!wsTestURL) {
                    console.error("Incorrect WebSocket URL provided")
                    wsClient.send("Incorrect WebSocket URL provided")
                } else {
                    // Parse the limit order request to get necessary parameters
                    // const { symbol, side, price, quantity, requestId } = parseLimitOrderRequest(req);
                    const parsedUrl = url.parse(req.url, true)
                    if (parsedUrl && parsedUrl.query) {
                        const { symbol, side, price, quantity } = parsedUrl.query

                        // Handle the limit order

                        if (
                            symbol &&
                            typeof symbol === "string" &&
                            side &&
                            typeof side === "string" &&
                            price &&
                            typeof price === "string" &&
                            quantity &&
                            typeof quantity === "string"
                        ) {
                            orderController
                                .handleBinanceLimitOrder(
                                    wsClient,
                                    symbol,
                                    side,
                                    quantity,
                                    price,
                                    requestId,
                                    testApiKey,
                                    testApiSecret,
                                )
                                .then(() => {
                                    wsClient.send("Limit order successfully placed.")
                                })
                                .catch((err) => {
                                    wsClient.send(`Error placing Limit order: ${err.message}`)
                                })
                        }
                    } else {
                        console.log("Invalid request URL or missing parameters.")
                    }
                    // Create an instance of OrderController
                }
            }
        } else if (req.url?.startsWith("/binanceMarketOrder")) {
            console.log("Inside marketOrder condition")
            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                if (!wsTestURL) {
                    console.error("Incorrect WebSocket URL provided")
                    wsClient.send("Incorrect WebSocket URL provided")
                } else {
                    // Assuming you have a function to parse and validate the request parameters
                    // const params = parseMarketOrderRequest(req);
                    const parsedUrl = url.parse(req.url, true)

                    if (parsedUrl && parsedUrl.query) {
                        const { symbol, side, quantity } = parsedUrl.query

                        if (
                            symbol &&
                            typeof symbol === "string" &&
                            side &&
                            typeof side === "string" &&
                            quantity &&
                            typeof quantity === "string"
                        ) {
                            orderController
                                .handleBinanceMarketOrder(
                                    wsClient,
                                    symbol,
                                    side,
                                    quantity,
                                    requestId,
                                    testApiKey,
                                    testApiSecret,
                                )
                                .then(() => {
                                    wsClient.send("Market order successfully placed.")
                                })
                                .catch((err) => {
                                    wsClient.send(`Error placing market order: ${err.message}`)
                                })
                        } else {
                            wsClient.send(
                                "Missing required parameters: symbol, side, or quantity.",
                            )
                        }
                    } else {
                        wsClient.send("Invalid request URL or missing parameters.")
                    }
                }
            }
        } else if (req.url?.startsWith("/binanceOrderStatus")) {
            console.log("Inside orderStatus condition")
            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                if (!wsTestURL) {
                    console.error("Incorrect WebSocket URL provided")
                    wsClient.send("Incorrect Websocket URL provided")
                } else {
                    orderStatusWebsocket(
                        wsClient,
                        wsTestURL,
                        requestId,
                        testApiSecret,
                        testApiKey,
                        req,
                    )
                }
            }
        } else if (req.url?.startsWith("/binancePriceFeed")) {
            console.log("Inside priceFeed condition")
            if (!streamUrl) {
                console.error("Incorrect WebSocket URL provided")
                wsClient.send("Incorrect Websocket URL provided")
            } else {
                binancePriceFeedWebsocket(wsClient, streamUrl, req, listenkey)
            }
        } else if (req.url?.startsWith("/binanceUserDataReport")) {
            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
                return
            }
            if (!wsTestURL) {
                console.error("Incorrect WebSocket URL provided")
                wsClient.send("Incorrect Websocket URL provided")
            } else {
                userDataReportWebsocket(wsClient, testApiKey, testApiSecret, wsTestURL, requestId)
            }
        } else if (req.url?.startsWith("/binanceUserInfo")) {
            if (!testApiKey || !testApiSecret) {
                console.error("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                if (!wsTestURL) {
                    console.error("Incorrect WebSocket URL provided")
                    wsClient.send("Incorrect Websocket URL provided")
                } else {
                    userInfoWebsocket(wsClient, wsTestURL, testApiKey, testApiSecret, requestId)
                }
            }
        } else if (req.url?.startsWith("/binanceOcoOrder")) {
            console.log("Inside OCO Order condition")

            if (!testApiKey || !testApiSecret) {
                console.log("No test API key or secret provided")
                wsClient.send("No test API key or secret provided")
            } else {
                if (!wsTestURL) {
                    console.error("Incorrect WebSocket URL provided")
                    wsClient.send("Incorrect WebSocket URL provided")
                } else {
                    // Parse the OCO order request to get necessary parameters
                    const parsedUrl = url.parse(req.url, true)
                    if (parsedUrl && parsedUrl.query) {
                        const { symbol, side, stopPrice, price, quantity, stopLimitPrice } =
                            parsedUrl.query
                        console.log(
                            symbol,
                            side,
                            stopPrice,
                            price,
                            quantity,
                            stopLimitPrice,
                            "from parsed url inside oco order",
                        )
                        try {
                            // Handle the OCO order
                            if (
                                symbol &&
                                typeof symbol === "string" &&
                                side &&
                                typeof side === "string" &&
                                price &&
                                typeof price === "string" &&
                                quantity &&
                                typeof quantity === "string" &&
                                stopPrice &&
                                typeof stopPrice === "string" &&
                                stopLimitPrice &&
                                typeof stopLimitPrice === "string"
                            ) {
                                await orderController.handleBinanceLimitOcoOrder(
                                    wsClient,
                                    symbol,
                                    side,
                                    price,
                                    quantity,
                                    stopPrice,
                                    stopLimitPrice,
                                    requestId,
                                    testApiKey,
                                    testApiSecret,
                                )
                            }

                            wsClient.send("OCO order placed successfully")
                        } catch (error) {
                            console.error("Error placing OCO order:", error)
                            wsClient.send("Error placing OCO order")
                        }
                    } else {
                        console.log("Invalid request URL or missing parameters.")
                    }
                }
            }
        } else if (req.url?.startsWith("/binanceTrades")) {
        } else if (req.url?.startsWith("/")) {
        } else if (req.url?.startsWith("/")) {
        } else if (req.url?.startsWith("/")) {
        } else if (req.url?.startWith("/")) {
        }

        wsClient.addListener("message", async function incoming(message) {
            wsClient.send(message)
        })

        wsClient.on("close", function close() {
            console.log("Client disconnected")
        })

        wsClient.on("error", function error(err) {
            console.log("WebSocket error:", err.message)
        })
    })
}
