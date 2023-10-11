import { ExchangeModel, IExchange, IExchangeInfo, Symbol } from "../../models/binance/Exchange" // Replace 'yourModelFile' with the actual file name

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
