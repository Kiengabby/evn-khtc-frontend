// ============================================
// Routes: Báo cáo (Analytics)
// ============================================
import { Routes } from '@angular/router';

export const analyticsRoutes: Routes = [
    { path: '', redirectTo: 'variance', pathMatch: 'full' },
    {
        path: 'variance',
        loadComponent: () =>
            import('./pages/variance-report/bao-cao-chenh-lech.component')
                .then(m => m.BaoCaoChenhLechComponent),
    },
    {
        path: 'consolidation',
        loadComponent: () =>
            import('./pages/consolidation/bao-cao-hop-nhat.component')
                .then(m => m.BaoCaoHopNhatComponent),
    },
];
