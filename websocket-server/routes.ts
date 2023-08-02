import { Router, NextFunction,Request, Response } from 'express';
import { cancelOrder } from './services/binanceService';
import { getExchangeInfo, getOrdersForSymbol } from './websocketServer';
import { eventEmitter } from './events/eventEmitter';


interface RequestWithOrders extends Request {
  orders?: any; // Replace 'any' with the actual type of your orders
}
const router = Router();

router.get('/', (req: Request , res: Response,) => {
  res.send('Hello World!');
});
// In your routes.ts file...

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

router.get('/allOrders', 
  // This is your middleware function
  async (req: RequestWithOrders, res: Response, next: NextFunction) => {
    const symbol = req.query.symbol as string;
    if (!symbol) {
      res.status(400).send('Symbol is required');
      return;
    }

    try {
      // Assuming you have a function getOrdersForSymbol that fetches all orders for a symbol
      req.orders = await getOrdersForSymbol(symbol);
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
      console.error('Error getting orders from route.ts:', error);
      res.status(500).send('Orders not available');
    }
  }
);





router.delete('/cancelOrder', cancelOrder);

export default router;
