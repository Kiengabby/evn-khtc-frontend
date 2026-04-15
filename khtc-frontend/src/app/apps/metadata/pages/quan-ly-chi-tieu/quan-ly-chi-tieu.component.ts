// ============================================
// Page: Quản lý Chỉ tiêu (DimAccount Management)
// ============================================
// Trang CRUD quản lý danh mục chỉ tiêu tài chính.
// Kết nối API thật: /api/v2/DimAccount/*
//
// === LUỒNG DỮ LIỆU ===
// 1. ngOnInit → taiDuLieu() → ChiTieuService.layDanhSach()
// 2. Service gọi DimAccountApiService.getFlatList() → flat list với depth
// 3. Component hiển thị vào DataTable (dạng cây thụt lề)
// ============================================

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChiTieuService } from '../../../service/chi-tieu.service';
import {
    ChiTieu,
    ChiTieuTaoMoi,
    ChiTieuCapNhat,
    ChiTieuBoLoc,
    LoaiLuuTru,
    AccountType,
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

    // Bộ lọc
    tuKhoa = '';
    locLoaiLuuTru = '';

    // Form
    form: ChiTieuTaoMoi = this.formMacDinh();
    protected idDangSua: string | null = null;
    private timerTimKiem: any;

    // ============================================
    // LIFECYCLE
    // ============================================

    async ngOnInit(): Promise<void> {
        await this.taiDuLieu();
    }

    // ============================================
    // LOAD DỮ LIỆU
    // ============================================

    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const boLoc: ChiTieuBoLoc = {
                tuKhoa: this.tuKhoa || undefined,
                loaiLuuTru: (this.locLoaiLuuTru as LoaiLuuTru) || undefined,
            };
            const kq = await this.chiTieuService.layDanhSach(boLoc);
            if (kq.trangThai) {
                this.danhSach.set(kq.duLieu);
                this.tongSoBanGhi.set(kq.tongSoBanGhi ?? kq.duLieu.length);
            } else {
                this.hienThongBao(kq.thongBao, 'error');
                this.danhSach.set([]);
            }
        } catch {
            this.danhSach.set([]);
            this.hienThongBao('Lỗi tải dữ liệu', 'error');
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
            idChiTieuCha: ct.idChiTieuCha,
            loaiTaiKhoan: ct.loaiTaiKhoan,
            loaiLuuTru: ct.loaiLuuTru,
            congThuc: ct.congThuc || '',
            donViTinh: ct.donViTinh,
            thuTu: ct.thuTu,
        };
        this.idDangSua = ct.id;
        this.dangSua.set(true);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    /** Lưu (tạo mới hoặc cập nhật) */
    async luuChiTieu(): Promise<void> {
        if (!this.form.maChiTieu?.trim()) {
            this.loiForm.set('Vui lòng nhập mã chỉ tiêu');
            return;
        }
        if (!this.form.tenChiTieu?.trim()) {
            this.loiForm.set('Vui lòng nhập tên chỉ tiêu');
            return;
        }

        this.dangLuu.set(true);
        try {
            if (this.dangSua() && this.idDangSua) {
                const dto: ChiTieuCapNhat = { id: this.idDangSua, ...this.form };
                const kq = await this.chiTieuService.capNhat(dto);
                if (!kq.trangThai) {
                    this.loiForm.set(kq.thongBao);
                    this.dangLuu.set(false);
                    return;
                }
                this.hienThongBao(kq.thongBao, 'success');
            } else {
                const kq = await this.chiTieuService.taoMoi(this.form);
                if (!kq.trangThai) {
                    this.loiForm.set(kq.thongBao);
                    this.dangLuu.set(false);
                    return;
                }
                this.hienThongBao('Tạo chỉ tiêu thành công', 'success');
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
        if (!confirm(`Bạn có chắc muốn xóa chỉ tiêu "${ct.tenChiTieu}"?\n\nHành động này không thể hoàn tác.`)) return;

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

    dongDialog(): void {
        this.hienDialog.set(false);
        this.loiForm.set(null);
    }

    /** Tên hiển thị cho loại lưu trữ */
    tenLoaiLuuTru(loai: LoaiLuuTru): string {
        const map: Record<LoaiLuuTru, string> = {
            'STORE': 'Lưu trữ',
            'DYNAMIC_CALC': 'Tính toán',
            'LABEL_ONLY': 'Nhãn',
        };
        return map[loai] ?? loai;
    }

    /** Tên hiển thị cho loại tài khoản */
    tenLoaiTaiKhoan(loai: AccountType): string {
        const map: Record<AccountType, string> = {
            0: 'Thường',
            1: 'Nhóm',
        };
        return map[loai] ?? String(loai);
    }

    /** Lấy tên chỉ tiêu cha để hiển thị */
    tenChiTieuCha(ct: ChiTieu): string {
        if (!ct.idChiTieuCha) return '— Gốc —';
        const cha = this.danhSach().find(x => x.id === ct.idChiTieuCha);
        return cha ? `${cha.maChiTieu} — ${cha.tenChiTieu}` : ct.maChiTieuCha ?? '— Gốc —';
    }

    /** Form mặc định khi thêm mới */
    private formMacDinh(): ChiTieuTaoMoi {
        return {
            maChiTieu: '',
            tenChiTieu: '',
            idChiTieuCha: null,
            loaiTaiKhoan: 0,
            loaiLuuTru: 'STORE',
            congThuc: '',
            donViTinh: 'Tỷ đồng',
            thuTu: 0,
        };
    }

    /** Hiện toast thông báo (tự ẩn sau 3 giây) */
    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3500);
    }
}
