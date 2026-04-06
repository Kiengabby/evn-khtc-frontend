// ============================================
// Routes: Thiết kế Biểu mẫu (Form Designer)
// ============================================
import { Routes } from '@angular/router';

export const formDesignerRoutes: Routes = [
    { path: '', redirectTo: 'templates', pathMatch: 'full' },
    {
        path: 'templates',
        loadComponent: () =>
            import('./pages/template-list/danh-sach-bieu-mau.component')
                .then(m => m.DanhSachBieuMauComponent),
    },
    {
        path: 'builder',
        loadComponent: () =>
            import('./pages/form-builder/thiet-ke-bieu-mau.component')
                .then(m => m.ThietKeBieuMauComponent),
    },
    {
        path: 'builder/:id',
        loadComponent: () =>
            import('./pages/form-builder/thiet-ke-bieu-mau.component')
                .then(m => m.ThietKeBieuMauComponent),
    },
];
