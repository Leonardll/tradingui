import express ,{ NextFunction, Request, Response } from 'express';
import { setupExchangeInfoStream } from './websocketServer';
import { cancelOrder, getAllOrdersFromBinance, getOrderStatusFromBinance, checkConnection } from './services/binanceService';
interface RequestWithOrders extends Request {
  orders?: any; // Replace 'any' with the actual type of your orders
}

interface OrderStatus {
  orderId: string;
  status?: string;
  
  
  // Add other properties as needed
}

interface RateLimit {
  rateLimitType: string;
  interval: string;
  intervalNum: number;
  limit: number;
}
interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Filter[];
  permissions: string[];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}


interface Filter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
}

interface ExchangeInfoData {
  id: string;
  status: number;
  method: string;
  result: {
    timezone: string;
    serverTime: number;
    rateLimits: RateLimit[];
    exchangeFilters: any[]; // replace 'any' with the actual type if you know it
    symbols: SymbolInfo[];
  };
  rateLimits: RateLimit[];
}

interface BinanceConnectionCheck {
  id: string;
  status: number;
  result: object[];
  rateLimits: object[];
};



interface OrderStatusRequest extends Request {
  orderId?: number
  orderStatus?: OrderStatus; // Define the orderStatus property with the appropriate type
}

  
const router = express.Router();

router.get('/', (req: Request , res: Response,) => {
  res.send('Hello World!');
});
// In your routes.ts file...


//  ALL orders route
router.get('/allOrders', 
  // This is your middleware function
  async (req: RequestWithOrders, res: Response, next: NextFunction) => {
    const symbol = req.query.symbol as string;
    const orderId = req.query.orderId as string;
    if (!symbol) {
      res.status(400).send('Symbol is required');
      return;
    }

    try {
      req.orders = await getAllOrdersFromBinance(symbol, orderId? Number(orderId) : undefined);
    } catch (error) {
      console.error('Error getting orders:', error);
      res.status(500).send('Orders not available');
      return;
    }
    next();
  },
  // This is your route handler
  async (req: RequestWithOrders, res: Response) => {
    try {
      res.json(req.orders);
    } catch (error) {
      console.error('Error getting orders from express app route.ts:', error);
      res.status(500).send('Orders not available');
    }
  }
);

router.get('/test', 
  // This is your middleware function
  async (req: Request, res: Response, next: NextFunction) => {
   
   

    try {
      const connectionStatus  = await checkConnection();
      res.json(connectionStatus);
    } catch (error) {
      console.error('Error getting orders:', error);
      res.status(500).send('connection failed');
      return;
    }
    next();
  },
  // This is your route handler

  async (req: Request, res: Response) => {
    try {
      res.json(req.statusCode)
    } catch (error) {
      console.error('Error getting exchange info from route.ts:', error);
      res.status(500).send('Exchange info not available');
    }
  }
  
);


let exchangeInfoGlobal : ExchangeInfoData| null = null; 
setupExchangeInfoStream().then((exchangeInfo: any) => {
  
  console.log('Exchange info initialized:', exchangeInfo);
  exchangeInfoGlobal =  exchangeInfo ;
}).catch((error) => {
  console.error('Error initializing exchange info:', error);
});
router.get('/exchangeInfo', (req: Request, res: Response) => {
  if (exchangeInfoGlobal) {
    res.json(exchangeInfoGlobal);
  } else {
    res.status(500).send('Exchange info not available');
  }
});


router.get('/orderStatus', 
  async (req: OrderStatusRequest, res: Response, next: NextFunction) => {
    const symbol = req.query.symbol as string;
    const orderId = req.query.orderId as string;
    if (!symbol && !orderId) {
      res.status(400).send('Symbol and orderId are required');
      return;
    }
    try {
      req.orderStatus = await getOrderStatusFromBinance(symbol, Number(orderId));
    } catch (error) {
      console.error('Error getting order status:', error);
      res.status(500).send('Order status not available');
      return;
    }
    next();
  },
  async (req: OrderStatusRequest, res: Response) => {
    try {
    const data =  res.json(req.orderStatus) 
  

    } catch (error) {
      console.error('Error getting exchange info from route.ts:', error);
      res.status(500).send('Exchange info not available');
    }
  }
  );


    

router.delete('/cancelOrder', cancelOrder);

export default router;



