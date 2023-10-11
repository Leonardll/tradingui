import { OrderModel } from "./db/models/binance/Order"
import express, { Express, Request, Response, NextFunction } from "express"
import http from "http"
import cors from "cors"
import routes from "./routes" // Assuming you have a routes.ts file
import dotenv from "dotenv"
import { setupWebSocketServer } from "./websocketServer"
import { connectToMongoDB } from "./db"
import { set } from "mongoose"
import { eventEmitter } from "./events/eventEmitter"
import {
    fetchMyTrade,
    fetchCurrentOrderCount,
} from "./services/binanceApiService/binanceApiService"
import { uploadTradesToDB } from "./db/operations/binance/tradeOps"
dotenv.config({ path: ".env.test" })

const app = express()
app.use(express.json())
app.use(cors())
const httpPort = process.env.PORT || 4000
const httpServer = http.createServer(app)
const wsPort = process.env.PORT || 4001

const wsServer = http.createServer()
setupWebSocketServer(wsServer)
wsServer.listen(wsPort, () => {
    console.log(`Websocket Server is running on port ${wsPort}`)
})

interface ClientData {
    symbol: string
    orderId: string
}

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "connect-src ws://localhost:4001 http://localhost:4000;",
    )
    next()
})

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack)
    res.status(500).send("Something broke!")
})

// Routes
routes.get("/myBinanceTrades", async (req, res) => {
    try {
        if (!req.query.symbol) {
            res.status(400).send("Missing query parameters")
            return
        }

        const mytrades = await fetchMyTrade(req.query.symbol, Number(req.query.orderId))
        const exchangeId = "binance"
        const tradeCount = mytrades.length
        await uploadTradesToDB(mytrades, exchangeId)

        res.send({ apiTradeCount: tradeCount, trades: mytrades })
    } catch (error) {
        console.error("An error occurred:", error)
        res.status(500).send("Internal Server Error")
    }
})

routes.get("/ordersRateLimit", async (req, res) => {
    const ordersRateLimit = await fetchCurrentOrderCount()
    res.send(ordersRateLimit)
})

routes.get("/preventedMatches", async (req, res) => {
    if (!req.query.symbol) {
        res.status(400).send("Missing query parameters")
        return
    }
    const preventedMatches = await fetchMyTrade(req.query.symbol, Number(req.query.orderId))

    res.send(preventedMatches)
})
// connectToMongoDB()
//   .then(() => {
//     // You can now use the Order model to interact with the database
//     AllTrades.find({ symbol: 'BTCUSDT' }).lean()
//       .then((order) => console.log('Order found:', order))
//       .catch((error) => console.error('Error finding order:', error));
//   })

// Setup WebSocket server

// Start listening for connections
app.use("/", routes)

async function initializeApplication() {
    try {
        // MongoDB initialization

        await connectToMongoDB()
        console.log("MongoDB connected")

        httpServer.listen(httpPort, () => {
            console.log(`Server is running on port ${httpPort}`)
        })
    } catch (error) {
        console.error("error during itinitialisation", error)
    }
}

initializeApplication()
// Now it's safe to set up WebSocket server
