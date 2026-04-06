// ============================================
// Routes: Quản trị Hệ thống (System Admin)
// ============================================
import { Routes } from '@angular/router';

export const systemAdminRoutes: Routes = [
    { path: '', redirectTo: 'users', pathMatch: 'full' },
    {
        path: 'users',
        loadComponent: () =>
            import('./pages/quan-ly-nguoi-dung.component')
                .then(m => m.QuanLyNguoiDungComponent),
    },
    {
        path: 'roles',
        loadComponent: () =>
            import('./pages/quan-ly-vai-tro.component')
                .then(m => m.QuanLyVaiTroComponent),
    },
];
