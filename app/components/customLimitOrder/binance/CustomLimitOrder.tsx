"use client"
import React, { use, useState, useEffect } from "react"
import { useWebSocket } from "../../../hooks/useWebSocket"

type Client = {
    apiKey: string
    apiSecret: string
    getTime: boolean
}

type MyOrder = {
    symbol: string
    side: string
    type: string
    quantity: number
    price?: number
    percentageOfBalance?: number
    timeInForce?: string
}

interface WalletData {
    makerCommission: number
    takerCommission: number
    buyerCommission: number
    sellerCommission: number
    canTrade: boolean
    canWithdraw: boolean
    canDeposit: boolean
    updateTime: number
    accountType: string
    balances: Array<{ asset: string; free: string; locked: string }>
    permissions: Array<string>
}

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
    const [quantity, setQuantity] = useState("")
    const [price, setPrice] = useState("")
    const [currentPrice, setCurrentPrice] = useState(0)
    const [timeInForce, setTimeInForce] = useState<string | null>("GTC")
    const [percentageOfBalance, setPercentageOfBalance] = useState("")
    const [totalInBaseCurrency, setTotalInBaseCurrency] = useState<number | "">("")
    const [quoteCurrencyBalance, setQuoteCurrencyBalance] = useState(0)

    const [baseCurrencyBalance, setBaseCurrencyBalance] = useState(0)

    const [takeProfitPrice, setTakeProfitPrice] = useState("")
    const [stopPrice, setStopPrice] = useState("")
    const [debouncedSymbol, setDebouncedSymbol] = useState("")
    const { data, error } = useWebSocket(debouncedSymbol)
    const quoteCurrencies = ['USDT','BUSD', 'BTC', 'ETH', 'BNB'];

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
    useEffect(() => {
        if (data) {
            const parsedData = JSON.parse(data)
            if (
                parsedData.eventType === "executionReport" &&
                parsedData.orderStatus === "FILLED"
            ) {
                console.log("Limit order filled, placing OCO order...")

                // The body for your OCO order
                let ocoOrder: OCOOrder = {
                    symbol: symbol,
                    side: side,
                    stopPrice: stopPrice === "" ? 0 : parseFloat(stopPrice),
                    takeProfitPrice: takeProfitPrice === "" ? 0 : parseFloat(takeProfitPrice),
                    quantity: quantity === "" ? 0 : parseFloat(quantity),
                }

                // The API request to place the OCO order
                fetch("/api/binance/customOCOOrder", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(ocoOrder),
                })
                    .then((res) => res.json())
                    .then((data) => console.log(data))
                    .catch((err) => console.log(err))
            }
        }
    }, [data])

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
        if (symbol !== "") {
          // get the base currency and quote currency from the symbol
          const baseCurrency = quoteCurrencies.reduce((acc, quoteCurrency) => {
            if (symbol.endsWith(quoteCurrency)) {
              return symbol.slice(0, -quoteCurrency.length)
            }
            return acc
          }, "")
    
          const quoteCurrency = getQuoteCurrency(symbol)
    
          // find the balance of base and quote currency
          const baseCurrencyBalanceObject = freeBalances.find((balance) => balance.asset === baseCurrency);
          const quoteCurrencyBalanceObject = freeBalances.find((balance) => balance.asset === quoteCurrency);
          
          // extract the free balance
          const baseCurrencyBalance = baseCurrencyBalanceObject ? parseFloat(baseCurrencyBalanceObject.free) : 0;
          const quoteCurrencyBalance = quoteCurrencyBalanceObject ? parseFloat(quoteCurrencyBalanceObject.free) : 0;
          
          // set the balance states
          setBaseCurrencyBalance(baseCurrencyBalance);
          setQuoteCurrencyBalance(quoteCurrencyBalance);
        }
      }, [symbol, freeBalances]);
    
    

    const handleOrderTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value
        setType(newType)

        // If the new order type is "LIMIT", set timeInForce to "GTC", otherwise set it to null
        if (newType === "LIMIT") {
            setTimeInForce("GTC")
        } else {
            setTimeInForce(null)
        }
    }
    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuantity = e.target.value;
        setQuantity(newQuantity);
    
        // If Price is already filled in, calculate the total
        if (price !== "") {
            const total = parseFloat((parseFloat(newQuantity) * parseFloat(price)).toFixed(2));
            setTotalInBaseCurrency(total);
        }
    };
    

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        let body: MyOrder = {
            symbol: symbol,
            side: side,
            type: type,
            quantity: quantity === "" ? 0 : parseFloat(quantity),
        }

        if (percentageOfBalance !== "") {
            body.percentageOfBalance = parseFloat(percentageOfBalance)
        }

        if (type === "LIMIT") {
            body.price = parseFloat(price)

            if (timeInForce) {
                body.timeInForce = timeInForce
            }
        }

        console.log(`Sending request to server with body:`, body)

        const response = fetch("/api/binance/customOrder", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        })
            .then((res) => {
                console.log("Response from server:", res)
                return res.json()
            })
            .then((data) => {
                console.log(data)
                setSymbol(symbol)
            })
            .catch((err) => console.log(err))

        return response
    }
  

    const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPrice = e.target.value;
        setPrice(newPrice);
    
        // If Quantity is already filled in, calculate the total
        if (quantity !== "") {
            const total = parseFloat((parseFloat(newPrice) * parseFloat(quantity)).toFixed(2));
            setTotalInBaseCurrency(total);
        }
    };

    
    const baseCurrency = quoteCurrencies.reduce((acc, quoteCurrency) => {
        if (symbol.endsWith(quoteCurrency)) {
            return symbol.slice(0, -quoteCurrency.length)
        }
        return acc
    }, "")
    const quoteCurrency = getQuoteCurrency(symbol)
    



    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-rows-auto">
                {/* Symbol field */}
                <input
                    className="p-2"
                    type="text"
                    placeholder="Symbol"
                    value={symbol}
                    onChange={(e) => {
                        setSymbol(e.target.value)
                    }}
                />
                {/* Option for Buy or Sell orders */}
                <select
                    className="p-2"
                    name="side"
                    defaultValue="BUY"
                    onChange={(e) => setSide(e.target.value)}
                >
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                </select>
                {/* 'Option for Limit or Market  */}
                <select
                    className="p-2"
                    name="type"
                    defaultValue="LIMIT"
                    onChange={handleOrderTypeChange}
                >
                    <option value="LIMIT">LIMIT</option>
                    <option value="MARKET">MARKET</option>
                </select>
                {/* Order Price field */}
                <input
                    className="p-2"
                    type="number"
                    placeholder="Price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={type === "MARKET"}
                />

                <input
                    className="p-2"
                    type="number"
                    placeholder={`Amount of ${baseCurrency}`}
                    value={quantity}
                    onChange={handleQuantityChange}
                />
                <input
                    className="p-2"
                    type="number"
                    placeholder={`Total (${quoteCurrency})`}
                    value={totalInBaseCurrency !== "" ? totalInBaseCurrency.toString() : ""}
                    onChange={handleTotalChange}
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

                <input
                    className="p-2"
                    type="number"
                    placeholder="Percentage of Balance"
                    value={percentageOfBalance}
                    onChange={(e) => setPercentageOfBalance(e.target.value)}
                    disabled={type === "MARKET"}
                />
            </div>
            <div className="flex flex-col justify-center ">
                <button
                    className=" p-2 bg-red-300 text-center"
                    onClick={() => console.log(" button clicked")}
                    type="submit"
                >
                    Place Order
                </button>
            </div>
        </form>
    )
}

export default CustomLimitOrder
