export const getQuoteCurrency = (symbol: string): string | null => {
    const quoteCurrencies = ["USDT", "BUSD", "BTC", "ETH", "BNB"]
    for (let quoteCurrency of quoteCurrencies) {
        if (symbol.endsWith(quoteCurrency)) {
            return quoteCurrency
        }
    }
    return null // return null instead of undefined if no match found
}