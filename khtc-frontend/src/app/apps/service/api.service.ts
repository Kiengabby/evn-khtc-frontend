// ============================================
// API Service â€” Base HTTP service
// Modernized equivalent of CMIS iServiceBase
// ============================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, PagedResult } from '../../config/models';
import { ConfigService } from '../../core/app-config.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
    constructor(
        private http: HttpClient,
        private configService: ConfigService
    ) { }

    private getUrl(endpoint: string): string {
        return `${this.configService.apiBaseUrl}${endpoint}`;
    }

    // --- GET ---
    get<T>(endpoint: string, params?: Record<string, any>): Observable<ApiResponse<T>> {
        let httpParams = new HttpParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    httpParams = httpParams.set(key, String(value));
                }
            });
        }
        return this.http.get<ApiResponse<T>>(this.getUrl(endpoint), { params: httpParams });
    }

    async getAsync<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
        const response = await firstValueFrom(this.get<T>(endpoint, params));
        return response.data;
    }

    // --- POST ---
    post<T>(endpoint: string, body: any): Observable<ApiResponse<T>> {
        return this.http.post<ApiResponse<T>>(this.getUrl(endpoint), body);
    }

    async postAsync<T>(endpoint: string, body: any): Promise<T> {
        const response = await firstValueFrom(this.post<T>(endpoint, body));
        return response.data;
    }

    // --- PUT ---
    put<T>(endpoint: string, body: any): Observable<ApiResponse<T>> {
        return this.http.put<ApiResponse<T>>(this.getUrl(endpoint), body);
    }

    async putAsync<T>(endpoint: string, body: any): Promise<T> {
        const response = await firstValueFrom(this.put<T>(endpoint, body));
        return response.data;
    }

    // --- DELETE ---
    delete<T>(endpoint: string): Observable<ApiResponse<T>> {
        return this.http.delete<ApiResponse<T>>(this.getUrl(endpoint));
    }

    async deleteAsync<T>(endpoint: string): Promise<T> {
        const response = await firstValueFrom(this.delete<T>(endpoint));
        return response.data;
    }

    // --- DOWNLOAD ---
    downloadFile(endpoint: string, body?: any): Observable<Blob> {
        return this.http.post(this.getUrl(endpoint), body ?? {}, {
            responseType: 'blob',
        });
    }

    // --- PAGED ---
    getPaged<T>(endpoint: string, page: number, pageSize: number, filters?: Record<string, any>): Observable<ApiResponse<PagedResult<T>>> {
        const params = { page, pageSize, ...filters };
        return this.get<PagedResult<T>>(endpoint, params);
    }
}
