// ============================================
// Feature Routes — Form Designer, Workflow, Analytics, System Admin
// ============================================
import { Routes } from '@angular/router';

// --- Form Designer (real components) ---
export const formDesignerRoutes: Routes = [
    { path: '', redirectTo: 'templates', pathMatch: 'full' },
    {
        path: 'templates',
        loadComponent: () =>
            import('./form-designer/pages/template-list/danh-sach-bieu-mau.component')
                .then(m => m.DanhSachBieuMauComponent),
    },
    {
        path: 'builder',
        loadComponent: () =>
            import('./form-designer/pages/form-builder/thiet-ke-bieu-mau.component')
                .then(m => m.ThietKeBieuMauComponent),
    },
    {
        path: 'builder/:id',
        loadComponent: () =>
            import('./form-designer/pages/form-builder/thiet-ke-bieu-mau.component')
                .then(m => m.ThietKeBieuMauComponent),
    },
];

// --- Workflow (real components) ---
export const workflowRoutes: Routes = [
    { path: '', redirectTo: 'submissions', pathMatch: 'full' },
    {
        path: 'submissions',
        loadComponent: () =>
            import('./workflow/pages/submission-list/danh-sach-ho-so.component')
                .then(m => m.DanhSachHoSoComponent),
    },
    {
        path: 'inbox',
        loadComponent: () =>
            import('./workflow/pages/approval-inbox/hop-thu-duyet.component')
                .then(m => m.HopThuDuyetComponent),
    },
];

// --- Analytics (real components) ---
export const analyticsRoutes: Routes = [
    { path: '', redirectTo: 'variance', pathMatch: 'full' },
    {
        path: 'variance',
        loadComponent: () =>
            import('./analytics/pages/variance-report/bao-cao-chenh-lech.component')
                .then(m => m.BaoCaoChenhLechComponent),
    },
    {
        path: 'consolidation',
        loadComponent: () =>
            import('./analytics/pages/consolidation/bao-cao-hop-nhat.component')
                .then(m => m.BaoCaoHopNhatComponent),
    },
];

// --- System Admin (real components) ---
export const systemAdminRoutes: Routes = [
    { path: '', redirectTo: 'users', pathMatch: 'full' },
    {
        path: 'users',
        loadComponent: () =>
            import('./system-admin/pages/quan-ly-nguoi-dung.component')
                .then(m => m.QuanLyNguoiDungComponent),
    },
    {
        path: 'roles',
        loadComponent: () =>
            import('./system-admin/pages/quan-ly-vai-tro.component')
                .then(m => m.QuanLyVaiTroComponent),
    },
];
