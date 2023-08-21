import express, {Express, Request, Response} from 'express';
import expressWs from 'express-ws';

import {Server, WebSocket} from 'ws';
import http, { get } from 'http';
import cors from 'cors';
import routes from './routes'; // Assuming you have a routes.ts file
import { NextFunction } from 'express';
import dotenv from 'dotenv';
import { setupWebSocketServer, getExchangeInfo } from './websocketServer';
import { connectToMongoDB } from './mongodb';
import { AllTrades } from './models/orderModels';


dotenv.config({path: '.env.local'});

const app : Express = express();
expressWs(app); // Initialize express-ws with the Express instance
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 4000;
const server = http.createServer(app);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
app.use(async (req, res, next) => {
  if (!req.exchangeInfo) {
    try {
     const exchangeInfo = await getExchangeInfo();
     // console.log('exchangeInfoPromise', exchangeInfo);
    } catch (error) {
      console.error('Error getting exchange info:', error);
      res.status(500).send('Exchange info not available');
      return;
    }
  }
  // console.log('getExchange info', req.exchangeInfo);
  next(); // Proceed to the next middleware or route handler
});


// Routes
app.use('/', routes);

connectToMongoDB()
  .then(() => {
    // You can now use the Order model to interact with the database
    AllTrades.find({ symbol: 'BTCUSDT' }).lean() 
      .then((order) => console.log('Order found:', order))
      .catch((error) => console.error('Error finding order:', error));
  })

// Setup WebSocket server
setupWebSocketServer(server);

// Start listening for connections
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
