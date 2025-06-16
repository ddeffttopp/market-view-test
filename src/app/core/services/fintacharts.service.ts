import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FintachartsBarsResponse } from '../interface/instrument-bar.interface';
import { TimeUnit } from 'chart.js';

@Injectable({
  providedIn: 'root'
})
export class FintachartsService {
  private readonly BASE_URL = 'https://platform.fintacharts.com';

  constructor(private http: HttpClient) { }

  getBars(
    instrumentId: string,
    authToken: string,
    interval: number,
    periodicity: TimeUnit,
    barsCount: number,
    provider: string = 'oanda'
  ): Observable<FintachartsBarsResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    });

    let params = new HttpParams()
      .set('instrumentId', instrumentId)
      .set('provider', provider)
      .set('interval', interval.toString())
      .set('periodicity', periodicity)
      .set('barsCount', barsCount.toString());

    const url = `${this.BASE_URL}/api/bars/v1/bars/count-back`;

    return this.http.get<FintachartsBarsResponse>(url, { headers, params });
  }
}
