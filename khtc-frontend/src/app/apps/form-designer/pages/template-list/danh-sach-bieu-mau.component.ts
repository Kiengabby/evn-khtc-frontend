// ============================================
// Page: Quáº£n lÃ½ Biá»ƒu máº«u (Template List) â€” Redesigned
// ============================================
// Hiá»ƒn thá»‹ danh sÃ¡ch form template tá»« API tháº­t vá»›i giao diá»‡n enterprise.
//
// === LUá»’NG Dá»® LIá»†U ===
// Component â†’ FormConfigApiService â†’ GET /api/v2/FormTemplate/get-list
// ============================================

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FormConfigApiService } from '../../../service/form-config-api.service';

/** Item hiá»ƒn thá»‹ trÃªn UI â€” map tá»« API response */
export interface FormTemplateItem {
    id: number;
    formCode: string;
    formName: string;
    description?: string;
    isActive?: boolean;
    createdAt?: string;
    currentVersion?: string | null;
    applyYear?: number | null;
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './danh-sach-bieu-mau.component.html',
    styleUrl: './danh-sach-bieu-mau.component.scss',
})
export class DanhSachBieuMauComponent implements OnInit, OnDestroy {

    private formConfigApi = inject(FormConfigApiService);
    private router = inject(Router);

    // === State ===
    danhSach = signal<FormTemplateItem[]>([]);
    danhSachHienThi = signal<FormTemplateItem[]>([]);
    dangTai = signal(false);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    tuKhoa = '';
    boLoc: 'all' | 'active' | 'inactive' = 'all';
    viewMode: 'grid' | 'table' = 'grid';

    private timerTimKiem: any;
    private sub?: Subscription;

    // === Computed ===
    soLuongActive = computed(() =>
        this.danhSach().filter(bm => bm.isActive !== false).length
    );

    ngOnInit(): void {
        this.taiDuLieu();
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
        clearTimeout(this.timerTimKiem);
    }

    // === LOAD ===
    taiDuLieu(): void {
        this.dangTai.set(true);
        this.sub?.unsubscribe();

        this.sub = this.formConfigApi.getFormTemplateList().subscribe({
            next: (items) => {
                console.log('[DanhSachBieuMau] âœ… Loaded', items.length, 'templates from API');
                this.danhSach.set(items);
                this.locDanhSach();
                this.dangTai.set(false);
            },
            error: (err) => {
                console.error('[DanhSachBieuMau] âŒ API error:', err);
                this.danhSach.set([]);
                this.danhSachHienThi.set([]);
                this.dangTai.set(false);
                this.hienThongBao('KhÃ´ng thá»ƒ táº£i danh sÃ¡ch biá»ƒu máº«u tá»« server', 'error');
            },
        });
    }

    onTimKiem(): void {
        clearTimeout(this.timerTimKiem);
        this.timerTimKiem = setTimeout(() => this.locDanhSach(), 300);
    }

    /** Lá»c danh sÃ¡ch theo tá»« khÃ³a + bá»™ lá»c tráº¡ng thÃ¡i */
    locDanhSach(): void {
        let ds = this.danhSach();

        // Lá»c theo tráº¡ng thÃ¡i
        if (this.boLoc === 'active') {
            ds = ds.filter(bm => bm.isActive !== false);
        } else if (this.boLoc === 'inactive') {
            ds = ds.filter(bm => bm.isActive === false);
        }

        // Lá»c theo tá»« khÃ³a
        if (this.tuKhoa?.trim()) {
            const tk = this.tuKhoa.toLowerCase();
            ds = ds.filter(bm =>
                bm.formCode.toLowerCase().includes(tk) ||
                bm.formName.toLowerCase().includes(tk) ||
                (bm.description || '').toLowerCase().includes(tk)
            );
        }

        this.danhSachHienThi.set(ds);
    }

    // === NAVIGATION ===
    moThietKe(formCode: string): void {
        this.router.navigate(['/app/form-designer/builder', formCode]);
    }

    moThietKeMoi(): void {
        this.router.navigate(['/app/form-designer/builder']);
    }

    // === UI HELPERS ===

    /** Accent gradient cho icon card dá»±a trÃªn index */
    getCardAccent(index: number): string {
        const accents = [
            'linear-gradient(135deg, #3B82F6, #1D4ED8)',   // Blue
            'linear-gradient(135deg, #8B5CF6, #7C3AED)',   // Violet
            'linear-gradient(135deg, #06B6D4, #0891B2)',   // Cyan
            'linear-gradient(135deg, #10B981, #059669)',   // Emerald
            'linear-gradient(135deg, #F59E0B, #D97706)',   // Amber
            'linear-gradient(135deg, #EF4444, #DC2626)',   // Red
            'linear-gradient(135deg, #EC4899, #DB2777)',   // Pink
            'linear-gradient(135deg, #6366F1, #4F46E5)',   // Indigo
        ];
        return accents[index % accents.length];
    }

    /** Icon dá»±a trÃªn tÃªn biá»ƒu máº«u */
    getFormIcon(formName: string): string {
        const name = (formName || '').toLowerCase();
        if (name.includes('tÃ i chÃ­nh') || name.includes('tai chinh')) return 'pi-wallet';
        if (name.includes('sáº£n xuáº¥t') || name.includes('san xuat')) return 'pi-cog';
        if (name.includes('kinh doanh') || name.includes('kd')) return 'pi-chart-bar';
        if (name.includes('bÃ¡o cÃ¡o') || name.includes('bao cao')) return 'pi-file';
        if (name.includes('káº¿ hoáº¡ch') || name.includes('ke hoach')) return 'pi-calendar';
        return 'pi-file-edit';
    }

    /** Format date string */
    formatDate(dateStr?: string): string {
        if (!dateStr) return 'ChÆ°a cáº­p nháº­t';
        // Kiá»ƒm tra date máº·c Ä‘á»‹nh tá»« .NET (0001-01-01)
        if (dateStr.startsWith('0001-01-01') || dateStr.startsWith('1970-01-01')) {
            return 'ChÆ°a cáº­p nháº­t';
        }
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'ChÆ°a cáº­p nháº­t';
            return d.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return 'ChÆ°a cáº­p nháº­t';
        }
    }

    // === HELPERS ===
    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 4000);
    }
}
