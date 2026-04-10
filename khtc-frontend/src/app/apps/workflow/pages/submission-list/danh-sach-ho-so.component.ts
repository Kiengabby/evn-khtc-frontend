// ============================================
// Page: Danh sách hồ sơ đã nộp (Submission List)
// ============================================
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkflowService } from '../../../service/workflow.service';
import { HoSoNop, TrangThaiHoSo } from '../../../../config/models/workflow.model';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './danh-sach-ho-so.component.html',
    styleUrl: './danh-sach-ho-so.component.scss',
})
export class DanhSachHoSoComponent implements OnInit {
    private workflowService = inject(WorkflowService);
    private router = inject(Router);

    // State
    danhSach = signal<HoSoNop[]>([]);
    danhSachHienThi = signal<HoSoNop[]>([]);
    dangTai = signal(false);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    // Filter
    tuKhoa = '';
    trangThaiLoc: TrangThaiHoSo | '' = '';
    boLocDonVi = '';  // Filter by entityCode (mã danh mục)

    // Computed: danh sách các đơn vị (entityCode) có sẵn
    danhSachDonVi = computed(() => {
        const donVi = new Set<string>();
        this.danhSach().forEach(hs => {
            if (hs.entityCode) {
                donVi.add(hs.entityCode);
            }
        });
        return Array.from(donVi).sort();
    });

    ngOnInit(): void {
        this.taiDuLieu();
    }

    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const boLoc: any = {};
            if (this.tuKhoa.trim()) boLoc.tuKhoa = this.tuKhoa.trim();
            if (this.trangThaiLoc) boLoc.trangThai = this.trangThaiLoc;
            if (this.boLocDonVi) boLoc.maDonVi = this.boLocDonVi;

            const kq = await this.workflowService.layDanhSachHoSo(boLoc);
            if (kq.trangThai) {
                this.danhSach.set(kq.duLieu);
                this.locDanhSach();
            }
        } catch {
            this.hienThongBao('Không tải được danh sách', 'error');
        }
        this.dangTai.set(false);
    }

    locDanhSach(): void {
        let ds = this.danhSach();

        // Filter by trạng thái
        if (this.trangThaiLoc) {
            ds = ds.filter(hs => hs.trangThai === this.trangThaiLoc);
        }

        // Filter by mã danh mục (entityCode)
        if (this.boLocDonVi?.trim()) {
            ds = ds.filter(hs => hs.entityCode === this.boLocDonVi);
        }

        // Filter by từ khóa
        if (this.tuKhoa?.trim()) {
            const tk = this.tuKhoa.toLowerCase();
            ds = ds.filter(hs =>
                hs.maHoSo.toLowerCase().includes(tk) ||
                hs.tieuDe.toLowerCase().includes(tk) ||
                hs.entityCode?.toLowerCase().includes(tk) ||
                hs.entityName?.toLowerCase().includes(tk) ||
                hs.formCode?.toLowerCase().includes(tk) ||
                hs.formName?.toLowerCase().includes(tk)
            );
        }

        this.danhSachHienThi.set(ds);
    }

    async nopHoSo(hoSo: HoSoNop): Promise<void> {
        try {
            const kq = await this.workflowService.nopHoSo(hoSo.id);
            if (kq.trangThai) {
                this.hienThongBao(kq.thongBao, 'success');
                await this.taiDuLieu();
            } else {
                this.hienThongBao(kq.thongBao, 'error');
            }
        } catch {
            this.hienThongBao('Lỗi khi nộp hồ sơ', 'error');
        }
    }

    async rutHoSo(hoSo: HoSoNop): Promise<void> {
        try {
            const kq = await this.workflowService.rutHoSo(hoSo.id);
            if (kq.trangThai) {
                this.hienThongBao(kq.thongBao, 'success');
                await this.taiDuLieu();
            } else {
                this.hienThongBao(kq.thongBao, 'error');
            }
        } catch {
            this.hienThongBao('Lỗi khi rút hồ sơ', 'error');
        }
    }

    editHoSo(hoSo: HoSoNop): void {
        // Navigate đến trang planning data entry với submissionId (UUID)
        this.router.navigate(['/app/data-entry/planning'], {
            queryParams: {
                submissionId: hoSo.submissionId,  // ✅ Dùng UUID gốc, không phải id (number)
                formCode: hoSo.formCode,
                entityCode: hoSo.entityCode,
                period: hoSo.period,
                year: hoSo.year,
            },
        });
    }

    tenTrangThai(tt: string): string {
        const map: Record<string, string> = {
            nhap: 'Nháp',
            cho_duyet: 'Chờ duyệt',
            da_duyet: 'Đã duyệt',
            tu_choi: 'Từ chối',
            tra_lai: 'Trả lại',
        };
        return map[tt] || tt;
    }

    classTrangThai(tt: string): string {
        const map: Record<string, string> = {
            nhap: 'draft',
            cho_duyet: 'warning',
            da_duyet: 'success',
            tu_choi: 'error',
            tra_lai: 'warning',
        };
        return map[tt] || 'info';
    }

    formatDate(dateStr?: string): string {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return '—';
        }
    }

    formatPeriod(period?: string, year?: number): string {
        if (!period && !year) return '—';
        if (period && year) return `${period}/${year}`;
        if (year) return `Năm ${year}`;
        return period || '—';
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3000);
    }
}
