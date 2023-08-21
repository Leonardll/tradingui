import { Router, NextFunction, Request, Response } from 'express';
import { cancelOrder, getAllOrdersFromBinance, getOrderStatusFromBinance, checkConnection } from './services/binanceService';
import { getExchangeInfo } from './websocketServer';

interface RequestWithOrders extends Request {
  orders?: any; // Replace 'any' with the actual type of your orders
}

interface OrderStatus {
  orderId: string;
  status?: string 
  // Add other properties as needed
}

interface BinanceConnectionCheck {
  id: string;
  status: number;
  result: object[];
  rateLimits: object[];
};

interface OrderStatusRequest extends Request {
  orderStatus?: OrderStatus; // Define the orderStatus property with the appropriate type
}
const router = Router();

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
      req.orders = await getAllOrdersFromBinance(symbol);
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
router.get('/exchangeInfo', 
  // This is your middleware function
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.exchangeInfo) {
      try {
        req.exchangeInfo = await getExchangeInfo();
      } catch (error) {
        console.error('Error getting exchange info:', error);
        res.status(500).send('Exchange info not available');
        return;
      }
    }
    // console.log('exchangeInfo after waiting:', req.exchangeInfo);
    next();
  },
  // This is your route handler
  async (req: Request, res: Response) => {
    try {
      res.json(req.exchangeInfo);
    } catch (error) {
      console.error('Error getting exchange info from route.ts:', error);
      res.status(500).send('Exchange info not available');
    }
  }
);


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
    const data =  res.json(req.orderStatus);
    } catch (error) {
      console.error('Error getting exchange info from route.ts:', error);
      res.status(500).send('Exchange info not available');
    }
  }
  );





router.delete('/cancelOrder', cancelOrder);

export default router;
