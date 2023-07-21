"use client"

import React, { useState, useEffect } from "react"
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

const OrderTable: React.FC = () => {
    const [orders, setOrders] = useState<Array<Order>>([])
    const [tickerData, setTickerData] = useState<any>({})
    const cryptoCompareBaseUrl = "https://cryptocompare.com"

    useEffect(() => {
        const fetchOrders = async () => {
            const response = await fetch("/api/binance/openOrder") // ensure the correct endpoint
            const data = await response.json()

            setOrders(data.data)
            console.log(orders)
        }

        fetchOrders()
    }, []) // only run once on component mount
    useEffect(() => {
        const fetchTicketData = async () => {
            const response = await fetch("/api/ccompare")
            const data = await response.json()

            let tickerData: any = {}
            for (let symbol in data.data.Data) {
                if (data.data.Data[symbol]?.ImageUrl) {
                    tickerData[symbol] = data.data.Data[symbol].ImageUrl
                }
            }
            setTickerData(tickerData)
            console.log(tickerData)
        }
        fetchTicketData()
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

    // Usage in component
    {
        orders.length > 0 &&
            orders.map((order) => {
                const [baseSymbol, quoteSymbol] = extractBaseSymbol(order.symbol)

                const imageUrl1 =
                    tickerData && tickerData[baseSymbol]
                        ? `${cryptoCompareBaseUrl}${tickerData[baseSymbol]}`
                        : ""
                const imageUrl2 =
                    tickerData && tickerData[quoteSymbol]
                        ? `${cryptoCompareBaseUrl}${tickerData[quoteSymbol]}`
                        : ""

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
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Symbol
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Side
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Type
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Qty
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Filled Qty
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Limit Price
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        Stop Price
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {orders.length > 0 &&
                                    orders.map((order) => {
                                        const [baseSymbol, quoteSymbol] = extractBaseSymbol(
                                            order.symbol,
                                        )

                                        const imageUrl1 =
                                            tickerData && tickerData[baseSymbol]
                                                ? `${cryptoCompareBaseUrl}${tickerData[baseSymbol]}`
                                                : ""
                                        const imageUrl2 =
                                            tickerData && tickerData[quoteSymbol]
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
                                                    take profit value
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    Stop loss value
                                                </td>
                                                {/* Add more data cells as required */}
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default OrderTable
