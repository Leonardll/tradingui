//export const runtime = 'edge'

import { NextResponse } from "next/server"



export async function GET() {

        const cc_api_key = process.env.CC_API_KEY;

    if(!cc_api_key) {
        throw new Error("API key is not defined!");
    }
   
    let res = await fetch(`https://min-api.cryptocompare.com/data/all/coinlist?api_key=${cc_api_key}`)
    const data = await res.json()

    return NextResponse.json({ data})
}


