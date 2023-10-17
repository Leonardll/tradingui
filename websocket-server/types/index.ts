import { IOrder } from "../db/models/binance/Order";
import { Observable } from "rxjs";
export type Asset = string
export type EventTime = number
export type OrderId = number
export type ClientOrderId = string
export type Symbolx = string
export type Balance = number


export interface MarketOrderParams {
    symbol: string
    side: string
    type: "MARKET"
    quantity: string
    timestamp: number
    recvWindow?: number
    apiKey: string
    signature: string
}
export interface LimitOrderParams {
    symbol: string
    side: string
    type: "LIMIT"
    quantity: string
    price: string
    timeInForce: string
    timestamp: number
    recvWindow?: number
    apiKey: string
    signature?: string
    icebergQty?: number
    newClientOrderId?: string
    newOrderRespType?: string
    stopPrice?: number
    workingType?: string
}

export interface OCOOrderParams {
    symbol: string
    side: string
    price: string
    quantity: string
    stopPrice: string
    stopLimitPrice: string
    stopLimitTimeInForce: string
    recvWindow: number
    timestamp: number
    apiKey: string
    signature?: string
    listClientOrderId?: string
    limitClientOrderId?: string
    stopClientOrderId?: string
    limitIcebergQty?: string
    stopIcebergQty?: string
    newOrderRespType?: string
}

export interface CancelOrderParams {
    symbol: string
    orderId: number
    timestamp: number
    recvWindow: number
    apiKey: string
    signature: string
    newClientOrderId: boolean
}
 export interface CancelAllOrdersParams {
    symbol: string
    timestamp: number
    recvWindow: number
    apiKey: string
    signature: string
    newClientOrderId?: boolean
 }

export interface CancelOCOOrderParams {
    symbol: string
    orderListId: number
    timestamp: number
    recvWindow: number
    apiKey: string
    signature: string
    newClientOrderId: boolean
}

export interface BinanceMessage {
    stream: string
    data: any // Replace 'any' with the actual type if known
    method: string
}

export interface RateLimitInfo {
    rateLimitType: string
    interval: string
    intervalNum: number
    limit: number
    count: number
}
export type WebsocketCallback = (message: string | Buffer) => void
export type ParamsType = {
    orderId?: number
    signature?: string
    timestamp?: number
    symbols?: string[]
    symbol?: string
    apiKey?: string
    listenKey?: string
    recvWindow?: number
    // add other possible fields here
}

export interface BinanceErrorType {
    code: number
    msg: string
}

export interface Fill {
    price: string
    qty: string
    commission: string
    commissionAsset: string
    tradeId: number
}

export interface RateLimit {
    rateLimitType: string
    interval: string
    intervalNum: number
    limit: number
    count: number
}

export interface OrderResult {
    symbol: string
    orderId: number
    orderListId: number
    clientOrderId: string
    transactTime: number
    price: string
    origQty: string
    executedQty: string
    cummulativeQuoteQty: string
    status: string
    timeInForce: string
    type: string
    side: string
    workingTime: number
    fills?: Fill[] // Optional, as it may not be present in all responses
}
export interface ListStatusData {
    e: "listStatus"
    E: EventTime
    s: Symbol
    g: number // OrderListId
    c: string // Contingency Type
    l: string // List Status Type
    L: string // List Order Status
    r: string // List Reject Reason
    C: string // List Client Order Id
    T: EventTime // Transaction Time
    O: Array<{
        s: Symbol
        i: OrderId
        c: ClientOrderId
    }>
}
export interface Fill {
    price: string
    qty: string
    commission: string
    commissionAsset: string
    tradeId: number
}

export interface OCOOrderInfo {
    symbol: string
    orderId: number
    clientOrderId: string
}

export interface OrderResult {
    symbol: string
    orderId: number
    orderListId: number
    clientOrderId: string
    transactTime: number
    price: string
    origQty: string
    executedQty: string
    cummulativeQuoteQty: string
    status: string
    timeInForce: string
    type: string
    side: string
    workingTime: number
    fills?: Fill[] // Optional, as it may not be present in all responses
}
export interface OrderResponse {
    id: string
    status: number
    result: OrderResult
    rateLimits: RateLimit[]
}

export interface OCOOrderResult extends OrderResult {
    orderListId: number
}

export interface OCOOrderResponse {
    id: string
    status: number
    result: {
        orderListId: number
        contingencyType: string
        listStatusType: string
        listOrderStatus: string
        listClientOrderId: string
        transactionTime: number
        symbol: string
        orders: OCOOrderInfo[]
        orderReports: OCOOrderResult[]
    }
    rateLimits: RateLimit[]
}

export interface OrderResponse {
    id: string
    status: number
    result: OrderResult
    rateLimits: RateLimit[]
}
export interface TradeOrder {
    side: string
    price: string
    quantity: string
    // Add other order fields as needed
}

export interface Order {
    symbol: string
    orderId: string
    origClientOrderId: string
    newOrderRespType?: string
    action?: string
    order?: string
    status?: string
}
export interface OrderStatusResponse {
    result: [symbol: string, orderId: number]
    rateLimits: object[]
}

export interface BinanceResponse {
    id: string
    result: []
}

export interface BinanceConnectionCheck {
    id: string
    status: number
    result: object[]
    rateLimits: object[]
}
export interface Data {
    e: string
    x: string
    i: string
    l: string
    s: string
    o: string
    id?: string // Add this line
    result?: Order[]
}



export interface RateLimit {
    rateLimitType: string
    interval: string
    intervalNum: number
    limit: number
}

export interface Filter {
    filterType: string
    minPrice?: string
    maxPrice?: string
    tickSize?: string
    minQty?: string
    maxQty?: string
    stepSize?: string
}

export interface Symbol {
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

export interface Order {
    symbol: string
    orderId: string
    origClientOrderId: string
    action?: string
    order?: string
    status?: string
}

export interface Data {
    e: string
    x: string
    i: string
    l: string
    s: string
    id?: string // Add this line
    result?: Order[]
}

export interface GenericPriceData {

    timestamp: number;
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface RateLimit {
    rateLimitType: string
    interval: string
    intervalNum: number
    limit: number
}

export interface ExchangeInfoData {
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

export interface BalanceUpdateData {
    e: "balanceUpdate"
    E: EventTime
    a: Asset
    d: string
    T: EventTime
}

export interface SymbolInfo {
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

export interface Filter {
    filterType: string
    minPrice?: string
    maxPrice?: string
    tickSize?: string
    minQty?: string
    maxQty?: string
    stepSize?: string
}

export interface ExecutionReportData {
    e: string
    E: EventTime
    s: Symbolx
    c: ClientOrderId
    S: "BUY" | "SELL"
    o:
        | "LIMIT"
        | "MARKET"
        | "STOP_LOSS"
        | "STOP_LOSS_LIMIT"
        | "TAKE_PROFIT"
        | "TAKE_PROFIT_LIMIT"
        | "LIMIT_MAKER"
    f: string
    q: string
    p: string
    P: string
    F: string
    g: number
    C: string
    x:
        | "NEW"
        | "PARTIALLY_FILLED"
        | "FILLED"
        | "CANCELED"
        | "PENDING_CANCEL"
        | "REJECTED"
        | "EXPIRED"
    X: string
    r: string
    i: OrderId
    l: string
    z: string
    L: string
    n: string
    N: string
    T: number
    t: number
    I: number
    w: boolean
    m: boolean
    M: boolean
    O: number
    Z: string
    Y: string
    Q: string
    W: string
    V: string
}

export interface ListStatusData {
    e: "listStatus"
    E: EventTime
    s: Symbol
    g: number // OrderListId
    c: string // Contingency Type
    l: string // List Status Type
    L: string // List Order Status
    r: string // List Reject Reason
    C: string // List Client Order Id
    T: EventTime // Transaction Time
    O: Array<{
        s: Symbol
        i: OrderId
        c: ClientOrderId
    }>
}

export interface OutboundAccountPositionData {
    e: "outboundAccountPosition"
    E: EventTime
    u: EventTime
    B: Array<{
        a: Asset
        f: Balance
        l: Balance
    }>
}
export interface BinancePriceFeedMessage {
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



  
 export  interface CancelReplaceResponse {
    id: string;
    status: number;
    result?: {
      cancelResult: string;
      newOrderResult: string;
      cancelResponse: any; // Define this based on your needs
      newOrderResponse: any; // Define this based on your needs
    };
    error?: {
      code: number;
      msg: string;
      data: any; // Define this based on your needs
    };
    rateLimits: RateLimit[];
  }

  export interface OCOOrderInfo {
    symbol: string
    orderId: number
    clientOrderId: string
}



export interface OCOOrderResponse {
    id: string
    status: number
    result: {
        orderListId: number
        contingencyType: string
        listStatusType: string
        listOrderStatus: string
        listClientOrderId: string
        transactionTime: number
        symbol: string
        orders: OCOOrderInfo[]
        orderReports: OCOOrderResult[]
    }
    rateLimits: RateLimit[]
}

export interface CancelOrderResponse {
    symbol: string
    origClientOrderId: string
    orderId: number
    orderListId: number
    clientOrderId: string
    price: string
    origQty: string
    executedQty: string
    cummulativeQuoteQty: string
    status: string
    timeInForce: string
    type: string
    side: string
}

  
export interface CancelAndReplaceOrderParams {
    symbol: string;
    cancelReplaceMode: 'STOP_ON_FAILURE' | 'ALLOW_FAILURE';
    cancelOrderId: number;
    cancelOrigClientOrderId?: string;
    cancelNewClientOrderId?: string;
    side: 'BUY' | 'SELL';
    type: string; // You can further restrict this to the types Binance supports like 'LIMIT', 'MARKET', etc.
    timeInForce?: string; // Similarly, you can restrict this to 'GTC', 'IOC', etc.
    price?: string;
    quantity?: string;
    quoteOrderQty?: number;
    newClientOrderId?: string;
    newOrderRespType?: string; // 'ACK', 'RESULT', 'FULL'
    stopPrice?: string;
    trailingDelta?: number;
    icebergQty?: number;
    strategyId?: number;
    strategyType?: number;
    selfTradePreventionMode?: string; // You can restrict this to the types Binance supports
    cancelRestrictions?: string; // 'ONLY_NEW', 'ONLY_PARTIALLY_FILLED', etc.
    apiKey: string;
    recvWindow?: number;
    signature?: string;
    timestamp: number;
  }

export interface IDataFeed {
    getPriceFeed(symbol: string, timeframes: string[]): Observable<BinancePriceFeedMessage>;
    // ... other methods
}


