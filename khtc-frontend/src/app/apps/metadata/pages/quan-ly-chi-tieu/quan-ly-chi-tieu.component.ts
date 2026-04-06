// ============================================
// Page: Quáº£n lÃ½ Chá»‰ tiÃªu (Account Management)
// ============================================
// Trang nÃ y hiá»ƒn thá»‹ danh sÃ¡ch chá»‰ tiÃªu tÃ i chÃ­nh dÆ°á»›i dáº¡ng DataTable.
// Chá»©c nÄƒng: TÃ¬m kiáº¿m, lá»c, thÃªm má»›i, sá»­a, xÃ³a, phÃ¢n trang.
//
// === LUá»’NG Dá»® LIá»†U ===
// 1. Component gá»i ChiTieuService.layDanhSach(boLoc)
// 2. Service gá»i MockApiService (hoáº·c API tháº­t)
// 3. Káº¿t quáº£ tráº£ vá» KetQuaApi<ChiTieu[]>
// 4. Component hiá»ƒn thá»‹ vÃ o DataTable
// ============================================

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChiTieuService } from '../../../service/chi-tieu.service';
import {
  ChiTieu,
  ChiTieuTaoMoi,
  ChiTieuBoLoc,
  LoaiLuuTru,
  PhuongThucTongHop,
} from '../../../../config/models/chi-tieu.model';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quan-ly-chi-tieu.component.html',
    styleUrl: './quan-ly-chi-tieu.component.scss',
})
export class QuanLyChiTieuComponent implements OnInit {

  private chiTieuService = inject(ChiTieuService);

  // === State ===
  danhSach = signal<ChiTieu[]>([]);
  tongSoBanGhi = signal(0);
  dangTai = signal(false);
  hienDialog = signal(false);
  dangSua = signal(false);
  dangLuu = signal(false);
  loiForm = signal<string | null>(null);
  thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);
  chiTietDangXem = signal<ChiTieu | null>(null);

  tuKhoa = '';
  locLoaiLuuTru = '';
  form: any = this.formMacDinh();
  private idDangSua: number | null = null;
  private timerTimKiem: any;

  // ============================================
  // LIFECYCLE
  // ============================================

  async ngOnInit(): Promise<void> { await this.taiDuLieu(); }

  // ============================================
  // LOAD Dá»® LIá»†U
  // ============================================

  async taiDuLieu(): Promise<void> {
    this.dangTai.set(true);
    try {
      const kq = await this.chiTieuService.layDanhSach({
        tuKhoa: this.tuKhoa || undefined,
        loaiLuuTru: (this.locLoaiLuuTru as LoaiLuuTru) || undefined,
        trang: 1,
        soBanGhi: 50,
      });
      if (kq.trangThai) {
        this.danhSach.set(kq.duLieu);
        this.tongSoBanGhi.set(kq.tongSoBanGhi || kq.duLieu.length);
      } else {
        this.hienThongBao(kq.thongBao, 'error');
      }
    } catch {
      this.danhSach.set([]);
    }
    this.dangTai.set(false);
  }

  // ============================================
  // TÃŒM KIáº¾M
  // ============================================

  onTimKiem(): void {
    clearTimeout(this.timerTimKiem);
    this.timerTimKiem = setTimeout(() => this.taiDuLieu(), 300);
  }

  // ============================================
  // THÃŠM / Sá»¬A
  // ============================================

  /** Má»Ÿ dialog thÃªm má»›i */
  moFormThemMoi(): void {
    this.form = this.formMacDinh();
    this.idDangSua = null;
    this.dangSua.set(false);
    this.loiForm.set(null);
    this.hienDialog.set(true);
  }

  /** Má»Ÿ dialog sá»­a */
  moFormSua(ct: ChiTieu): void {
    this.form = {
      maChiTieu: ct.maChiTieu,
      tenChiTieu: ct.tenChiTieu,
      maChiTieuCha: ct.maChiTieuCha,
      loaiLuuTru: ct.loaiLuuTru,
      phuongThucTongHop: ct.phuongThucTongHop,
      donViTinh: ct.donViTinh,
      congThuc: ct.congThuc || '',
      ghiChu: ct.ghiChu || '',
    };
    this.idDangSua = ct.id;
    this.dangSua.set(true);
    this.loiForm.set(null);
    this.hienDialog.set(true);
  }

  /** LÆ°u (táº¡o má»›i hoáº·c cáº­p nháº­t) */
  async luuChiTieu(): Promise<void> {
    if (!this.form.maChiTieu?.trim()) { this.loiForm.set('Vui lÃ²ng nháº­p mÃ£ chá»‰ tiÃªu'); return; }
    if (!this.form.tenChiTieu?.trim()) { this.loiForm.set('Vui lÃ²ng nháº­p tÃªn chá»‰ tiÃªu'); return; }

    this.dangLuu.set(true);

    try {
      if (this.dangSua() && this.idDangSua) {
        const kq = await this.chiTieuService.capNhat({ id: this.idDangSua, ...this.form });
        if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
        this.hienThongBao(kq.thongBao, 'success');
      } else {
        const kq = await this.chiTieuService.taoMoi(this.form as ChiTieuTaoMoi);
        if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
        this.hienThongBao(kq.thongBao, 'success');
      }
      await this.taiDuLieu();
      this.dongDialog();
    } catch {
      this.loiForm.set('ÄÃ£ xáº£y ra lá»—i há»‡ thá»‘ng');
    }
    this.dangLuu.set(false);
  }

  // ============================================
  // XÃ“A
  // ============================================

  async xacNhanXoa(ct: ChiTieu): Promise<void> {
    if (!confirm(`Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a chá»‰ tiÃªu "${ct.tenChiTieu}"?`)) return;

    const kq = await this.chiTieuService.xoa(ct.id);
    if (kq.trangThai) {
      this.hienThongBao(kq.thongBao, 'success');
      await this.taiDuLieu();
    } else {
      this.hienThongBao(kq.thongBao, 'error');
    }
  }

  // ============================================
  // XEM CHI TIáº¾T
  // ============================================

  xemChiTiet(ct: ChiTieu): void {
    this.chiTietDangXem.set(ct);
  }

  dongChiTiet(): void {
    this.chiTietDangXem.set(null);
  }

  // ============================================
  // HELPERS
  // ============================================

  dongDialog(): void { this.hienDialog.set(false); this.loiForm.set(null); }

  /** TÃªn tiáº¿ng Viá»‡t cho loáº¡i lÆ°u trá»¯ */
  tenLoaiLuuTru(loai: LoaiLuuTru): string {
    const map: Record<LoaiLuuTru, string> = {
      'STORE': 'LÆ°u trá»¯',
      'DYNAMIC_CALC': 'TÃ­nh toÃ¡n',
      'LABEL_ONLY': 'NhÃ£n',
    };
    return map[loai] || loai;
  }

  /** Form máº·c Ä‘á»‹nh khi thÃªm má»›i */
  private formMacDinh() {
    return {
      maChiTieu: '',
      tenChiTieu: '',
      maChiTieuCha: null as string | null,
      loaiLuuTru: 'STORE' as LoaiLuuTru,
      phuongThucTongHop: 'SUM' as PhuongThucTongHop,
      donViTinh: 'Tá»· Ä‘á»“ng',
      congThuc: '',
      ghiChu: '',
    };
  }

  /** Hiá»ƒn thá»‹ toast thÃ´ng bÃ¡o (tá»± áº©n sau 3 giÃ¢y) */
  private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }
}
