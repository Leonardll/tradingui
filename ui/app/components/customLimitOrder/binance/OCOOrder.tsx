"use client"


import React, { useState, useEffect } from "react"
import InputField from "./inputField"

interface OCOOrderProps {
    takeProfit: string
    stopLoss: string
    entryPrice: number
    quoteCurrencyAmount: number
    setTakeProfit: (orderId:string ,value: string) => void
    setStopLoss: (orderId:string,value: string) => void
    orderId?: string
    submitOCOOrder: (takeProfit: string, stopLoss: string) => void,

}


const OCOOrder: React.FC<OCOOrderProps> = ({
    takeProfit,
    stopLoss,
    entryPrice,
    quoteCurrencyAmount,
    setTakeProfit,
    setStopLoss,
    orderId,
    submitOCOOrder,
}) => {

    const [localTakeProfit, setLocalTakeProfit] = useState(takeProfit)
    const [localStopLoss, setLocalStopLoss] = useState(stopLoss)
    
    useEffect(() => {
      if (orderId) {
        submitOCOOrder(localTakeProfit, localStopLoss)
      }
    }, [orderId])
    const calculateProfit = () => {
        const baseCurrencyAmount = quoteCurrencyAmount / entryPrice
        const tp = parseFloat(takeProfit)
        return (tp && !isNaN(tp)) ? (tp - entryPrice) * baseCurrencyAmount : 0
    }
    

    const calculateLoss = () => {
        const baseCurrencyAmount = quoteCurrencyAmount / entryPrice
        const sl = parseFloat(stopLoss)
        return (sl && !isNaN(sl)) ? (entryPrice - sl) * baseCurrencyAmount : 0
    }

    const calculateTotalValueAfterProfit = () => {
        return quoteCurrencyAmount + calculateProfit()
    }

    const calculateTotalValueAfterLoss = () => {
        return quoteCurrencyAmount - calculateLoss()
    }

    const calculateProfitPercentage = () => {
        return (calculateProfit() / quoteCurrencyAmount) * 100
    }

    const calculateLossPercentage = () => {
        return (calculateLoss() / quoteCurrencyAmount) * 100
    }

    return (
        <div className="grid grid-flow-row grid-cols-2">
            <InputField
                type="text"
                placeholder="Take Profit"
                value={takeProfit}
                onChange={(value: string) => {
                    setLocalTakeProfit(value)
                    orderId && setTakeProfit(orderId,value) 
                }
            }
            />
            <InputField
                type="text"
                placeholder="Stop Loss"
                value={localStopLoss}
                onChange={(value: string) => {
                    setLocalStopLoss(value)
                    orderId && setStopLoss(orderId,value) 
                }}
            />
            <div className="p-2">
                <p>Potential Profit: {calculateProfit()}</p>
            </div>

            <div className="p-2">
                <p>Potential Loss: {calculateLoss()}</p>
            </div>
            <div className="p-2">
                <p className="text-md">
                    Total Order Value After profit: {calculateTotalValueAfterProfit()}
                    <span className="text-green-400 p-1">
                        {"+" + calculateProfitPercentage().toFixed(2) + "%"}
                    </span>
                </p>
            </div>

            <div className="p-2">
                <p className="text-md">Total Order Value after Loss: {calculateTotalValueAfterLoss()}
                <span className="text-red-400 p-1">
                    {"-" + calculateLossPercentage().toFixed(2) + "%"}
                </span>
                </p>
            </div>
        </div>
    )
}

export default OCOOrder
