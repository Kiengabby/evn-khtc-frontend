// ============================================
// Service: Dashboard — Wrapper cho MockApiService
// ============================================
import { Injectable, inject } from '@angular/core';
import { MockApiService } from '../../../core/services/mock-api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
    private api = inject(MockApiService);

    layThongKe() {
        return this.api.layThongKeDashboard();
    }
}
