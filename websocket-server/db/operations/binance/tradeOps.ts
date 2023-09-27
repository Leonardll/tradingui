import { IOrder, OrderModel } from '../../models/binance/Order';
import { ITrade, TradeModel } from '../../models/binance/Trade';

interface Trade {
  
  symbol: string;
  id: number;
  orderId: number;
  orderListId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}


  

export async function uploadTradesToDB(trades: Trade[], exchangeId: string) {
    try {
      for (const trade of trades) {
        // Check if order exists in Orders Collection
        const existingOrder = await OrderModel.findOne({ orderId: trade.orderId });
  
        // If not, insert it
        if (!existingOrder) {
          const newOrderData: Partial<IOrder> = {
            exchangeId: exchangeId,
            symbol: trade.symbol,
            orderId: trade.orderId,
            orderListId: trade.orderListId,
            price: trade.price,
            origQty: trade.qty,
            executedQty: trade.qty,
            cummulativeQuoteQty: trade.quoteQty,
            transactTime: trade.time,
            fills: [{
              price: trade.price,
              qty: trade.qty,
              commission: trade.commission,
              commissionAsset: trade.commissionAsset,
              tradeId: trade.id
            }]
          };
  
          const newOrder: IOrder = new OrderModel(newOrderData);
          await newOrder.save();
        }
  
        // Prepare new trade data
        const newTradeData: Partial<ITrade> = {
          exchangeId: exchangeId,
          symbol: trade.symbol,
          id: trade.id,
          orderId: trade.orderId,
          orderListId: trade.orderListId,
          price: trade.price,
          qty: trade.qty,
          quoteQty: trade.quoteQty,
          commission: trade.commission,
          commissionAsset: trade.commissionAsset,
          time: trade.time,
          isBuyer: trade.isBuyer,
          isMaker: trade.isMaker,
          isBestMatch: trade.isBestMatch
        };
  
        // Upsert trade into Trades Collection
        await TradeModel.findOneAndUpdate(
          { id: trade.id }, 
          newTradeData, 
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    } catch (error) {
      console.error("Error uploading trades to DB:", error);
    }
}

  