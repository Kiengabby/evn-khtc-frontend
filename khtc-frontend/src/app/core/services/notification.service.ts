// ============================================
// Notification Service — Centralized toast/message service
// ============================================
import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class NotificationService {
    constructor(private messageService: MessageService) { }

    showSuccess(message: string, title: string = 'Thành công'): void {
        this.messageService.add({
            severity: 'success',
            summary: title,
            detail: message,
            life: 3000,
        });
    }

    showError(message: string, title: string = 'Lỗi'): void {
        this.messageService.add({
            severity: 'error',
            summary: title,
            detail: message,
            life: 5000,
        });
    }

    showWarning(message: string, title: string = 'Cảnh báo'): void {
        this.messageService.add({
            severity: 'warn',
            summary: title,
            detail: message,
            life: 4000,
        });
    }

    showInfo(message: string, title: string = 'Thông báo'): void {
        this.messageService.add({
            severity: 'info',
            summary: title,
            detail: message,
            life: 3000,
        });
    }

    clear(): void {
        this.messageService.clear();
    }
}
