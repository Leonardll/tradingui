declare global {
    interface Window {
      TradingView: any; // Use 'any' or a more specific type if you have the type definitions
    }
  }
  
  export {}; // This ensures this file is a module