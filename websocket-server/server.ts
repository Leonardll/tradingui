import express, {Express, Request, Response, NextFunction} from 'express';
import http from 'http';
import cors from 'cors';
import routes from './routes'; // Assuming you have a routes.ts file
import dotenv from 'dotenv';
import { setupWebSocketServer } from './websocketServer';
import { connectToMongoDB } from './mongodb';
import { AllTrades } from './models/orderModels';
import { set } from 'mongoose';
import { eventEmitter } from './events/eventEmitter';

dotenv.config({path: '.env.local'});

const app  = express();
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 4000;
const server = http.createServer(app);
// const wss = new Server({ server });

interface ClientData {
  symbol: string;
  orderId: string;
}






// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});



// Routes


// connectToMongoDB()
//   .then(() => {
//     // You can now use the Order model to interact with the database
//     AllTrades.find({ symbol: 'BTCUSDT' }).lean() 
//       .then((order) => console.log('Order found:', order))
//       .catch((error) => console.error('Error finding order:', error));
//   })

// Setup WebSocket server

// Start listening for connections
app.use('/', routes);

async function initializeApplication() {
  try {
    // MongoDB initialization

    await connectToMongoDB()
    console.log('MongoDB connected');
 
    setupWebSocketServer(server);
    
    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  }
  catch (error) {
      console.error('error during itinitialisation', error);

  }
 
}





initializeApplication()
    // Now it's safe to set up WebSocket server
    
    

  