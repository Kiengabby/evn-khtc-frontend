// ============================================
// Dashboard � EVN KHTC Executive Overview
// ============================================
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Routes } from '@angular/router';
import { DashboardService } from '../../../service/dashboard.service';
import { ThongKeDashboard } from '../../../../config/models/workflow.model';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardPageComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  thongKe = signal<ThongKeDashboard | null>(null);
  dangTai = signal(false);

  async ngOnInit(): Promise<void> {
    this.dangTai.set(true);
    try {
      const kq = await this.dashboardService.layThongKe();
      if (kq.trangThai) {
        this.thongKe.set(kq.duLieu);
      }
    } catch {
      // silent � hiỒn th�9 trạng thái tr�ng
    }
    this.dangTai.set(false);
  }

  formatSo(n: number): string {
    return n.toLocaleString('vi-VN');
  }

  tinhPhanTram(daNop: number, tongBieuMau: number): number {
    return tongBieuMau > 0 ? Math.round((daNop / tongBieuMau) * 100) : 0;
  }

  tenTrangThai(tt: string): string {
    const map: Record<string, string> = {
      nhap: 'Nháp', cho_duyet: 'Chờ duy�!t', da_duyet: 'Đã duy�!t',
      tu_choi: 'Từ ch�i', tra_lai: 'Trả lại',
    };
    return map[tt] || tt;
  }

  classTrangThai(tt: string): string {
    const map: Record<string, string> = {
      nhap: 'info', cho_duyet: 'warning', da_duyet: 'success',
      tu_choi: 'error', tra_lai: 'warning',
    };
    return map[tt] || 'info';
  }
}

export const dashboardRoutes: Routes = [
  { path: '', component: DashboardPageComponent }
];
