
// export const runtime = 'nodejs'


import { withApiAuthRequired, getSession } from "@auth0/nextjs-auth0"
import { NextResponse, NextRequest } from "next/server"
import crypto from "crypto"
import  {NextApiRequest, NextApiResponse} from 'next'

const apiKey = process.env.BINANCE_API_KEY
const apiSecret = process.env.BINANCE_SECRET_KEY

const testApiKey = process.env.BINANCE_TEST_API_KEY
const testApiSecret = process.env.BINANCE_TEST_API_SECRET_KEY

const binanceUrl = process.env.BINANCE_URL
const binanceTestUrl = process.env.BINANCE_TEST_URL
const authUrl = process.env.AUTH0_ISSUER_BASE_URL
const authClientId = process.env.AUTH0_CLIENT_ID
const authClientSecret = process.env.AUTH0_CLIENT_SECRET
const authAudience = process.env.AUTH_AUDIENCE

interface Auth0Response {
    access_token: string;
    error_description?: string;
    // Add other fields as needed
  }
  

async function fetchWithTimeout(resource: string, options: object, timeout = 1000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(resource, { ...options, signal: controller.signal })
    clearTimeout(id)

    return response
}





async function getAccessToken() {
    const url = `${authUrl}/oauth/token`;
    const body = {
        client_id: `${authClientId}`,
        client_secret: `${authClientSecret}`,
        audience: `${authAudience}`,
        grant_type: 'client_credentials'
    };
    
    console.log('Getting access token from Auth0...');

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
   

    const data = await res.json() as Auth0Response;
    //console.log('Response data:', data);


    if (res.ok) {
        console.log('Got access token:', data.access_token);

        return data.access_token;
    } else {
        console.error('Failed to get access token:', data.error_description || 'Unknown error');

        throw new Error(data.error_description || 'Failed to get access token');
    }
}

const DELETE = withApiAuthRequired( async (req: NextApiRequest) => {
    try {
        console.log("getting access token")
        const accessToken = await getAccessToken();
        console.log("access token", accessToken)
        console.log("getting session")
        const session = await getSession();
        console.log("session", session?.user)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            
        }
   
        if (!testApiSecret) {
            throw new Error("API secret is not defined!")
        }
    
     
        const { searchParams } = new URL(req.url || '', 'http://localhost')
        console.log("search params", searchParams)
        let body 
        try {
            body = await req.body;
            console.log("body",  NextResponse.json({ body: body }, { status: 200 }))
        } catch (error) {
            console.error('Error parsing request body:', error);
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400});
        }
    
        if (!body || !body.symbol || !body.orderId  ) {
            throw new Error("Invalid request body!")
        }
    
        const { symbol, orderId} = body
    
    
        // create the base query string
        let queryString = `symbol=${symbol}&orderId=${orderId}`
    
       
    
        // Logic to apply time in foroce only for limit orders
    
        // Create signature
        let timestamp = Date.now()
        const recvWindow = "50000"
        // Add timestamp and recvWindow
        queryString += `&recvWindow=${recvWindow}&timestamp=${timestamp}`
        const signature = crypto.createHmac("sha256", testApiSecret).update(queryString).digest("hex")
    
        console.log(timestamp)
        console.log("hashing the string for custom order: ")
        console.log(`timestamp=${queryString}`)
        console.log("and return:", signature)
    
        // Fetch binane order api with signature
    
        try {
            console.log(
                `Sending request to Binance API with URL: ${binanceTestUrl}/order?${queryString}&signature=${signature}`,
            )
    
            let response = await fetchWithTimeout(
                `${binanceTestUrl}/order?${queryString}&signature=${signature}`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        "authorization": `Bearer ${accessToken}`,
                        "X-MBX-APIKEY": testApiKey,
                    },
                 
                },
                5000,
            )
    
            if (response.ok) {
                const data = await response.json()
                console.log("Response from Binance API:", data)
                console.log("body data", body)
                return NextResponse.json({ data }, { status: 200 }) as NextResponse;

            } else {
                try {
                    const errordata = await response.json()
                    console.error("Error response from Binance API:", errordata)
                } catch (e: any) {
                    console.error("Failed to parse error response from Binance API:", e)
                    return  NextResponse.json({ error: e.message }, { status: 500 }) as NextResponse;
                }
            }
        } catch (error: any) {
            console.error(error)
            return NextResponse.json({ error: error.message }, { status: 500 }) as NextResponse
        }
    } catch (error:any) {
        console.error(error)
        return NextResponse.json({ error: error.message }, { status: 500 }) as NextResponse
    }
})

export {DELETE}