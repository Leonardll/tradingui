import { ExchangeModel, IExchange, IExchangeInfo } from "../../models/binance/Exchange" // Replace 'yourModelFile' with the actual file name
import { Symbol } from "../../../types"
export const getSymbolFilters = async (
    exchangeName: string,
    tradingPair: string,
): Promise<Symbol | null> => {
    const exchange: IExchange | null = await ExchangeModel.findOne({ exchangeName: exchangeName })
    if (!exchange || !exchange.exchangeInfo) {
        return null
    }

    const symbolInfo: Symbol | undefined = exchange.exchangeInfo.symbols.find(
        (symbol) => symbol.symbol === tradingPair,
    )
    console.log(symbolInfo)
    return symbolInfo || null
}

export async function updateExchangeInfoInDB(
    userId: string,
    exchangeName: string,
    exchangeInfo: IExchangeInfo,
) {
    console.log('Inside updateExchangeInfoInDB');

    console.log("Attempting to update DB with:", userId, exchangeName, exchangeInfo);
    try {
        await ExchangeModel.findOneAndUpdate(
            { userId, exchangeName },
            { $set: { exchangeInfo } },
            { upsert: true },
        );
        console.log("Successfully updated DB.");
    } catch (err) {
        console.error("Failed to update DB:", err);
    }
}

