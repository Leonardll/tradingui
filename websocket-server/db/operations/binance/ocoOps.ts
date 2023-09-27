import { OCOOrderResponse } from "../../../services/binanceWsService/binanceWsService";
import { IOCOOrder, OCOOrderModel } from "../../models/binance/OCOOrders";
import { IOrder } from "../../models/binance/Order";

export async function uploadOCOToDB(ocoOrders: OCOOrderResponse[]) {
  try {
    if (!ocoOrders || ocoOrders.length === 0) {
      throw new Error("No OCO orders provided for upload.");
    }

    for (const ocoOrder of ocoOrders) {
      // Validate required fields
      if (!ocoOrder.result.orderListId || !ocoOrder.result.symbol) {
        console.warn(`Skipping OCO order due to missing required fields: ${JSON.stringify(ocoOrder)}`);
        continue;
      }

      // Check if the OCO order exists in the OCOOrders Collection
      let existingOCOOrder;
      try {
        existingOCOOrder = await OCOOrderModel.findOne({ orderListId: ocoOrder.result.orderListId });
      } catch (findError) {
        console.error(`Error finding existing OCO order: ${findError}`);
        continue;
      }

      // If not, insert it
      if (!existingOCOOrder) {
        const newOCOOrderData: Partial<IOCOOrder> = {
          exchangeId: "binance",  // Assuming the exchangeId is "binance"
          ...ocoOrder.result,
          orderReports: ocoOrder.result.orderReports as unknown as IOrder[]

        };

        try {
          const newOCOOrder: IOCOOrder = new OCOOrderModel(newOCOOrderData);
          await newOCOOrder.save();
        } catch (saveError) {
          console.error(`Error saving new OCO order: ${saveError}`);
          continue;
        }
      } else {
        // If the OCO order already exists, you can update it here if needed
        try {
          await OCOOrderModel.findOneAndUpdate(
            { orderListId: ocoOrder.result.orderListId },
            { listOrderStatus: ocoOrder.result.listOrderStatus },
            { new: true }
          );
        } catch (updateError) {
          console.error(`Error updating existing OCO order: ${updateError}`);
        }
      }
    }
  } catch (error) {
    console.error("Error uploading OCO orders to DB:", error);
  }
}
