// ============================================
// Routes: Module Danh mục (Metadata)
// ============================================
// /app/metadata/accounts  → Quản lý Chỉ tiêu (CRUD)
// /app/metadata/entities  → Quản lý Đơn vị (CRUD)
// /app/metadata/versions  → Quản lý Phiên bản (CRUD)
// ============================================

import { Routes } from '@angular/router';

export const metadataRoutes: Routes = [
  { path: '', redirectTo: 'accounts', pathMatch: 'full' },

  // Quản lý Chỉ tiêu — DataTable CRUD
  {
    path: 'accounts',
    loadComponent: () =>
      import('./pages/quan-ly-chi-tieu/quan-ly-chi-tieu.component')
        .then(m => m.QuanLyChiTieuComponent),
  },

  // Quản lý Đơn vị — DataTable CRUD
  {
    path: 'entities',
    loadComponent: () =>
      import('./pages/quan-ly-don-vi/quan-ly-don-vi.component')
        .then(m => m.QuanLyDonViComponent),
  },

  // Quản lý Phiên bản — DataTable CRUD + Khóa/Mở
  {
    path: 'versions',
    loadComponent: () =>
      import('./pages/quan-ly-phien-ban/quan-ly-phien-ban.component')
        .then(m => m.QuanLyPhienBanComponent),
  },
];
