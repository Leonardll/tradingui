export type StreamType =
    | "aggTrade"
    | "trade"
    | "kline"
    | "miniTicker"
    | "ticker"
    | "bookTicker"
    | "depth"

export interface BaseStreamPayload {
    e: string // Event type
    E: number // Event time
    s: string // Symbol
}

export interface AggTradeStreamPayload extends BaseStreamPayload {
    e: "aggTrade"
    a: number // Aggregate trade ID
    p: string // Price
    q: string // Quantity
    f: number // First trade ID
    l: number // Last trade ID
    T: number // Trade time
    m: boolean // Is the buyer the market maker?
    M: boolean // Ignore
}

export interface TradeStreamPayload extends BaseStreamPayload {
    e: "trade"
    t: number // Trade ID
    p: string // Price
    q: string // Quantity
    b: number // Buyer order ID
    a: number // Seller order ID
    T: number // Trade time
    m: boolean // Is the buyer the market maker?
    M: boolean // Ignore
}

export interface KlineStreamPayload extends BaseStreamPayload {
    e: "kline"
    k: {
        t: number // Kline start time
        T: number // Kline close time
        s: string // Symbol
        i: string // Interval
        f: number // First trade ID
        L: number // Last trade ID
        o: string // Open price
        c: string // Close price
        h: string // High price
        l: string // Low price
        v: string // Base asset volume
        n: number // Number of trades
        x: boolean // Is this kline closed?
        q: string // Quote asset volume
        V: string // Taker buy base asset volume
        Q: string // Taker buy quote asset volume
        B: string // Ignore
    }
}

export interface MiniTickerStreamPayload extends BaseStreamPayload {
    e: "24hrMiniTicker"
    c: string // Close price
    o: string // Open price
    h: string // High price
    l: string // Low price
    v: string // Total traded base asset volume
    q: string // Total traded quote asset volume
}

export interface TickerStreamPayload extends BaseStreamPayload {
    e: "24hrTicker"
    p: string // Price change
    P: string // Price change percent
    w: string // Weighted average price
    x: string // First trade(F)-1 price
    c: string // Last price
    Q: string // Last quantity
    b: string // Best bid price
    B: string // Best bid quantity
    a: string // Best ask price
    A: string // Best ask quantity
    o: string // Open price
    h: string // High price
    l: string // Low price
    v: string // Total traded base asset volume
    q: string // Total traded quote asset volume
    O: number // Statistics open time
    C: number // Statistics close time
    F: number // First trade ID
    L: number // Last trade ID
    n: number // Total number of trades
}

export interface BookTickerStreamPayload extends BaseStreamPayload {
    u: number // Order book updateId
    b: string // Best bid price
    B: string // Best bid qty
    a: string // Best ask price
    A: string // Best ask qty
}

export interface DepthStreamPayload extends BaseStreamPayload {
    e: "depthUpdate"
    U: number // First update ID in event
    u: number // Final update ID in event
    b: [string, string][] // Bids to be updated
    a: [string, string][] // Asks to be updated
}

export interface CombinedStreamPayload {
    stream: StreamType // This will hold the stream name like 'trade', 'kline', etc.
    data: StreamPayload // This will hold the actual data payload
}

export type StreamPayload =
    | AggTradeStreamPayload
    | TradeStreamPayload
    | KlineStreamPayload
    | MiniTickerStreamPayload
    | TickerStreamPayload
    | BookTickerStreamPayload
    | DepthStreamPayload
