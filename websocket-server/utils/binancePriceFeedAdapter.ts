import { BinancePriceFeedMessage, GenericPriceData } from "../types"
export function convertBinanceToGenericPriceData(
    binanceData: BinancePriceFeedMessage,
): GenericPriceData {
    return {
        timestamp: binanceData.E,
        symbol: binanceData.s,
        open: parseFloat(binanceData.o),
        high: parseFloat(binanceData.h),
        low: parseFloat(binanceData.l),
        close: parseFloat(binanceData.c),
        volume: parseFloat(binanceData.v),
    }
}
