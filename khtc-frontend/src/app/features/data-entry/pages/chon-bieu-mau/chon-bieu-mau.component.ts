// ============================================
// Page: Chọn Biểu Mẫu Nhập Liệu
// ============================================
// Bước 1 trong luồng nhập liệu:
//   Người dùng chọn biểu mẫu → navigate sang trang nhập liệu
//   GET /api/v2/FormTemplate/get-list
// ============================================

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PlanningApiService, FormTemplateListItem } from '../../services/planning-api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chon-bieu-mau.component.html',
  styleUrl: './chon-bieu-mau.component.scss',
})
export class ChonBieuMauComponent implements OnInit, OnDestroy {

  private api    = inject(PlanningApiService);
  private router = inject(Router);

  // === State ===
  danhSach       = signal<FormTemplateListItem[]>([]);
  dangTai        = signal(false);
  tuKhoa         = '';
  boLoc: 'all' | 'active' | 'inactive' = 'all';
  viewMode: 'grid' | 'table' = 'grid';
  thongBao       = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

  private sub?: Subscription;
  private timerTK: any;

  // === Computed ===
  danhSachHienThi = computed(() => {
    let ds = this.danhSach();

    if (this.boLoc === 'active') {
      ds = ds.filter(bm => bm.isActive !== false);
    } else if (this.boLoc === 'inactive') {
      ds = ds.filter(bm => bm.isActive === false);
    }

    const tk = this.tuKhoa?.trim().toLowerCase();
    if (tk) {
      ds = ds.filter(bm =>
        bm.formCode.toLowerCase().includes(tk) ||
        bm.formName.toLowerCase().includes(tk) ||
        (bm.description || '').toLowerCase().includes(tk)
      );
    }
    return ds;
  });

  soHoatDong = computed(() =>
    this.danhSach().filter(bm => bm.isActive !== false).length
  );

  ngOnInit(): void {
    this.taiDuLieu();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.timerTK);
  }

  taiDuLieu(): void {
    this.dangTai.set(true);
    this.sub?.unsubscribe();

    this.sub = this.api.getFormTemplateList().subscribe({
      next: (items) => {
        this.danhSach.set(items);
        this.dangTai.set(false);
      },
      error: () => {
        this.hienThongBao('Không thể tải danh sách biểu mẫu', 'error');
        this.dangTai.set(false);
      },
    });
  }

  onTimKiem(): void {
    clearTimeout(this.timerTK);
    this.timerTK = setTimeout(() => {}, 0); // trigger computed re-eval via signal
  }

  chonBieuMau(formCode: string): void {
    const bm = this.danhSach().find(x => x.formCode === formCode);
    this.router.navigate(
      ['/app/data-entry/planning', formCode],
      { state: { formName: bm?.formName, periodType: bm?.periodType } },
    );
  }

  // === UI Helpers ===
  getCardAccent(index: number): string {
    const accents = [
      'linear-gradient(135deg, #3B82F6, #1D4ED8)',
      'linear-gradient(135deg, #8B5CF6, #7C3AED)',
      'linear-gradient(135deg, #06B6D4, #0891B2)',
      'linear-gradient(135deg, #10B981, #059669)',
      'linear-gradient(135deg, #F59E0B, #D97706)',
      'linear-gradient(135deg, #EF4444, #DC2626)',
      'linear-gradient(135deg, #EC4899, #DB2777)',
      'linear-gradient(135deg, #6366F1, #4F46E5)',
    ];
    return accents[index % accents.length];
  }

  getFormIcon(formName: string): string {
    const name = (formName || '').toLowerCase();
    if (name.includes('tài chính') || name.includes('tai chinh')) return 'pi-wallet';
    if (name.includes('sản xuất') || name.includes('san xuat')) return 'pi-cog';
    if (name.includes('kinh doanh') || name.includes('kd')) return 'pi-chart-bar';
    if (name.includes('báo cáo') || name.includes('bao cao')) return 'pi-file';
    if (name.includes('kế hoạch') || name.includes('ke hoach')) return 'pi-calendar';
    return 'pi-file-edit';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'Chưa cập nhật';
    if (dateStr.startsWith('0001-01-01') || dateStr.startsWith('1970-01-01')) return 'Chưa cập nhật';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Chưa cập nhật';
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return 'Chưa cập nhật';
    }
  }

  private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 4000);
  }
}
