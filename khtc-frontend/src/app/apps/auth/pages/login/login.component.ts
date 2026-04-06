// ============================================
// Login Page â€” EVN Workflow Style (Blue)
// ============================================
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../service/auth.service';
import { APP_CONSTANTS } from '../../../../config/setting/app.constants';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
  })
export class LoginComponent {
    private authService = inject(AuthService);
    private router = inject(Router);

    appName = APP_CONSTANTS.APP_SHORT_NAME;
    username = '';
    password = '';
    loading = false;
    errorMessage = '';

    async onLogin(): Promise<void> {
        if (!this.username || !this.password) {
            this.errorMessage = 'Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ thÃ´ng tin';
            return;
        }
        this.loading = true;
        this.errorMessage = '';
        try {
            await this.authService.login({ username: this.username, password: this.password });
            this.router.navigate(['/app']);
        } catch (err: any) {
            this.errorMessage = err?.error?.message || 'ÄÄƒng nháº­p tháº¥t báº¡i. Vui lÃ²ng kiá»ƒm tra láº¡i.';
        } finally {
            this.loading = false;
        }
    }
}
