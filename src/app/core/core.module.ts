import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { CollectionsService } from './services/collections.service';
import { CurrencySelectorComponent } from './components/currency-selector/currency-selector.component';
import { PriceDetailsComponent } from './components/price-details/price-details.component';
import { HistoricalPriceChartComponent } from './components/historical-price-chart/historical-price-chart.component';
import { WebSocketService } from './services/web-socket.service';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule } from '@angular/forms';
import { FintachartsService } from './services/fintacharts.service';

@NgModule({
  declarations: [
    CurrencySelectorComponent,
    PriceDetailsComponent,
    HistoricalPriceChartComponent
  ],
  imports: [
    CommonModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule
  ],
  exports: [
    CurrencySelectorComponent,
    PriceDetailsComponent,
    HistoricalPriceChartComponent
  ],
  providers: [
    AuthService,
    CollectionsService,
    WebSocketService,
    FintachartsService
  ]
})
export class CoreModule { }
