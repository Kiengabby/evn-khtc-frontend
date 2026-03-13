// ============================================
// Page: Danh sách hồ sơ đã nộp (Submission List)
// ============================================
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../services/workflow.service';
import { HoSoNop, TrangThaiHoSo } from '../../../../core/models/workflow.model';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './danh-sach-ho-so.component.html',
    styleUrl: './danh-sach-ho-so.component.scss',
})
export class DanhSachHoSoComponent implements OnInit {
    private workflowService = inject(WorkflowService);

    danhSach = signal<HoSoNop[]>([]);
    dangTai = signal(false);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    // Bộ lọc
    tuKhoa = '';
    trangThaiLoc: TrangThaiHoSo | '' = '';

    async ngOnInit(): Promise<void> {
        await this.taiDuLieu();
    }

    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const boLoc: any = {};
            if (this.tuKhoa.trim()) boLoc.tuKhoa = this.tuKhoa.trim();
            if (this.trangThaiLoc) boLoc.trangThai = this.trangThaiLoc;

            const kq = await this.workflowService.layDanhSachHoSo(boLoc);
            if (kq.trangThai) this.danhSach.set(kq.duLieu);
        } catch {
            this.hienThongBao('Không tải được danh sách', 'error');
        }
        this.dangTai.set(false);
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

    tenTrangThai(tt: string): string {
        const map: Record<string, string> = {
            nhap: 'Nháp', cho_duyet: 'Chờ duyệt', da_duyet: 'Đã duyệt',
            tu_choi: 'Từ chối', tra_lai: 'Trả lại',
        };
        return map[tt] || tt;
    }

    classTrangThai(tt: string): string {
        const map: Record<string, string> = {
            nhap: 'draft', cho_duyet: 'warning', da_duyet: 'success',
            tu_choi: 'error', tra_lai: 'warning',
        };
        return map[tt] || 'info';
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3000);
    }
}
