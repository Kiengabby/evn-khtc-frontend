// ============================================
// Page: Quản lý Phiên bản (Version Management)
// ============================================
// HiỒn th�9 danh sách phiên bản kế hoạch: Budget, Forecast, Actual.
// Cho phép: thêm/sửa/xóa, khóa/m�x phiên bản, �ặt mặc ��9nh.
//
// === API (cho BE tham khảo) ===
// GET  /api/danh-muc/phien-ban       �  KetQuaApi<PhienBan[]>
// POST /api/danh-muc/phien-ban       �  KetQuaApi<PhienBan>
// PUT  /api/danh-muc/phien-ban/:id   �  KetQuaApi<PhienBan>
// DELETE /api/danh-muc/phien-ban/:id �  KetQuaApi<null>
// ============================================

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhienBan, LoaiPhienBan, PhienBanTaoMoi } from '../../../../config/models/phien-ban.model';
import { PhienBanService } from '../../../service/phien-ban.service';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './quan-ly-phien-ban.component.html',
    styleUrl: './quan-ly-phien-ban.component.scss',
})
export class QuanLyPhienBanComponent implements OnInit {

    private phienBanService = inject(PhienBanService);

    // === State ===
    danhSach = signal<PhienBan[]>([]);
    dangTai = signal(false);
    hienDialog = signal(false);
    dangSua = signal(false);
    dangLuu = signal(false);
    loiForm = signal<string | null>(null);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    tuKhoa = '';
    locLoai = '';
    form: any = this.formMacDinh();
    private idDangSua: number | null = null;
    private timerTimKiem: any;

    async ngOnInit(): Promise<void> { await this.taiDuLieu(); }

    // === LOAD ===
    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const kq = await this.phienBanService.layDanhSach({
                tuKhoa: this.tuKhoa || undefined,
                loaiPhienBan: this.locLoai || undefined,
            });
            if (kq.trangThai) {
                this.danhSach.set(kq.duLieu);
            }
        } catch {
            this.danhSach.set([]);
        }
        this.dangTai.set(false);
    }

    onTimKiem(): void {
        clearTimeout(this.timerTimKiem);
        this.timerTimKiem = setTimeout(() => this.taiDuLieu(), 300);
    }

    // === TH�`M / SỬA ===
    moFormThemMoi(): void {
        this.form = this.formMacDinh();
        this.idDangSua = null;
        this.dangSua.set(false);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    moFormSua(pb: PhienBan): void {
        this.form = { ...pb };
        this.idDangSua = pb.id;
        this.dangSua.set(true);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    async luuPhienBan(): Promise<void> {
        if (!this.form.maPhienBan?.trim()) { this.loiForm.set('Vui lòng nhập mã phiên bản'); return; }
        if (!this.form.tenPhienBan?.trim()) { this.loiForm.set('Vui lòng nhập tên phiên bản'); return; }

        this.dangLuu.set(true);

        try {
            if (this.dangSua() && this.idDangSua) {
                const kq = await this.phienBanService.capNhat(this.idDangSua, this.form);
                if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
                this.hienThongBao(kq.thongBao, 'success');
            } else {
                const kq = await this.phienBanService.taoMoi(this.form as PhienBanTaoMoi);
                if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
                this.hienThongBao(kq.thongBao, 'success');
            }
            await this.taiDuLieu();
            this.dongDialog();
        } catch {
            this.loiForm.set('Đã xảy ra l�i h�! th�ng');
        }
        this.dangLuu.set(false);
    }

    // === KH�A / M�~ ===
    async toggleKhoa(pb: PhienBan): Promise<void> {
        const kq = await this.phienBanService.khoaMo(pb.id);
        if (kq.trangThai) {
            this.hienThongBao(kq.thongBao, 'success');
            await this.taiDuLieu();
        } else {
            this.hienThongBao(kq.thongBao, 'error');
        }
    }

    // === X�A ===
    async xacNhanXoa(pb: PhienBan): Promise<void> {
        if (!confirm(`Xóa phiên bản "${pb.tenPhienBan}"?`)) return;

        const kq = await this.phienBanService.xoa(pb.id);
        if (kq.trangThai) {
            this.hienThongBao(kq.thongBao, 'success');
            await this.taiDuLieu();
        } else {
            this.hienThongBao(kq.thongBao, 'error');
        }
    }

    // === HELPERS ===
    dongDialog(): void { this.hienDialog.set(false); this.loiForm.set(null); }

    tenLoai(loai: LoaiPhienBan): string {
        return { 'KE_HOACH': 'Kế hoạch', 'DU_BAO': 'Dự báo', 'THUC_HIEN': 'Thực hi�!n' }[loai] || loai;
    }

    private formMacDinh() {
        return {
            maPhienBan: '', tenPhienBan: '',
            loaiPhienBan: 'KE_HOACH' as LoaiPhienBan,
            namKeHoach: new Date().getFullYear(),
            ghiChu: '',
        };
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3000);
    }
}
