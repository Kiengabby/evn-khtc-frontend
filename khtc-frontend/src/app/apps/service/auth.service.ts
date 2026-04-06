// ============================================
// Auth Service â€” Login, logout, token management
// Equivalent to CMIS auth.service but using Signals
// ============================================
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User, LoginRequest, LoginResponse } from '../../config/models';
import { APP_CONSTANTS } from '../../config/setting/app.constants';
import { ConfigService } from '../../core/app-config.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private currentUser = signal<User | null>(null);

    /** Reactive computed properties */
    readonly user = this.currentUser.asReadonly();
    readonly isLoggedIn = computed(() => this.currentUser() !== null);
    readonly userName = computed(() => this.currentUser()?.fullName ?? '');
    readonly entityCode = computed(() => this.currentUser()?.entityCode ?? '');

    constructor(
        private http: HttpClient,
        private router: Router,
        private configService: ConfigService
    ) {
        this.loadFromStorage();
    }

    /** Login */
    async login(credentials: LoginRequest): Promise<User> {
        const url = `${this.configService.apiBaseUrl}/api/auth/login`;
        const response = await firstValueFrom(
            this.http.post<LoginResponse>(url, credentials)
        );

        this.setSession(response);
        return response.user;
    }

    /** Logout */
    logout(): void {
        localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.USER_INFO);
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }

    /** Get JWT token */
    getToken(): string | null {
        return localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN);
    }

    /** Check authentication */
    isAuthenticated(): boolean {
        const token = this.getToken();
        if (!token) return false;

        // Basic JWT expiry check
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    }

    /** Check permission */
    hasPermission(permission: string): boolean {
        const user = this.currentUser();
        if (!user) return false;
        // TODO: Implement matrix permission check
        return true;
    }

    private setSession(response: LoginResponse): void {
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.TOKEN, response.token);
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.USER_INFO, JSON.stringify(response.user));
        this.currentUser.set(response.user);
    }

    private loadFromStorage(): void {
        try {
            const userStr = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.USER_INFO);
            if (userStr && this.isAuthenticated()) {
                this.currentUser.set(JSON.parse(userStr));
            }
        } catch {
            this.currentUser.set(null);
        }
    }
}
