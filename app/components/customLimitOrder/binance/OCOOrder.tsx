"use client"


import React, { useState } from "react"
import InputField from "./inputField"

interface OCOOrderProps {
    takeProfit: string
    stopLoss: string
    entryPrice: number
    quoteCurrencyAmount: number
    setTakeProfit: (value: string) => void
    setStopLoss: (value: string) => void
}

const OCOOrder: React.FC<OCOOrderProps> = ({
    takeProfit,
    stopLoss,
    entryPrice,
    quoteCurrencyAmount,
    setTakeProfit,
    setStopLoss,
}) => {
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
                onChange={(value: string) => setTakeProfit(value)}
            />
            <InputField
                type="text"
                placeholder="Stop Loss"
                value={stopLoss}
                onChange={(value: string) => setStopLoss(value)}
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
