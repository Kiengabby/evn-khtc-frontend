// ============================================
// App Routes — Top-level routing configuration
// ============================================
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
    // Auth routes (no layout)
    {
        path: 'login',
        loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent),
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
                loadChildren: () => import('./features/analytics/pages/executive-dashboard/dashboard.component').then(m => m.dashboardRoutes),
            },

            // Metadata — Quản trị Dimension
            {
                path: 'metadata',
                loadChildren: () => import('./features/metadata/metadata.routes').then(m => m.metadataRoutes),
            },

            // Form Designer — Thiết kế Form
            {
                path: 'form-designer',
                loadChildren: () => import('./features/feature-routes').then(m => m.formDesignerRoutes),
            },

            // Data Entry — Nhập liệu
            {
                path: 'data-entry',
                loadChildren: () => import('./features/data-entry/data-entry.routes').then(m => m.dataEntryRoutes),
            },

            // Workflow — Phê duyệt
            {
                path: 'workflow',
                loadChildren: () => import('./features/feature-routes').then(m => m.workflowRoutes),
            },

            // Analytics — Báo cáo
            {
                path: 'analytics',
                loadChildren: () => import('./features/feature-routes').then(m => m.analyticsRoutes),
            },

            // Report Wizard — Tạo mẫu báo cáo
            {
                path: 'report-wizard',
                loadComponent: () => import('./features/report-wizard/pages/tao-bao-cao-wizard.component').then(m => m.TaoBaoCaoWizardComponent),
            },

            // System Admin — Quản trị hệ thống
            {
                path: 'admin',
                loadChildren: () => import('./features/feature-routes').then(m => m.systemAdminRoutes),
            },
        ],
    },

    // Default redirect
    { path: '', redirectTo: '/app', pathMatch: 'full' },

    // 404
    { path: '**', redirectTo: '/app' },
];
