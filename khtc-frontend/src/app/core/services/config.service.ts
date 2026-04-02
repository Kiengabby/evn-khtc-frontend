// ============================================
// Config Service — Load app config from JSON (Offline First / Intranet)
// Equivalent to CMIS ConfigService
// ============================================
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
    apiBaseUrl: string;
    apiGatewayUrl: string;
    appTitle: string;
    version: string;
    features: Record<string, boolean>;
}

const DEFAULT_CONFIG: AppConfig = {
    apiBaseUrl: 'http://10.1.117.143:9090',
    apiGatewayUrl: 'http://10.1.117.143:9090',
    appTitle: 'Hệ thống Kế hoạch Tài chính',
    version: '1.0.0',
    features: {},
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
    private config = signal<AppConfig>(DEFAULT_CONFIG);

    constructor(private http: HttpClient) { }

    /** Load config at app startup — called from APP_INITIALIZER */
    async loadConfig(): Promise<void> {
        try {
            const config = await firstValueFrom(
                this.http.get<AppConfig>('/assets/config/app-config.json')
            );
            this.config.set({ ...DEFAULT_CONFIG, ...config });
        } catch (err) {
            console.warn('Could not load app-config.json, using defaults', err);
        }
    }

    get apiBaseUrl(): string {
        return this.config().apiBaseUrl;
    }

    get apiGatewayUrl(): string {
        return this.config().apiGatewayUrl;
    }

    get appTitle(): string {
        return this.config().appTitle;
    }

    isFeatureEnabled(feature: string): boolean {
        return this.config().features[feature] ?? false;
    }

    getConfig(): AppConfig {
        return this.config();
    }
}
