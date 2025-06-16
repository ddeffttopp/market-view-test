import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = 'https://market-view-back.onrender.com';

  constructor(private http: HttpClient) { }

  login(username: string, password: string): Observable<any> {
    const body = new HttpParams()
      .set('grant_type', 'password')
      .set('client_id', 'app-cli')
      .set('username', username)
      .set('password', password);

    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');

    return this.http.post(`${this.authUrl}/auth/login`, body, { headers }).pipe(
      tap((res: any) => {
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('refresh_token', res.refresh_token);
      })
    );
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }
}
