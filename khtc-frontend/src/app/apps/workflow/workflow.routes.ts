// ============================================
// Routes: Phê duyệt (Workflow)
// ============================================
import { Routes } from '@angular/router';

export const workflowRoutes: Routes = [
    { path: '', redirectTo: 'submissions', pathMatch: 'full' },
    {
        path: 'submissions',
        loadComponent: () =>
            import('./pages/submission-list/danh-sach-ho-so.component')
                .then(m => m.DanhSachHoSoComponent),
    },
    {
        path: 'inbox',
        loadComponent: () =>
            import('./pages/approval-inbox/hop-thu-duyet.component')
                .then(m => m.HopThuDuyetComponent),
    },
];
