import { withApiAuthRequired, getSession } from "@auth0/nextjs-auth0";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_SECRET_KEY;
const testApiKey = process.env.BINANCE_TEST_API_KEY;
const testApiSecret = process.env.BINANCE_TEST_SECRET_KEY;

const binanceUrl = process.env.BINANCE_URL;
const binanceTestUrl = process.env.BINANCE_TEST_URL;

type Data = {
    name: string
}

type OrderRequest = {
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    stopPrice: number;
    stopLimitPrice: number;
    timeInForce?: string;
    newOrderRespType?: string;
};


interface Auth0Response {
    access_token: string;
    error_description?: string;
    // Add other fields as needed
  }
  interface SymbolInfo {
    symbol: string;
    filters: Filter[];
  }

  interface Filter {
    filterType: string;
    stepSize?: string;
    tickSize?: string;
    // Add other properties as needed
  }

  interface ExchangeInfo {
    symbols: SymbolInfo[];
  }
async function fetchWithTimeout(resource: string, options: object, timeout = 1000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);

    return response;
}

async function getFilters(symbol: string) {
    const response = await fetch(`${binanceTestUrl}/exchangeInfo`);
    const exchangeInfo = await response.json() as ExchangeInfo;
    const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === symbol);

    const lotSizeFilter = symbolInfo?.filters.find((f: any) => f.filterType === "LOT_SIZE");
    const priceFilter = symbolInfo?.filters.find((f: any) => f.filterType === "PRICE_FILTER");
      
    if (!lotSizeFilter || !priceFilter) {
        throw new Error("Filters not found for the given symbol");
      }
    return { lotSizeFilter, priceFilter };
}

function roundToPrecision(num: number, precision: number) {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}

async function getAccessToken() {
    const url = `https://dev-0nw5lm1dtkpxtx8q.us.auth0.com/oauth/token`;
    const body = {
        client_id: 'KMLDVVLgRUkHL4iS0oJAS7FJXMO0Oc64',
        client_secret: 'qGDi-YaMFRKU3l8xwTQXxPKbSqZ4ojUZb2NPt6pXZMvkhuC46razJCmMOSxbSokR',
        audience: 'https://dev-0nw5lm1dtkpxtx8q.us.auth0.com/api/v2/',
        grant_type: 'client_credentials'
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json() as Auth0Response;

    if (res.ok) {
        return data.access_token;
    } else {
        throw new Error(data.error_description || 'Failed to get access token');
    }
}

const POST = withApiAuthRequired(async (req:any, res:any ) => {
    try {
        const accessToken = await getAccessToken();

        const session = await getSession(req, res);
        if (!session || !session.user) {
            return NextResponse.json({ name: 'Unauthorized' });
        }

        if (! testApiSecret) {
        throw new Error("API secret is not defined!")
    }

        const body =  await req.json();
        console.log("body before", body);
        const { symbol, side, quantity, price, stopPrice, stopLimitPrice } = body;
        if (!body || !symbol || !side || !quantity || !price || !stopPrice || !stopLimitPrice) {
            throw new Error("Invalid request body!");
        }

        const { lotSizeFilter, priceFilter } = await getFilters(symbol);
         
        // Calculate precision for quantity and price
        const quantityPrecision = lotSizeFilter.stepSize ? parseFloat(lotSizeFilter.stepSize).toString().split(".")[1]?.length || 0 : 0;
        const pricePrecision = priceFilter.tickSize ? parseFloat(priceFilter.tickSize).toString().split(".")[1]?.length || 0 : 0;

        // Adjust quantity and price to the correct precision
        let adjustedQuantity = roundToPrecision(parseFloat(quantity), quantityPrecision);
        let adjustedPrice = roundToPrecision(parseFloat(price), pricePrecision);
        let adjustedStopPrice = roundToPrecision(parseFloat(stopPrice), pricePrecision);
        let adjustedStopLimitPrice = roundToPrecision(parseFloat(stopLimitPrice), pricePrecision);

        // Create the base query string
        let queryString = `symbol=${symbol}&side=${side}&type=OCO&quantity=${adjustedQuantity}`;
        queryString += `&price=${adjustedPrice}&stopPrice=${adjustedStopPrice}&stopLimitPrice=${adjustedStopLimitPrice}`;

        // Create unique client order ids
        const listClientOrderId = uuidv4();
        const limitClientOrderId = uuidv4();
        const stopClientOrderId = uuidv4();

        // Add them to the query string
        queryString += `&listClientOrderId=${listClientOrderId}`;
        queryString += `&limitClientOrderId=${limitClientOrderId}`;
        queryString += `&stopClientOrderId=${stopClientOrderId}`;

        // Handle newOrderRespType if provided
        const newOrderRespType = body.newOrderRespType ? body.newOrderRespType : null;
        if (newOrderRespType) {
            if (['ACK', 'RESULT', 'FULL'].includes(newOrderRespType)) {
                queryString += `&newOrderRespType=${newOrderRespType}`;
            } else {
                throw new Error("Invalid newOrderRespType. Valid values are 'ACK', 'RESULT', or 'FULL'");
            }
        }

        // Add timeInForce only for limit orders
        const timeInForce = body.timeInForce ? body.timeInForce : "GTC";
        queryString += `&timeInForce=${timeInForce}`;

        // Create signature 
        let timestamp = Date.now();
        const recvWindow = "50000";
        // Add timestamp and recvWindow
        queryString += `&recvWindow=${recvWindow}&timestamp=${timestamp}`;
        const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex");

        // Fetch binane order api with signature
        let response = await fetchWithTimeout(
            `${binanceTestUrl}/order/oco?${queryString}&signature=${signature}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "authorization": `Bearer ${accessToken}`,
                    "X-MBX-APIKEY": testApiKey,
                    
                },
            },
            5000,
        );

        if (response.ok) {
            const data = await response.json();
            console.log(data);
            return NextResponse.json(data);
        } else {
            const errorData = await response.json();
            console.log(errorData);
            return NextResponse.json(errorData);
        }
    } catch (error: any) {
        console.log(error);
        return NextResponse.json({ name: error.message });
    }
}
);
export {POST};
