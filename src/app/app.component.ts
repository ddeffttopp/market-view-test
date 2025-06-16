import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { CollectionsService } from './core/services/collections.service';
import { ApiResponse, CollectionData } from './core/interface/collections.interface';
import { WebSocketService } from './core/services/web-socket.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  collectionsData: CollectionData[] = [];
  currentSymbol: string | null = null;
  currentPrice: number | null = null;
  currentTime: string | null = null;

  selectedInstrumentIdForChart: string | undefined;
  userAuthTokenForChart: string | undefined;

  constructor(
    private authService: AuthService,
    private collectionsService: CollectionsService,
    private wsService: WebSocketService
  ) { }

  ngOnInit(): void {
    this.authService.login('r_test@fintatech.com', 'kisfiz-vUnvy9-sopnyv').subscribe({
      next: () => {
        this.userAuthTokenForChart = localStorage.getItem('access_token') || undefined;

        this.collectionsService.getInstruments().subscribe({
          next: (response: ApiResponse) => {
            this.collectionsData = response.data;
          },
          error: (err) => console.error('Error in receiving tools:', err)
        });
      },
      error: (err) => console.error('Login error:', err)
    });

    this.wsService.price$.subscribe({
      next: ({ price, time, instrumentId }) => {
        if (this.selectedInstrumentIdForChart && instrumentId === this.selectedInstrumentIdForChart) {
          this.currentPrice = price;
          this.currentTime = time;
        }
      },
      error: (err) => console.error('[AppComponent] Error in price flow WebSocket:', err)
    });
  }

  connectToInstrument(symbol: string): void {
    const instrument = this.collectionsData.find(i => i.symbol === symbol);

    if (instrument) {
      this.wsService.connect(instrument.id, 'oanda');
      this.currentSymbol = symbol;

      this.selectedInstrumentIdForChart = instrument.id;
      if (!this.userAuthTokenForChart) {
        this.userAuthTokenForChart = localStorage.getItem('access_token') || undefined;
      }

    } else {
      console.warn(`[AppComponent] Tool '${symbol}' not found in the data collection. Unable to connect.`);
      this.currentPrice = null;
      this.currentTime = null;
      this.selectedInstrumentIdForChart = undefined;
      this.userAuthTokenForChart = undefined;
      this.wsService.disconnect();
    }
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
  }
}
