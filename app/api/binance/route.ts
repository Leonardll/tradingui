import { NextApiRequest, NextApiResponse } from 'next';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import Binance from 'binance-api-node';

const apiKey = process.env.NEXT_PUBLIC_BINANCE_API_KEY;
const apiSecret = process.env.NEXT_PUBLIC_BINANCE_SECRET_KEY;

const client = Binance();

const client2 = Binance({
  apiKey: apiKey,
  apiSecret: apiSecret,
  getTime: () => Date.now(),
});

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  try {
    const connectTest = await client2.ping();
    console.log(connectTest);
    res.status(200).json(connectTest);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
};

export default withApiAuthRequired(handler);
