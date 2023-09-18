import express, { NextFunction, Request, Response } from "express"
import {
    cancelOrder /*getAllOrdersFromBinance */ /*getOrderStatusFromBinance, checkConnection */,
} from "./services/binanceService"
interface RequestWithOrders extends Request {
    orders?: any // Replace 'any' with the actual type of your orders
}

interface OrderStatus {
    orderId: string
    status?: string

    // Add other properties as needed
}

interface RateLimit {
    rateLimitType: string
    interval: string
    intervalNum: number
    limit: number
}
interface SymbolInfo {
    symbol: string
    status: string
    baseAsset: string
    baseAssetPrecision: number
    quoteAsset: string
    quotePrecision: number
    quoteAssetPrecision: number
    baseCommissionPrecision: number
    quoteCommissionPrecision: number
    orderTypes: string[]
    icebergAllowed: boolean
    ocoAllowed: boolean
    quoteOrderQtyMarketAllowed: boolean
    allowTrailingStop: boolean
    cancelReplaceAllowed: boolean
    isSpotTradingAllowed: boolean
    isMarginTradingAllowed: boolean
    filters: Filter[]
    permissions: string[]
    defaultSelfTradePreventionMode: string
    allowedSelfTradePreventionModes: string[]
}

interface Filter {
    filterType: string
    minPrice?: string
    maxPrice?: string
    tickSize?: string
    minQty?: string
    maxQty?: string
    stepSize?: string
}

interface ExchangeInfoData {
    id: string
    status: number
    method: string
    result: {
        timezone: string
        serverTime: number
        rateLimits: RateLimit[]
        exchangeFilters: any[] // replace 'any' with the actual type if you know it
        symbols: SymbolInfo[]
    }
    rateLimits: RateLimit[]
}

interface BinanceConnectionCheck {
    id: string
    status: number
    result: object[]
    rateLimits: object[]
}

interface OrderStatusRequest extends Request {
    orderId?: number
    orderStatus?: OrderStatus // Define the orderStatus property with the appropriate type
}

const router = express.Router()

router.get("/", (req: Request, res: Response) => {
    res.send("Hello World!")
})

export default router
