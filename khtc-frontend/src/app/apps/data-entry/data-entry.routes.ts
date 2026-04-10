// ============================================
// Routes: Nhập liệu (Data Entry)
// ============================================
import { Routes } from '@angular/router';

export const dataEntryRoutes: Routes = [
  { path: '', redirectTo: 'planning', pathMatch: 'full' },
  {
    path: 'planning',
    loadComponent: () =>
      import('../../features/data-entry/pages/planning-grid/bao-cao-ke-hoach.component')
        .then(m => m.BaoCaoKeHoachComponent),
  },
];
