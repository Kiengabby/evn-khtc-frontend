// ============================================
// App Routes — Top-level routing configuration
// ============================================
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
    // Auth routes (no layout)
    {
        path: 'login',
        loadComponent: () => import('./apps/auth/pages/login/login.component').then(m => m.LoginComponent),
    },

    // Main app routes (with layout shell)
    {
        path: 'app',
        component: MainLayoutComponent,
        // canActivate: [authGuard],  // TODO: Enable after backend auth is ready
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

            // Dashboard
            {
                path: 'dashboard',
                loadChildren: () => import('./apps/analytics/pages/executive-dashboard/dashboard.component').then(m => m.dashboardRoutes),
            },

            // Metadata — Quản trị Dimension
            {
                path: 'metadata',
                loadChildren: () => import('./apps/metadata/metadata.routes').then(m => m.metadataRoutes),
            },

            // Form Designer — Thiết kế Form
            {
                path: 'form-designer',
                loadChildren: () => import('./apps/form-designer/form-designer.routes').then(m => m.formDesignerRoutes),
            },

            // Data Entry — Nhập liệu
            {
                path: 'data-entry',
                loadChildren: () => import('./apps/data-entry/data-entry.routes').then(m => m.dataEntryRoutes),
            },

            // Workflow — Phê duyệt
            {
                path: 'workflow',
                loadChildren: () => import('./apps/workflow/workflow.routes').then(m => m.workflowRoutes),
            },

            // Analytics — Báo cáo
            {
                path: 'analytics',
                loadChildren: () => import('./apps/analytics/analytics.routes').then(m => m.analyticsRoutes),
            },

            // Report Wizard — Tạo mẫu báo cáo
            {
                path: 'report-wizard',
                loadComponent: () => import('./apps/report-wizard/pages/tao-bao-cao-wizard.component').then(m => m.TaoBaoCaoWizardComponent),
            },

            // System Admin — Quản trị hệ thống
            {
                path: 'admin',
                loadChildren: () => import('./apps/system-admin/system-admin.routes').then(m => m.systemAdminRoutes),
            },
        ],
    },

    // Default redirect
    { path: '', redirectTo: '/app', pathMatch: 'full' },

    // 404
    { path: '**', redirectTo: '/app' },
];
