// ============================================
// Routes: Nhập liệu (Data Entry)
// ============================================
// Luồng 2 bước:
//   /app/data-entry          → Chọn biểu mẫu (ChonBieuMauComponent)
//   /app/data-entry/planning/:formCode → Nhập liệu (BaoCaoKeHoachComponent)
// ============================================
import { Routes } from '@angular/router';

export const dataEntryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../features/data-entry/pages/chon-bieu-mau/chon-bieu-mau.component')
        .then(m => m.ChonBieuMauComponent),
  },
  {
    path: 'planning/:formCode',
    loadComponent: () =>
      import('../../features/data-entry/pages/planning-grid/bao-cao-ke-hoach.component')
        .then(m => m.BaoCaoKeHoachComponent),
  },
  // Backward compat: /planning (không có formCode) vẫn hoạt động
  {
    path: 'planning',
    loadComponent: () =>
      import('../../features/data-entry/pages/planning-grid/bao-cao-ke-hoach.component')
        .then(m => m.BaoCaoKeHoachComponent),
  },
];
