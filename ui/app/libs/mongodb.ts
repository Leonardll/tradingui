import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Extend the global object with custom properties for mongoose caching
declare global {
  namespace NodeJS {
    interface Global {
      mongoose: {
        conn: any;
        promise: any;
      };
    }
  }
}

// Use the global object with the extended type definition
let cached = (global as any).mongoose;

if (!cached) {
cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    // Assert that MONGODB_URI is a string
    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default {dbConnect};
