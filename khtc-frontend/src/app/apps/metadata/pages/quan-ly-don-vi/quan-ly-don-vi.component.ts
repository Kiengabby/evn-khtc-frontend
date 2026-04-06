// ============================================
// Page: Quáº£n lÃ½ ÄÆ¡n vá»‹ (Entity Management)
// ============================================
// Hiá»ƒn thá»‹ báº£ng danh sÃ¡ch Ä‘Æ¡n vá»‹ thÃ nh viÃªn EVN.
// Chá»©c nÄƒng: TÃ¬m kiáº¿m, thÃªm/sá»­a/xÃ³a, hiá»ƒn thá»‹ cÃ¢y tá»• chá»©c.
//
// === LUá»’NG Dá»® LIá»†U ===
// Component â†’ MockApiService â†’ KetQuaApi<DonVi[]>
// ============================================

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DonVi, CapDonVi, DonViTaoMoi } from '../../../../config/models/don-vi.model';
import { DonViService } from '../../../service/don-vi.service';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './quan-ly-don-vi.component.html',
    styleUrl: './quan-ly-don-vi.component.scss',
})
export class QuanLyDonViComponent implements OnInit {

    private donViService = inject(DonViService);

    // === State ===
    danhSach = signal<DonVi[]>([]);
    dangTai = signal(false);
    hienDialog = signal(false);
    dangSua = signal(false);
    dangLuu = signal(false);
    loiForm = signal<string | null>(null);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    tuKhoa = '';
    locCapDonVi = '';
    form: any = this.formMacDinh();
    private idDangSua: number | null = null;
    private timerTimKiem: any;

    // ============================================
    // LIFECYCLE
    // ============================================

    async ngOnInit(): Promise<void> {
        await this.taiDuLieu();
    }

    // ============================================
    // LOAD Dá»® LIá»†U
    // ============================================

    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const kq = await this.donViService.layDanhSach({
                tuKhoa: this.tuKhoa || undefined,
                capDonVi: this.locCapDonVi || undefined,
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

    // ============================================
    // THÃŠM / Sá»¬A
    // ============================================

    moFormThemMoi(): void {
        this.form = this.formMacDinh();
        this.idDangSua = null;
        this.dangSua.set(false);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    moFormSua(dv: DonVi): void {
        this.form = { ...dv };
        this.idDangSua = dv.id;
        this.dangSua.set(true);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    async luuDonVi(): Promise<void> {
        if (!this.form.maDonVi?.trim()) { this.loiForm.set('Vui lÃ²ng nháº­p mÃ£ Ä‘Æ¡n vá»‹'); return; }
        if (!this.form.tenDonVi?.trim()) { this.loiForm.set('Vui lÃ²ng nháº­p tÃªn Ä‘Æ¡n vá»‹'); return; }
        if (!this.form.tenVietTat?.trim()) { this.loiForm.set('Vui lÃ²ng nháº­p tÃªn viáº¿t táº¯t'); return; }

        this.dangLuu.set(true);

        try {
            if (this.dangSua() && this.idDangSua) {
                const kq = await this.donViService.capNhat(this.idDangSua, this.form);
                if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
                this.hienThongBao(kq.thongBao, 'success');
            } else {
                const kq = await this.donViService.taoMoi(this.form as DonViTaoMoi);
                if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
                this.hienThongBao(kq.thongBao, 'success');
            }
            await this.taiDuLieu();
            this.dongDialog();
        } catch (err) {
            this.loiForm.set('ÄÃ£ xáº£y ra lá»—i há»‡ thá»‘ng');
        }
        this.dangLuu.set(false);
    }

    // ============================================
    // XÃ“A
    // ============================================

    async xacNhanXoa(dv: DonVi): Promise<void> {
        if (!confirm(`XÃ³a Ä‘Æ¡n vá»‹ "${dv.tenVietTat}"?`)) return;

        const kq = await this.donViService.xoa(dv.id);
        if (kq.trangThai) {
            this.hienThongBao(kq.thongBao, 'success');
            await this.taiDuLieu();
        } else {
            this.hienThongBao(kq.thongBao, 'error');
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    dongDialog(): void { this.hienDialog.set(false); this.loiForm.set(null); }

    tenCapDonVi(cap: CapDonVi): string {
        const map: Record<CapDonVi, string> = {
            'TAP_DOAN': 'Táº­p Ä‘oÃ n',
            'TONG_CONG_TY': 'Tá»•ng cÃ´ng ty',
            'CONG_TY': 'CÃ´ng ty',
            'CHI_NHANH': 'Chi nhÃ¡nh',
            'DIEN_LUC': 'Äiá»‡n lá»±c',
        };
        return map[cap] || cap;
    }

    private formMacDinh() {
        return {
            maDonVi: '', tenDonVi: '', tenVietTat: '',
            capDonVi: 'CONG_TY' as CapDonVi,
            maDonViCha: null as string | null,
            diaChi: '',
        };
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3000);
    }
}
