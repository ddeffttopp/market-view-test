import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { Chart, ChartConfiguration, registerables, ChartType, TimeUnit, TimeScaleOptions } from 'chart.js';
import { Chart as ChartjsChart } from 'chart.js';
import { DateTime } from 'luxon';
import { FintachartsService } from '../../services/fintacharts.service';
import { FintachartsBarsResponse, ChartBarData } from '../../interface/instrument-bar.interface';
import { WebSocketService } from '../../services/web-socket.service';

import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';

import 'chartjs-adapter-luxon';
import { Subscription, Subject, filter } from 'rxjs';

Chart.register(...registerables);
Chart.register(CandlestickController, CandlestickElement);


@Component({
  selector: 'app-historical-price-chart',
  templateUrl: './historical-price-chart.component.html',
  styleUrls: ['./historical-price-chart.component.scss']
})
export class HistoricalPriceChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('priceChartCanvas') priceChartCanvas!: ElementRef<HTMLCanvasElement>;

  private myChart!: ChartjsChart;
  private _currentPeriodicity: TimeUnit = 'minute';

  private readonly NUMBER_OF_BARS = 20;
  private wsPriceSubscription: Subscription | undefined;
  private destroy$ = new Subject<void>();

  private fetchBarsSubscription: Subscription | undefined;
  private currentOpenBar: ChartBarData | null = null;

  private pricePrecision: number = 2;

  private _instrumentId: string | undefined;
  @Input()
  set instrumentId(value: string | undefined) {
    this._instrumentId = value;

    if (this._instrumentId) {
      this.fetchAndDisplayBars();
    } else {
      this.clearChartAndSubscriptions();
    }
  }

  get instrumentId(): string | undefined {
    return this._instrumentId;
  }

  private _initialPeriodicity: TimeUnit = 'minute';
  @Input()
  set initialPeriodicity(value: TimeUnit) {
    const previousValue = this.initialPeriodicity;
    this._initialPeriodicity = value;

    if (value !== previousValue) {
      this._currentPeriodicity = value;
      const selectElement = document.getElementById('periodicitySelect') as HTMLSelectElement;
      if (selectElement) {
        selectElement.value = this._currentPeriodicity;
      }
      if (this.instrumentId) {
        this.fetchAndDisplayBars();
      }
    }
  }
  get initialPeriodicity(): TimeUnit {
    return this._initialPeriodicity;
  }

  chartData: ChartBarData[] = [];

  constructor(
    private fintachartsService: FintachartsService,
    private wsService: WebSocketService
  ) { }

  ngOnInit(): void {
    this._currentPeriodicity = this.initialPeriodicity;
  }

  ngAfterViewInit(): void {
    if (this._instrumentId && !this.myChart) {
      this.fetchAndDisplayBars();
    }
  }

  private clearChartAndSubscriptions(): void {
    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null as any;
    }
    this.chartData = [];
    if (this.wsPriceSubscription) {
      this.wsPriceSubscription.unsubscribe();
      this.wsPriceSubscription = undefined;
    }
    if (this.fetchBarsSubscription) {
      this.fetchBarsSubscription.unsubscribe();
      this.fetchBarsSubscription = undefined;
    }
    this.wsService.disconnect();
    this.currentOpenBar = null;
    this.pricePrecision = 2;
  }

  private fetchAndDisplayBars(): void {
    if (this.wsPriceSubscription) {
      this.wsPriceSubscription.unsubscribe();
      this.wsPriceSubscription = undefined;
    }
    this.wsService.disconnect();

    if (this.fetchBarsSubscription) {
      this.fetchBarsSubscription.unsubscribe();
      this.fetchBarsSubscription = undefined;
    }

    this.chartData = [];
    if (this.myChart) {
      this.myChart.data.datasets[0].data = [];
      this.myChart.update();
    }

    const currentAuthToken = localStorage.getItem('access_token');

    if (!this._instrumentId || !currentAuthToken) {
      this.clearChartAndSubscriptions();
      return;
    }

    this.fetchBarsSubscription = this.fintachartsService.getBars(
      this._instrumentId,
      currentAuthToken,
      1,
      this._currentPeriodicity,
      this.NUMBER_OF_BARS
    ).subscribe({
      next: (response: FintachartsBarsResponse) => {
        if (response && Array.isArray(response.data)) {
          this.chartData = response.data.map(bar => ({
            x: DateTime.fromISO(bar.t).toMillis(),
            o: bar.o,
            h: bar.h,
            l: bar.l,
            c: bar.c
          }));

          this.pricePrecision = this.determinePricePrecision(this.chartData);

          if (!this.myChart) {
            this.createChart();
          } else {
            this.updateChartDataAndRedraw();
          }

          this.currentOpenBar = this.chartData.length > 0 ? this.chartData[this.chartData.length - 1] : null;

          this.startRealtimePriceUpdates(this._instrumentId!);
        } else {
          console.error('[ChartComponent] The error: "data" in the API response is not an array:', response);
          this.chartData = [];
          this.pricePrecision = 2;
          this.clearChartAndSubscriptions();
        }
        this.fetchBarsSubscription = undefined;
      },
      error: (err) => {
        console.error('[ChartComponent] Error while obtaining historical bar data:', err);
        this.chartData = [];
        this.pricePrecision = 2;
        this.clearChartAndSubscriptions();
        this.fetchBarsSubscription = undefined;
      }
    });
  }

  private startRealtimePriceUpdates(instrumentId: string): void {
    this.wsService.connect(instrumentId, 'oanda');

    if (!this.wsPriceSubscription) {
      this.wsPriceSubscription = this.wsService.price$
        .pipe(
          filter((update: { price: number; time: string; instrumentId: string }) => update.instrumentId === instrumentId),
        )
        .subscribe({
          next: (update: { price: number; time: string; instrumentId: string }) => {
            this.processRealtimePrice(update.price, update.time);
          },
          error: (err) => {
            console.error('[HistoricalPriceChartComponent] Error in price flow WebSocket:', err);
            this.wsPriceSubscription?.unsubscribe();
            this.wsPriceSubscription = undefined;
            this.wsService.disconnect();
          }
        });
    }
  }

  private processRealtimePrice(newPrice: number, timestamp: string): void {
    if (!this.myChart) {
      console.warn('Chart not initialized, skipping price update.');
      return;
    }

    const newPriceDateTime = DateTime.fromISO(timestamp);

    let currentBarPeriodStart: DateTime;
    switch (this._currentPeriodicity) {
      case 'minute': currentBarPeriodStart = newPriceDateTime.startOf('minute'); break;
      case 'hour': currentBarPeriodStart = newPriceDateTime.startOf('hour'); break;
      case 'day': currentBarPeriodStart = newPriceDateTime.startOf('day'); break;
      case 'week': currentBarPeriodStart = newPriceDateTime.startOf('week'); break;
      case 'month': currentBarPeriodStart = newPriceDateTime.startOf('month'); break;
      case 'year': currentBarPeriodStart = newPriceDateTime.startOf('year'); break;
      default: currentBarPeriodStart = newPriceDateTime.startOf('minute'); break;
    }
    const currentBarPeriodStartMillis = currentBarPeriodStart.toMillis();

    const lastChartDataIndex = this.chartData.length - 1;
    const lastChartDataBarTimeMillis = lastChartDataIndex >= 0 ? this.chartData[lastChartDataIndex].x : -1;

    const isNewBarPeriod = lastChartDataIndex < 0 || currentBarPeriodStartMillis > lastChartDataBarTimeMillis;


    if (isNewBarPeriod) {
      const newBar: ChartBarData = {
        x: currentBarPeriodStartMillis,
        o: newPrice,
        h: newPrice,
        l: newPrice,
        c: newPrice
      };

      this.chartData.push(newBar);

      if (this.chartData.length > this.NUMBER_OF_BARS) {
        this.chartData.shift();
      }

      this.currentOpenBar = this.chartData[this.chartData.length - 1];


    } else {
      if (this.currentOpenBar) {
        this.currentOpenBar.h = Math.max(this.currentOpenBar.h, newPrice);
        this.currentOpenBar.l = Math.min(this.currentOpenBar.l, newPrice);
        this.currentOpenBar.c = newPrice;
      }
    }

    this.pricePrecision = this.determinePricePrecision(this.chartData);
    this.updateChartDataAndRedraw();
  }

  private updateChartDataAndRedraw(): void {
    if (!this.myChart || !this.myChart.data || !this.myChart.data.datasets || !this.myChart.data.datasets[0]) {
      console.warn('Chart or its data is not initialized for updating.');
      return;
    }

    this.myChart.data.datasets[0].data = this.chartData as any[];

    const yScale = this.myChart.options.scales?.['y'];
    if (yScale) {
      if (this.chartData.length > 0) {
        const prices = this.chartData.flatMap(d => [d.o, d.h, d.l, d.c]);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        const priceRange = maxPrice - minPrice;
        const padding = priceRange * 0.15;

        let yAxisMin = minPrice - padding;
        let yAxisMax = maxPrice + padding;

        if (priceRange === 0) {
          yAxisMin = minPrice * 0.99;
          yAxisMax = minPrice * 1.01;
        } else if (yAxisMin < 0 && minPrice >= 0) {
          yAxisMin = 0;
        }

        yScale.min = yAxisMin;
        yScale.max = yAxisMax;
        (yScale as any).beginAtZero = false;
      } else {
        yScale.min = undefined;
        yScale.max = undefined;
        (yScale as any).beginAtZero = true;
      }
    }

    this.myChart.update();
  }

  private determinePricePrecision(data: ChartBarData[]): number {
    let maxPrecision = 0;
    if (!data || data.length === 0) {
      return 4;
    }

    for (const bar of data) {
      const pricesToCheck = [bar.o, bar.h, bar.l, bar.c];
      for (const price of pricesToCheck) {
        const priceString = price.toString();
        const decimalIndex = priceString.indexOf('.');
        if (decimalIndex !== -1) {
          const precision = priceString.length - 1 - decimalIndex;
          if (precision > maxPrecision) {
            maxPrecision = precision;
          }
        }
      }
    }
    return Math.min(maxPrecision, 5);
  }

  onPeriodicityChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const newPeriodicity = selectElement.value as TimeUnit;

    this._currentPeriodicity = newPeriodicity;

    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null as any;
    }

    this.fetchAndDisplayBars();

    const selectedOptionText = selectElement.options[selectElement.selectedIndex].text;
    if (this.myChart && this.myChart.options.scales?.['x'] && (this.myChart.options.scales?.['x'] as TimeScaleOptions).title) {
      (this.myChart.options.scales?.['x'] as TimeScaleOptions).title!.text = `Time (${selectedOptionText})`;
    }
  }

  private createChart(): void {
    if (this.myChart) {
      this.myChart.destroy();
      this.myChart = null as any;
    }

    const ctx = this.priceChartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context for canvas.');
      return;
    }

    const chartConfig: ChartConfiguration = {
      type: 'candlestick' as ChartType,
      data: {
        datasets: [{
          label: 'Price',
          data: this.chartData as any[],
          barThickness: 'flex',
          financial: {
            color: {
              up: 'rgba(0, 128, 0, 0.8)',
              down: 'rgba(255, 0, 0, 0.8)',
              unchanged: 'rgba(128, 128, 128, 0.8)'
            },
            borderColor: {
              up: 'rgba(0, 128, 0, 1)',
              down: 'rgba(255, 0, 0, 1)',
              unchanged: 'rgba(128, 128, 128, 1)'
            }
          }
        } as any]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0,
          easing: 'linear'
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: this._currentPeriodicity,
              tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
              displayFormats: {
                minute: 'HH:mm',
                hour: 'HH:mm',
                day: 'MMM d',
                week: 'MMM d',
                month: 'MMM yyyy',
                year: 'yyyy',
              }
            },
            title: {
              display: true,
              text: `Time (${this._currentPeriodicity === 'minute' ? 'Minute' : this._currentPeriodicity === 'hour' ? 'hour' : this._currentPeriodicity === 'day' ? 'Day' : this._currentPeriodicity === 'week' ? 'Week' : this._currentPeriodicity === 'month' ? 'Month' : 'Year'})`,
              font: { size: 14 }
            },
            ticks: {
              font: {
                size: 10
              },
              maxRotation: 45,
              minRotation: 45,
              autoSkip: true,
              autoSkipPadding: 10,
            },
            grid: { display: false }
          },
          y: {
            title: {
              display: true,
              text: 'Price',
              font: { size: 14 }
            },
            ticks: {
              callback: (value: any) => {
                return value.toFixed(this.pricePrecision);
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                const dataPoint = context[0].raw as ChartBarData;
                return DateTime.fromMillis(dataPoint.x).setLocale('en-US').toLocaleString(DateTime.DATETIME_FULL);
              },
              label: (context) => {
                const dataPoint = context.raw as ChartBarData;
                return [
                  `Open: ${dataPoint.o.toFixed(this.pricePrecision)}`,
                  `Max: ${dataPoint.h.toFixed(this.pricePrecision)}`,
                  `Min: ${dataPoint.l.toFixed(this.pricePrecision)}`,
                  `Close: ${dataPoint.c.toFixed(this.pricePrecision)}`
                ];
              }
            }
          }
        }
      }
    };

    this.myChart = new ChartjsChart(ctx, chartConfig as ChartConfiguration<'candlestick'>);
  }

  ngOnDestroy(): void {
    this.clearChartAndSubscriptions();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
