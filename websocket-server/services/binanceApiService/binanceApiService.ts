import axios from "axios"
import dotenv from "dotenv"
import { generateBinanceSignature} from "../../utils/signatureUtils"
import { generateDate } from "../../utils/dateUtils"
import { ParsedQs } from "qs"
import { type } from "os"
dotenv.config({ path: ".env.test" })

const testApiUrl = process.env.BINANCE_TEST_URL
const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY

interface TradeResponseData {
    symbol: string
    orderId: string
    startTime: number
    stopTime: number
    fromId: number
    limit: number
}

interface PreventedMatchesParams {
    symbol: string
    preventedMatchId?: number
    orderId?: number
    fromPreventedMatchId?: number
    limit?: number
    recvWindow?: number
}

export async function fetchMyTrade(
    symbol: string | string[] | ParsedQs | ParsedQs[],
    orderId?: number,
): Promise<any> {
    if (!testApiUrl || !testApiKey || !testApiSecret) {
        throw new Error("Missing environment variables for Binance API")
    }
    if (typeof symbol !== "string") {
        throw new Error("Symbol must be a string")
    }
    const timestamp = generateDate()
    let queryString = `symbol=${symbol.toUpperCase()}&timestamp=${timestamp}`

    if (orderId) {
        queryString += `&orderId=${orderId}`
    }
    const signature = generateBinanceSignature(queryString, testApiSecret)

    try {
        const response = await axios.get(
            `${testApiUrl}/myTrades?${queryString}&signature=${signature}`,
            {
                headers: {
                    "X-MBX-APIKEY": testApiKey,
                    "CACHE-CONTROL": "no-cache",
                },
            },
        )

        console.log(response.data)
        return response.data
    } catch (error) {
        console.log("Error fetching my trade", error)
    }
}

export async function fetchCurrentOrderCount(): Promise<any> {
    if (!testApiUrl || !testApiKey || !testApiSecret) {
        throw new Error("Missing environment variables for Binance API")
    }

    const timestamp = generateDate()
    const queryString = `timestamp=${timestamp}`
    const signature = generateBinanceSignature(queryString, testApiSecret)

    try {
        const response = await axios.get(
            `${testApiUrl}/rateLimit/order?${queryString}&signature=${signature}`,
            {
                headers: {
                    "X-MBX-APIKEY": testApiKey,
                    "CACHE-CONTROL": "no-cache",
                },
            },
        )

        console.log(response.data)
        return response.data
    } catch (error) {
        console.log("Error fetching current order count", error)
    }
}

export async function fetchPreventedMatches(params: PreventedMatchesParams): Promise<any> {
    if (!testApiUrl || !testApiKey || !testApiSecret) {
        throw new Error("Missing environment variables for Binance API")
    }

    const timestamp = generateDate()
    let queryString = `symbol=${params.symbol.toUpperCase()}&timestamp=${timestamp}`

    // Add optional parameters to the query string if they exist
    if (params.preventedMatchId) queryString += `&preventedMatchId=${params.preventedMatchId}`
    if (params.orderId) queryString += `&orderId=${params.orderId}`
    if (params.fromPreventedMatchId)
        queryString += `&fromPreventedMatchId=${params.fromPreventedMatchId}`
    if (params.limit) queryString += `&limit=${params.limit}`
    if (params.recvWindow) queryString += `&recvWindow=${params.recvWindow}`

    const signature = generateBinanceSignature(queryString, testApiSecret)

    try {
        const response = await axios.get(
            `${testApiUrl}/v3/preventedMatches?${queryString}&signature=${signature}`,
            {
                headers: {
                    "X-MBX-APIKEY": testApiKey,
                    "CACHE-CONTROL": "no-cache",
                },
            },
        )

        console.log(response.data)
        return response.data
    } catch (error) {
        console.log("Error fetching prevented matches", error)
    }
}
