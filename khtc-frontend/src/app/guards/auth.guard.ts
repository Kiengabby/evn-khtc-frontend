// ============================================
// Auth Guard — Functional guard for Angular 19
// Equivalent to CMIS AuthGuard but using modern functional pattern
// ============================================
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../apps/service/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        return true;
    }

    // Redirect to login with return URL
    router.navigate(['/login'], {
        queryParams: { returnUrl: state.url }
    });
    return false;
};
