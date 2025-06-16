import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private priceSubject = new Subject<{ price: number; time: string; instrumentId: string }>();
  public price$ = this.priceSubject.asObservable();

  private currentInstrumentId: string | null = null;
  private currentToken: string | null = null;

  connect(instrumentId: string, provider: string = 'oanda'): void {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('[WebSocket] No token! Unable to establish a connection.');
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.currentInstrumentId === instrumentId) {
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      this.socket = null;
    }

    this.currentInstrumentId = instrumentId;
    this.currentToken = token;

    const url = 'wss://market-view-back.onrender.com/ws';
    this.socket = new WebSocket(url);

    this.initSocketHandlers(this.currentInstrumentId, provider)
  }

  private initSocketHandlers(instrumentId: string, provider: string) {
    if (!this.socket) {
      console.error('[WebSocket] Socket not initialized for handlers.');
      return;
    }

    this.socket.onopen = () => {
      const subscribeMessage = {
        event: 'l1-subscription',
        data: {
          type: 'l1-subscription',
          id: '1',
          instrumentId: this.currentInstrumentId,
          provider: 'oanda',
          subscribe: true,
          kinds: ['ask', 'bid', 'last'],
          token: this.currentToken
        }
      };
      this.send(subscribeMessage);
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if ((data.type === 'l1-snapshot' || data.type === 'l1-update') && data.last) {
        const price = data.last.price;
        const time = data.last.timestamp;
        const receivedInstrumentId = data.instrumentId;

        this.priceSubject.next({ price, time, instrumentId: receivedInstrumentId });
      }
    };

    this.socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.currentInstrumentId = null;
    };

    this.socket.onclose = () => {
      console.warn('[WebSocket] Connection closed.');
      this.currentInstrumentId = null;
    };
  }

  private send(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Unable to send message: socket not open.');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.currentInstrumentId = null;
    }
  }
}
