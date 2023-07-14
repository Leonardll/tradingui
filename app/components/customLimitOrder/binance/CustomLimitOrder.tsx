"use client"
import React, { use, useState, useEffect } from "react"
import { useWebSocket } from "../../../hooks/useWebSocket"
import InputField from "./inputField"
import SelectField from "./selectField"
import PercentageButton from "./percentageButton"
import { getQuoteCurrency } from "@/app/utils/getQuoteCurrency"
import apiService from "@/app/utils/apiService"
import SubmitButton from "./submitButton"
import OCOOrder from "./OCOOrder"

interface Balance {
    asset: string
    free: string
    locked: string
}

interface CustomLimitOrderProps {
    freeBalances: Balance[]
}

const CustomLimitOrder: React.FC<CustomLimitOrderProps> = ({
    freeBalances,
}: CustomLimitOrderProps) => {
    // State variables
    const [symbol, setSymbol] = useState("")
    const [side, setSide] = useState("BUY")
    const [type, setType] = useState("LIMIT")
    const [quantity, setQuantity] = useState<number>(0)
    const [price, setPrice] = useState("")
    const [currentPrice, setCurrentPrice] = useState(0)
    const [timeInForce, setTimeInForce] = useState<string | null>("GTC")
    const [percentageOfBalance, setPercentageOfBalance] = useState("")
    const [totalInBaseCurrency, setTotalInBaseCurrency] = useState<number>(0)
    const [quoteCurrencyBalance, setQuoteCurrencyBalance] = useState(0)

    const [baseCurrencyBalance, setBaseCurrencyBalance] = useState(0)
    const [baseCurrency, setBaseCurrency] = useState<string | null>(null)
    const [quoteCurrency, setQuoteCurrency] = useState<string | null>(null)
    const [takeProfitPrice, setTakeProfitPrice] = useState("")
    const [stopPrice, setStopPrice] = useState("")
    const [debouncedSymbol, setDebouncedSymbol] = useState("")
    const { data, error } = useWebSocket(debouncedSymbol)

    // Constants

    const percentages = ["25", "50", "75", "100"]

    // Price feed
    useEffect(() => {
        const fetchPriceData = async () => {
            try {
                const res = await fetch("/api/priceFeed")
                const data = await res.json()
                // Assuming the symbol data is in the form { symbol: 'BTCUSDT', price: '45000.00' }
                const symbolData = data.data.find(
                    (item: any) => item.symbol === symbol.toUpperCase(),
                )
                if (symbolData) {
                    setCurrentPrice(parseFloat(symbolData.price))
                }
            } catch (err) {
                console.error(err)
            }
        }

        fetchPriceData()
    }, [symbol])

    // OCO useEffect
    // useEffect(() => {
    //     if (data) {
    //         const parsedData = JSON.parse(data)
    //         if (
    //             parsedData.eventType === "executionReport" &&
    //             parsedData.orderStatus === "FILLED"
    //         ) {
    //             console.log("Limit order filled, placing OCO order...")

    //             // The body for your OCO order
    //             let ocoOrder: OCOOrder = {
    //                 symbol: symbol,
    //                 side: side,
    //                 stopPrice: stopPrice === "" ? 0 : parseFloat(stopPrice),
    //                 takeProfitPrice: takeProfitPrice === "" ? 0 : parseFloat(takeProfitPrice),
    //                 quantity: quantity === "" ? 0 : parseFloat(quantity),
    //             }

    //             // The API request to place the OCO order
    //             fetch("/api/binance/customOCOOrder", {
    //                 method: "POST",
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                 },
    //                 body: JSON.stringify(ocoOrder),
    //             })
    //                 .then((res) => res.json())
    //                 .then((data) => console.log(data))
    //                 .catch((err) => console.log(err))
    //         }
    //     }
    // }, [data])

    // Debounce the symbol input
    useEffect(() => {
        // set up a delay
        const timerId = setTimeout(() => {
            setDebouncedSymbol(symbol)
        }, 1000)

        // clean up function
        return () => {
            clearTimeout(timerId)
        }
    }, [symbol])

    // Set the base and quote currency balances
    useEffect(() => {
        const quoteCurrencies = ["USDT", "BUSD", "BTC", "ETH", "BNB"]

        if (symbol !== "") {
            const baseCurrency = quoteCurrencies.reduce((acc, quoteCurrency) => {
                if (symbol.endsWith(quoteCurrency)) {
                    return symbol.slice(0, -quoteCurrency.length)
                }
                return acc
            }, "")

            const quoteCurrency = getQuoteCurrency(symbol)

            const baseCurrencyBalanceObject = freeBalances.find(
                (balance: any) => balance.asset === baseCurrency,
            )
            const quoteCurrencyBalanceObject = freeBalances.find(
                (balance: any) => balance.asset === quoteCurrency,
            )

            const baseCurrencyBalance = baseCurrencyBalanceObject
                ? parseFloat(baseCurrencyBalanceObject.free)
                : 0
            const quoteCurrencyBalance = quoteCurrencyBalanceObject
                ? parseFloat(quoteCurrencyBalanceObject.free)
                : 0

            console.log("Symbol: ", symbol)
            console.log("Base currency: ", baseCurrency)
            console.log("Quote currency: ", quoteCurrency)
            console.log("Free balances: ", freeBalances)
            console.log("Base currency balance object: ", baseCurrencyBalanceObject)
            console.log("Quote currency balance object: ", quoteCurrencyBalanceObject)

            setBaseCurrencyBalance(baseCurrencyBalance)
            setQuoteCurrencyBalance(quoteCurrencyBalance)

            // Set baseCurrency and quoteCurrency in the state
            setBaseCurrency(baseCurrency)
            setQuoteCurrency(quoteCurrency)
        }
    }, [symbol, freeBalances])

    const handleOrderTypeChange = (value: string) => {
        setType(value)

        // If the new order type is "LIMIT", set timeInForce to "GTC", otherwise set it to null

        setTimeInForce(value === "LIMIT" ? "GTC" : null)
    }
    const handleQuantityChange = (value: string) => {
        const newQuantity = parseFloat(value)
        const priceValue = parseFloat(price)
        const isEmptyOrNaN = value === "" || isNaN(newQuantity) || isNaN(priceValue)

        setQuantity(isEmptyOrNaN ? 0 : newQuantity)
        setTotalInBaseCurrency(isEmptyOrNaN ? 0 : newQuantity * priceValue)
    }

    const handleTotalChange = (value: string) => {
        const newTotal = parseFloat(value)
        const priceValue = parseFloat(price)

        const isEmptyOrNaN = value === "" || isNaN(newTotal) || isNaN(priceValue)

        setTotalInBaseCurrency(isEmptyOrNaN ? 0 : newTotal)
        setQuantity(isEmptyOrNaN ? 0 : newTotal / priceValue)
    }

    const createOrder = (
        type: string,
        side: string,
        symbol: string,
        quantity: string,
        price: string,
        totalInBaseCurrency: string,
        timeInForce: string | null,
    ) => {
        const orderBase = { symbol, side, type }
        let orderDetail

        if (type === "LIMIT") {
            orderDetail = { quantity, price: Number(price), timeInForce: timeInForce || undefined }
        } else if (side === "BUY") {
            orderDetail = { quoteOrderQty: totalInBaseCurrency.toString() }
        } else {
            orderDetail = { quantity }
        }

        return { ...orderBase, ...orderDetail }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const order = createOrder(
            type,
            side,
            symbol,
            quantity.toString(),
            price,
            totalInBaseCurrency.toString(),
            timeInForce,
        )

        try {
            const response = await apiService.createOrder(order)
            const data = await response.json()
            console.log(data)
        } catch (error) {
            console.error(error)
        }
    }

    const handlePercentageClick = (
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
        percentage: string,
    ) => {
        event.preventDefault()

        const percentageInDecimal = parseInt(percentage) / 100
        setPercentageOfBalance(percentage)

        if (side === "BUY") {
            const totalInQuoteCurrency = quoteCurrencyBalance * percentageInDecimal
            setTotalInBaseCurrency(totalInQuoteCurrency)
            // Assuming currentPrice is the price of baseCurrency in terms of quoteCurrency
            const amountInBaseCurrency = totalInQuoteCurrency / currentPrice
            setQuantity(amountInBaseCurrency)
        } else {
            const amountInBaseCurrency = baseCurrencyBalance * percentageInDecimal
            setQuantity(amountInBaseCurrency)
            const totalInQuoteCurrency = amountInBaseCurrency * currentPrice
            setTotalInBaseCurrency(totalInQuoteCurrency)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-rows-auto">
                <InputField type="text" placeholder="Symbol" value={symbol} onChange={setSymbol} />

                <SelectField
                    value={side}
                    options={[
                        { label: "Buy", value: "BUY" },
                        { label: "Sell", value: "SELL" },
                    ]}
                    onChange={(value: string) => setSide(value)}
                />

                <SelectField
                    value={type}
                    options={[
                        { label: "Limit", value: "LIMIT" },
                        { label: "Market", value: "MARKET" },
                    ]}
                    onChange={handleOrderTypeChange} // It should work now because handleOrderTypeChange accepts ChangeEvent<HTMLSelectElement>
                />

                <InputField
                    type="number"
                    placeholder="Price"
                    value={price}
                    onChange={setPrice} // It should work now because setPrice accepts string
                    disabled={type === "MARKET"}
                />

                <InputField
                    type="number"
                    placeholder={`Amount of ${baseCurrency}`}
                    value={quantity.toString()}
                    onChange={(value: string) => handleQuantityChange(value)}
                />

                <InputField
                    type="number"
                    placeholder={`Total (${quoteCurrency})`}
                    value={totalInBaseCurrency.toString()}
                    onChange={(value: string) => handleTotalChange(value)}
                />

                <div className="flex bg-grey">
                    {side === "BUY" ? (
                        <p className="p-2 text-sm">{`Available: ${
                            quoteCurrencyBalance ? `${quoteCurrencyBalance} ${quoteCurrency}` : "0"
                        }`}</p>
                    ) : (
                        <p className="p-2 text-sm">{`Available: ${
                            baseCurrencyBalance ? `${baseCurrencyBalance} ${baseCurrency}` : "0"
                        }`}</p>
                    )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {percentages.map((percentage) => (
                        <PercentageButton
                            key={percentage}
                            percentage={percentage}
                            onClick={handlePercentageClick}
                        />
                    ))}
                </div>
            </div>
            <div className="grid grid-rows-auto">
                <div className="div">
                    <h3 className="flex flex-row justify-center">TP/SL</h3>
                </div>
                <div>
                    <OCOOrder
                        takeProfit={takeProfitPrice}
                        stopLoss={stopPrice}
                        entryPrice={currentPrice}
                        quoteCurrencyAmount={totalInBaseCurrency}
                        setTakeProfit={setTakeProfitPrice}
                        setStopLoss={setStopPrice}
                    />
                </div>
            </div>
            <SubmitButton onClick={() => console.log("Button clicked")}>Place Order</SubmitButton>
        </form>
    )
}

export default CustomLimitOrder
