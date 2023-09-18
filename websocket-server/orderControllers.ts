import { Request, Response } from "express"
import { cancelOrder as cancelBinanceOrder } from "./services/binanceService" // Assuming you have a binanceService.ts file

export const cancelOrder = async (req: Request, res: Response) => {
    const order = req.body
    try {
        const result = await cancelBinanceOrder(order)
        res.json(result)
    } catch (error: any) {
        console.error("Error deleting order:", error)
        res.status(500).json({ error: error.toString() })
    }
}
