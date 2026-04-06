// ============================================
// Page: Danh sÃ¡ch há»“ sÆ¡ Ä‘Ã£ ná»™p (Submission List)
// ============================================
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

    danhSach = signal<HoSoNop[]>([]);
    dangTai = signal(false);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    // Bá»™ lá»c
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
            this.hienThongBao('KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch', 'error');
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
            this.hienThongBao('Lá»—i khi ná»™p há»“ sÆ¡', 'error');
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
            this.hienThongBao('Lá»—i khi rÃºt há»“ sÆ¡', 'error');
        }
    }

    tenTrangThai(tt: string): string {
        const map: Record<string, string> = {
            nhap: 'NhÃ¡p', cho_duyet: 'Chá» duyá»‡t', da_duyet: 'ÄÃ£ duyá»‡t',
            tu_choi: 'Tá»« chá»‘i', tra_lai: 'Tráº£ láº¡i',
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
