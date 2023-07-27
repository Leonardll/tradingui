"use client"

import React, { useState, useEffect, useCallback } from "react"
import { WebSocketClient } from "../../utils/websocket"
import TickerLogo from "./tickerLogo"
type Order = {
    symbol: string
    orderId: number
    clientOrderId: string
    price: string
    origQty: string
    executedQty: string
    status: string
    timeInForce: string
    type: string
    side: string
    stopPrice: string
    icebergQty: string
    time: number
    updateTime: number
    isWorking: boolean
    origQuoteOrderQty: string
}

interface Ticker {
    Symbol: string;
    ImageUrl?: string;
  }
  
  interface CCompareResponse {
    data: Ticker[];
  }

  interface OrdersResponse {
    allOrders: Order[]; // replace 'Order' with the type of your orders
  }

const OrderTable: React.FC = () => {
    const [orders, setOrders] = useState<Array<Order> | null> ([])
    const [tickerData, setTickerData] = useState<any>({})
    const [ws, setWs] = useState<WebSocketClient | null>(null)
    const tableTitle = [{ id: 1, title: "Symbol" }, { id:2, title: "Side" }, { id:3,  title: "Type" }, { id: 4, title: "Quantity" }, { id: 5, title: " Filled Quantity" }, { id: 6, title: "Status" },{id: 7, title: "Limit Price"}, { id:8, title: "Stop Price" }, { id: 9, title: "Order Id"}, {id:10 , title: "Cancel Order"}]
    const cryptoCompareBaseUrl = "https://cryptocompare.com"

    useEffect(() => {
        const fetchOrders = async () => {

            try {

                const response = await fetch("/api/binance/openOrder")
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                  }
                // ensure the correct endpoint
                const data = await response.json() as OrdersResponse
                console.log(data)
    
                setOrders(data.allOrders)
            } catch (error) {
                console.error('Failed to fetch orders:', error);
            }
        }

        fetchOrders()
    }, []) // only run once on component mount
    useEffect(() => {
        console.log(orders);
    }, [orders]);
    
    useEffect(() => {
        const fetchTickerData = async () => {
            const response = await fetch(`/api/ccompare`)
            if (!response.ok) {
                console.error("Failed to fetch data from /api/ccompare");
                return;
              }
            const data = await response.json() as CCompareResponse
            console.log(data.data)
            let tickerData: {[key: string]: string} = {}
            for (let i in data.data) {
                let symbol = data.data[i]?.Symbol;
                let imageUrl = data.data[i]?.ImageUrl;

                if (symbol && imageUrl) {
                    tickerData[symbol] = imageUrl;
                  }
            }
            setTickerData(tickerData)
            console.log("tickerData",tickerData)
        }
        fetchTickerData()
    }, [])

    function extractBaseSymbol(symbol: string) {
        const quoteSymbols = ["USDT", "BTC", "ETH", "BUSD", "BNB", "USD"]
        let baseSymbol = symbol
        let quoteSymbol = ""

        for (let qs of quoteSymbols) {
            if (baseSymbol.endsWith(qs)) {
                quoteSymbol = qs
                baseSymbol = baseSymbol.slice(0, -qs.length)
                break
            }
        }

        return [baseSymbol, quoteSymbol]
    }

    // Create a WebSocket connection
 // Create a WebSocket connection
// const connectWebSocket = () => {
//     const socket = new WebSocketClient("ws://localhost:4000")
//     socket.connect()
//     setWs(socket)
//     console.log('Attempting to connect WebSocket...') // Log for connection attempt
// }

useEffect(() => {
    if (ws) {
        ws.onMessage((response) => {
            if (response.error) {
                console.error("Failed to cancel order: ", response.error)
            } else {
                console.log("Order cancelled successfully")
            }
        })
    } else {
        console.log('WebSocket is not defined or null. Waiting for connection...') // Log for WebSocket waiting
    }
}, [ws])


// Connection opened

async function cancelOrderClient  (order: Order) {
    if (!order || !order.symbol || !order.orderId) {
        throw new Error("Invalid order data");
      }

    try {
      const response = await fetch('http://localhost:4000/cancelOrder', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Response from server:', data);
      return data;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Failed to fetch orders:', error.message);
            return error.message.toString();
          } else {
            console.error('An unknown error occurred:', error);
          }
    }
  }
  

    // Usage in component
    {
       orders && orders.length > 0 &&
            orders.map((order) => {
                const [baseSymbol, quoteSymbol] = extractBaseSymbol(order.symbol)
                console.log("baseSymbol", baseSymbol);
console.log("quoteSymbol", quoteSymbol);
console.log("tickerData", tickerData);
                const imageUrl1 =
                tickerData && baseSymbol !== undefined && tickerData[baseSymbol]
                ? `${cryptoCompareBaseUrl}${tickerData[baseSymbol]}`
                        : ""
                const imageUrl2 =
                    tickerData && quoteSymbol !== undefined && tickerData[quoteSymbol]
                        ? `${cryptoCompareBaseUrl}${tickerData[quoteSymbol]}`
                        : ""
                console.log("imageUrl1", imageUrl1)
                return (
                    <tr key={order.orderId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                    <TickerLogo imageUrl1={imageUrl1} imageUrl2={imageUrl2} />
                                </div>
                                <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                        {order.symbol}
                                    </div>
                                </div>
                            </div>
                        </td>
                        {/*...*/}
                    </tr>
                )
            })
    }

    return (
        <div className="flex flex-col">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                    <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                {tableTitle.map((title) => (
                                        <th
                                            key={title.id}
                                            scope="col"
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >
                                            {title.title}
                                        </th>
                                    ))}
                             
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {
                                orders === null  ? (
                                    <div>....Loading</div>
                                ) : (
 
                                    orders && orders.length > 0 &&
                                    orders.map((order) => {
                                        const [baseSymbol, quoteSymbol] = extractBaseSymbol(
                                            order.symbol,
                                        )

                                        const imageUrl1 =
                                            tickerData && baseSymbol !== undefined && tickerData[baseSymbol]
                                                ? `${cryptoCompareBaseUrl}${tickerData[baseSymbol]}`
                                                : ""
                                        const imageUrl2 =
                                            tickerData && quoteSymbol !== undefined &&  tickerData[quoteSymbol]
                                                ? `${cryptoCompareBaseUrl}${tickerData[quoteSymbol]}`
                                                : ""

                                        return (
                                            <tr key={order.orderId}>
                                                
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-10 w-10">
                                                            {/* Remove 'USDT' from the end of the symbol */}

                                                            <TickerLogo
                                                                imageUrl1={imageUrl1}
                                                                imageUrl2={imageUrl2}
                                                            />
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900 p-4">
                                                                {order.symbol}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {order.side}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {order.type}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {order.origQty}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {order.executedQty}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {order.status}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    take profit value
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    Stop loss value
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {order.orderId}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            //connectWebSocket()
                                                            cancelOrderClient(order)
                                                            
                                                        }}
                                                        disabled={order.status === 'FILLED' || order.status === 'CANCELED' || order.status === 'REJECTED' || order.status === 'EXPIRED'}
                                                    >
                                                        Cancel
                                                    </button>
                                                </td>
                                                {/* Add more data cells as required */}
                                            </tr>
                                        )
                                    })
                                )
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default OrderTable
