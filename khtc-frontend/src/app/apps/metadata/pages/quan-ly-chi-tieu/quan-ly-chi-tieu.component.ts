// ============================================
// Page: Quản lý Ch�0 tiêu (Account Management)
// ============================================
// Trang này hiỒn th�9 danh sách ch�0 tiêu tài chính dư�:i dạng DataTable.
// Chức nĒng: Tìm kiếm, lọc, thêm m�:i, sửa, xóa, phân trang.
//
// === LU�NG DỮ LI� U ===
// 1. Component gọi ChiTieuService.layDanhSach(boLoc)
// 2. Service gọi MockApiService (hoặc API thật)
// 3. Kết quả trả về KetQuaApi<ChiTieu[]>
// 4. Component hiỒn th�9 vào DataTable
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
  // LOAD DỮ LI� U
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
  // T�RM KIẾM
  // ============================================

  onTimKiem(): void {
    clearTimeout(this.timerTimKiem);
    this.timerTimKiem = setTimeout(() => this.taiDuLieu(), 300);
  }

  // ============================================
  // TH�`M / SỬA
  // ============================================

  /** M�x dialog thêm m�:i */
  moFormThemMoi(): void {
    this.form = this.formMacDinh();
    this.idDangSua = null;
    this.dangSua.set(false);
    this.loiForm.set(null);
    this.hienDialog.set(true);
  }

  /** M�x dialog sửa */
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

  /** Lưu (tạo m�:i hoặc cập nhật) */
  async luuChiTieu(): Promise<void> {
    if (!this.form.maChiTieu?.trim()) { this.loiForm.set('Vui lòng nhập mã ch�0 tiêu'); return; }
    if (!this.form.tenChiTieu?.trim()) { this.loiForm.set('Vui lòng nhập tên ch�0 tiêu'); return; }

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
      this.loiForm.set('Đã xảy ra l�i h�! th�ng');
    }
    this.dangLuu.set(false);
  }

  // ============================================
  // X�A
  // ============================================

  async xacNhanXoa(ct: ChiTieu): Promise<void> {
    if (!confirm(`Bạn có chắc mu�n xóa ch�0 tiêu "${ct.tenChiTieu}"?`)) return;

    const kq = await this.chiTieuService.xoa(ct.id);
    if (kq.trangThai) {
      this.hienThongBao(kq.thongBao, 'success');
      await this.taiDuLieu();
    } else {
      this.hienThongBao(kq.thongBao, 'error');
    }
  }

  // ============================================
  // XEM CHI TIẾT
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

  /** Tên tiếng Vi�!t cho loại lưu trữ */
  tenLoaiLuuTru(loai: LoaiLuuTru): string {
    const map: Record<LoaiLuuTru, string> = {
      'STORE': 'Lưu trữ',
      'DYNAMIC_CALC': 'Tính toán',
      'LABEL_ONLY': 'Nhãn',
    };
    return map[loai] || loai;
  }

  /** Form mặc ��9nh khi thêm m�:i */
  private formMacDinh() {
    return {
      maChiTieu: '',
      tenChiTieu: '',
      maChiTieuCha: null as string | null,
      loaiLuuTru: 'STORE' as LoaiLuuTru,
      phuongThucTongHop: 'SUM' as PhuongThucTongHop,
      donViTinh: 'Tỷ ��ng',
      congThuc: '',
      ghiChu: '',
    };
  }

  /** HiỒn th�9 toast thông báo (tự ẩn sau 3 giây) */
  private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }
}
