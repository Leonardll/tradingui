import {
    OCOOrderInfo,
    OCOOrderResponse,
    OCOOrderResult,
} from "../../../services/binanceWsService/binanceWsService"
import { IOCOOrder, OCOOrderModel } from "../../models/binance/OCOOrders"
import { IOrder } from "../../models/binance/Order"

interface ActualOCOOrderResponse {
    orderListId: number
    contingencyType: string
    listStatusType: string
    listOrderStatus: string
    listClientOrderId: string
    transactionTime: number
    symbol: string
    orders: OCOOrderInfo[]
    orderReports: OCOOrderResult[]
    exchangeId: string
}

export async function uploadOCOToDB(ocoOrders: ActualOCOOrderResponse[]) {
    try {
        if (!ocoOrders || ocoOrders.length === 0) {
            throw new Error("No OCO orders provided for upload.")
        }

        for (const ocoOrder of ocoOrders) {
            // Validate required fields
            if (!ocoOrder || !ocoOrder.orderListId || !ocoOrder.symbol) {
                console.warn(
                    `Skipping OCO order due to missing required fields: ${JSON.stringify(
                        ocoOrder,
                    )}`,
                )
                continue
            }

            // Check if the OCO order exists in the OCOOrders Collection
            let existingOCOOrder
            try {
                existingOCOOrder = await OCOOrderModel.findOne({
                    orderListId: ocoOrder.orderListId,
                })
            } catch (findError) {
                console.error(`Error finding existing OCO order: ${findError}`)
                continue
            }

            // If not, insert it
            if (!existingOCOOrder) {
                const newOCOOrderData: Partial<IOCOOrder> = {
                    ...ocoOrder,
                    exchangeId: "binance", // Assuming the exchangeId is "binance"
                    orderReports: ocoOrder.orderReports as unknown as IOrder[],
                }

                try {
                    const newOCOOrder: IOCOOrder = new OCOOrderModel(newOCOOrderData)
                    await newOCOOrder.save()
                } catch (saveError) {
                    console.error(`Error saving new OCO order: ${saveError}`)
                    continue
                }
            } else {
                // If the OCO order already exists, you can update it here if needed
                try {
                    await OCOOrderModel.findOneAndUpdate(
                        { orderListId: ocoOrder.orderListId },
                        { listOrderStatus: ocoOrder.listOrderStatus },
                        { new: true },
                    )
                } catch (updateError) {
                    console.error(`Error updating existing OCO order: ${updateError}`)
                }
            }
        }
    } catch (error) {
        console.error("Error uploading OCO orders to DB:", error)
    }
}
