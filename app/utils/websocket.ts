export class WebSocketClient {
  private url: string;
  private instance: WebSocket | null = null;
  private reconnectInterval: number;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;

  constructor(url: string, reconnectInterval = 5000, maxReconnectAttempts = 5) {
    this.url = url;
    this.reconnectInterval = reconnectInterval;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = maxReconnectAttempts;
  }

  connect() {
    if (this.instance) {
      console.error('WebSocket is already connected or connecting');
      return;
    }

    this.instance = new WebSocket(this.url);

    this.instance.onopen = () => {
      console.log('WebSocket Opened');
      this.reconnectAttempts = 0;
    };

    this.instance.onerror = (error) => {
      console.log('WebSocket Error: ', error);
    };

    this.instance.onclose = (event) => {
      console.log('WebSocket Closed: ', event);
      this.instance = null;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`WebSocket Reconnecting... Attempt ${this.reconnectAttempts + 1}`);
        this.reconnectTimeoutId = setTimeout(() => this.connect(), this.reconnectInterval);
        this.reconnectAttempts++;
      } else {
        console.log('WebSocket Max Reconnect Attempts Reached');
      }
    };
  }

  disconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }

  send(data: string) {
    if (this.instance && this.instance.readyState === WebSocket.OPEN) {
      this.instance.send(data);
    } else {
      console.error('WebSocket Not Open');
    }
  }

  onMessage(callback: (data: any) => void) {
    if (this.instance) {
      this.instance.onmessage = (event) => {
        callback(event.data);
      };
    }
  }

  get readyState() {
    return this.instance ? this.instance.readyState : -1;
  }
}
