//export const runtime = 'edge'

import { NextResponse } from "next/server"

// Cache for storing data
 

import { NextApiRequest } from "next";

export async function GET(req: NextApiRequest) {
    const cc_api_key = process.env.CC_API_KEY;
    console.log(req.query)
    if(!cc_api_key) {
        throw new Error("API key is not defined!");
    }

    // Check if we have cached data and it's not expired
    
  

    // Fetch new data
    let res = await fetch(`https://min-api.cryptocompare.com/data/all/coinlist?api_key=${cc_api_key}`, {cache: "no-cache"});
    const data = await res.json() as unknown as { Data: Record<string, any> }  ;
     //console.log(data);  

    // Update cache
   
    
    let coins = Object.values(data.Data);
    //console.log(coins)
    // Paginate data
     //console.log(paginatedData);
    return NextResponse.json({ data: coins});
}

// Function to paginate data

