import { OrderModel } from "../../models/binance/Order"
import { ExecutionReportData} from "../../../types"
export async function updateOrderInDatabase(orderData: ExecutionReportData, orderStatus: string,cancelResult?: string, newOrderResult?: string) {
    try {
        if (!orderData || Object.keys(orderData).length === 0 || !orderData.e || !orderData.i) {
            console.log("Invalid order data, skipping database operation.")
            console.log("Received orderData:", JSON.stringify(orderData, null, 2));

            return
        }

        let count = await OrderModel.countDocuments({})
        console.log(`Total orders: ${count}`)
        console.log("Order Data before updating:", orderData)

        switch (orderStatus) {
            case "NEW":
                // Insert new order into the database
                const newOrder = new OrderModel({
                    ...orderData,
                    status: "NEW",
                })
                await newOrder.save()
                console.log("New order inserted into database:", newOrder)
                break

            case "PARTIALLY_FILLED":
                // Handle the partially filled order status
                // Update logic here if needed
                break

            case "FILLED":
                // Update the order as filled
                const updateFilledOrder = await OrderModel.findOneAndUpdate(
                    { orderId: orderData.i },
                    { status: "FILLED" },
                    { new: true, maxTimeMS: 2000 },
                )
                if (updateFilledOrder) {
                    console.log(
                        "Successfully updated filled order in database:",
                        updateFilledOrder,
                    )
                } else {
                    console.log("Order not found in database:", orderData.i)
                }
                break

            case "CANCELED":
                // Update the order as canceled
                const updateCanceledOrder = await OrderModel.findOneAndUpdate(
                    { orderId: orderData.i },
                    { status: "CANCELED" },
                    { new: true, maxTimeMS: 2000 },
                )
                if (updateCanceledOrder) {
                    console.log(
                        "Successfully updated canceled order in database:",
                        updateCanceledOrder,
                    )
                } else {
                    console.log("Order not found in database:", orderData.i)
                }
                break
            
        case "REPLACED":
            // Update the order as replaced
            const updateReplacedOrder = await OrderModel.findOneAndUpdate(
                { orderId: orderData.i },
                { status: "REPLACED" },
                { new: true, maxTimeMS: 2000 },
            );
            if (updateReplacedOrder) {
                console.log(
                    "Successfully updated replaced order in database:",
                    updateReplacedOrder,
                );
            } else {
                console.log("Order not found in database:", orderData.i);
            }
            break;
            case "CANCEL_AND_REPLACE":
                // Handle the cancel-and-replace operation
                if (cancelResult === "SUCCESS") {
                    // Update the canceled order
                    const updateCanceledOrder = await OrderModel.findOneAndUpdate(
                        { orderId: orderData.i },
                        { status: "CANCELED" },
                        { new: true, maxTimeMS: 2000 },
                    );
                    if (updateCanceledOrder) {
                        console.log(
                            "Successfully updated canceled order in database:",
                            updateCanceledOrder,
                        );
                    } else {
                        console.log("Order not found in database:", orderData.i);
                    }
                }

                if (newOrderResult === "SUCCESS") {
                    // Insert the new order into the database
                    const newOrder = new OrderModel({
                        ...orderData,
                        status: "NEW",
                    });
                    await newOrder.save();
                    console.log("New order inserted into database:", newOrder);
                }
                break;

            default:
                console.log("Unknown order status:", orderStatus)
        }
    } catch (error) {
        console.error("Error updating order in database:", error)
    }
}

export async function updateOrInsertOrder(orderResponse: any) {
    const existingOrder = await OrderModel.findOne({ orderId: orderResponse.orderId });
    if (existingOrder) {
        console.log("Order exists, updating:", orderResponse.orderId);
        await updateOrderInDatabase(orderResponse.orderId, orderResponse.status);
    } else {
        console.log("Order does not exist, inserting:", orderResponse.orderId);
        const newOrder = new OrderModel({
            ...orderResponse,
            exchangeId: "binance",  // Add any other necessary fields
        });
        await newOrder.save();
    }
}
