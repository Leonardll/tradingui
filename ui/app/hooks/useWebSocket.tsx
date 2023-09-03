import { useEffect, useState, useRef } from "react"

type WebSocketData = string

interface UseWebSocketResult {
    data: WebSocketData | null
    error: Error | null
}

export const useWebSocket = (symbol: string, orderAccepted:boolean, orderId?:string): UseWebSocketResult => {
    const [data, setData] = useState<WebSocketData | null>(null)
    const [error, setError] = useState<Error | null>(null)
    const ws = useRef<WebSocket | null>(null) // <-- Store the WebSocket instance here
    
    useEffect(() => {
        // Only create the WebSocket when we have a symbol
        if (symbol && !ws.current) {
            ws.current = new WebSocket("ws://localhost:4000")

            ws.current.onopen = () => {
                console.log("Connected to server")
            }

            ws.current.onmessage = (event) => {
                console.log(`Received: ${event.data}`)
                setData(event.data) // Update data state
            }

            ws.current.onerror = () => {
                console.error("WebSocket error")
                setError(new Error("WebSocket error")) // Update error state
            }

            ws.current.onclose = () => {
                console.log("Disconnected from server")
            }
        }
        // We only want to run this once when the symbol is set, and not on every re-render
    }, [symbol])

    useEffect(() => {
        if (symbol && ws.current?.readyState === WebSocket.OPEN) {
            console.log("Sending symbol:", symbol)
            ws.current.send(symbol)
        } else if (symbol) {
            console.log("WebSocket not ready to send:", ws.current?.readyState)
        }
    }, [symbol])
    useEffect(() => {
      console.log("WebSocket Effect Running with Order ID:", orderId); // Log inside useEffect

      if (orderAccepted && orderId && symbol) {
        console.log(symbol, orderId);
        const tradeWs = new WebSocket('ws://localhost:4000/userTradeStream');
    
        tradeWs.onopen = () => {
          console.log("Connected to userTradeStream");
          console.log(`Sending order ID: ${orderId} and symbol: ${symbol}`);
          tradeWs.send(JSON.stringify({ orderId, symbol })); // Send the order ID and symbol to the server
        };
    
        tradeWs.onmessage = (event) => {
          console.log(`Received trade data: ${event.data}`);
          // Handle trade data here...
        };
    
        tradeWs.onerror = (errorEvent) => {
          console.error("WebSocket trade error:", errorEvent);
          // Handle trade WebSocket error here...
        };
    
        tradeWs.onclose = (event) => {
          console.log(`Trade WebSocket closed, code=${event.code}, reason=${event.reason}`);
          // Handle trade WebSocket closure here...
        };
      } else {
        // Handle edge cases where orderAccepted, orderId, or symbol is not defined
        if (!orderAccepted) {
          console.warn("Order not accepted. WebSocket connection not established.");
        }
        if (!orderId) {
          console.warn("Order ID is undefined. WebSocket connection not established.");
        }
        if (!symbol) {
          console.warn("Symbol is undefined. WebSocket connection not established.");
        }
      }
    }, [orderAccepted, orderId, symbol]); // Include symbol in the dependency array
     // Include symbol in the dependency array
  

    return { data, error }
}
