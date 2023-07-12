import { useEffect, useState, useRef } from 'react';

type WebSocketData = string; 

interface UseWebSocketResult {
  data: WebSocketData | null;
  error: Error | null;
}

export const useWebSocket = (symbol: string) : UseWebSocketResult => {
  const [data, setData] = useState<WebSocketData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const ws = useRef<WebSocket | null>(null); // <-- Store the WebSocket instance here
  
  useEffect(() => {
    // Only create the WebSocket when we have a symbol
    if (symbol && !ws.current) {
      ws.current = new WebSocket('ws://localhost:4000');
      
      ws.current.onopen = () => {
        console.log('Connected to server');
      };
      
      ws.current.onmessage = (event) => {
        console.log(`Received: ${event.data}`);
        setData(event.data); // Update data state
      };
      
      ws.current.onerror = () => {
        console.error('WebSocket error');
        setError(new Error('WebSocket error')); // Update error state
      };
      
      ws.current.onclose = () => {
        console.log('Disconnected from server');
      };
    }
    // We only want to run this once when the symbol is set, and not on every re-render
  }, [symbol]);

  useEffect(() => {
    if (symbol && ws.current?.readyState === WebSocket.OPEN) {
      console.log('Sending symbol:', symbol);
      ws.current.send(symbol);
    } else if (symbol) {
      console.log('WebSocket not ready to send:', ws.current?.readyState);
    }
  }, [symbol]);

  return { data, error };
}
