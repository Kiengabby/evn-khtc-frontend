// ============================================
// Page: Quản lý Chỉ tiêu (Account Management)
// ============================================
// Trang này hiển thị danh sách chỉ tiêu tài chính dưới dạng DataTable.
// Chức năng: Tìm kiếm, lọc, thêm mới, sửa, xóa, phân trang.
//
// === LUỒNG DỮ LIỆU ===
// 1. Component gọi ChiTieuService.layDanhSach(boLoc)
// 2. Service gọi MockApiService (hoặc API thật)
// 3. Kết quả trả về KetQuaApi<ChiTieu[]>
// 4. Component hiển thị vào DataTable
// ============================================

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChiTieuService } from '../../services/chi-tieu.service';
import {
  ChiTieu,
  ChiTieuTaoMoi,
  ChiTieuBoLoc,
  LoaiLuuTru,
  PhuongThucTongHop,
} from '../../../../core/models/chi-tieu.model';

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
  // LOAD DỮ LIỆU
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
  // TÌM KIẾM
  // ============================================

  onTimKiem(): void {
    clearTimeout(this.timerTimKiem);
    this.timerTimKiem = setTimeout(() => this.taiDuLieu(), 300);
  }

  // ============================================
  // THÊM / SỬA
  // ============================================

  /** Mở dialog thêm mới */
  moFormThemMoi(): void {
    this.form = this.formMacDinh();
    this.idDangSua = null;
    this.dangSua.set(false);
    this.loiForm.set(null);
    this.hienDialog.set(true);
  }

  /** Mở dialog sửa */
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

  /** Lưu (tạo mới hoặc cập nhật) */
  async luuChiTieu(): Promise<void> {
    if (!this.form.maChiTieu?.trim()) { this.loiForm.set('Vui lòng nhập mã chỉ tiêu'); return; }
    if (!this.form.tenChiTieu?.trim()) { this.loiForm.set('Vui lòng nhập tên chỉ tiêu'); return; }

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
      this.loiForm.set('Đã xảy ra lỗi hệ thống');
    }
    this.dangLuu.set(false);
  }

  // ============================================
  // XÓA
  // ============================================

  async xacNhanXoa(ct: ChiTieu): Promise<void> {
    if (!confirm(`Bạn có chắc muốn xóa chỉ tiêu "${ct.tenChiTieu}"?`)) return;

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

  /** Tên tiếng Việt cho loại lưu trữ */
  tenLoaiLuuTru(loai: LoaiLuuTru): string {
    const map: Record<LoaiLuuTru, string> = {
      'STORE': 'Lưu trữ',
      'DYNAMIC_CALC': 'Tính toán',
      'LABEL_ONLY': 'Nhãn',
    };
    return map[loai] || loai;
  }

  /** Form mặc định khi thêm mới */
  private formMacDinh() {
    return {
      maChiTieu: '',
      tenChiTieu: '',
      maChiTieuCha: null as string | null,
      loaiLuuTru: 'STORE' as LoaiLuuTru,
      phuongThucTongHop: 'SUM' as PhuongThucTongHop,
      donViTinh: 'Tỷ đồng',
      congThuc: '',
      ghiChu: '',
    };
  }

  /** Hiển thị toast thông báo (tự ẩn sau 3 giây) */
  private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }
}
