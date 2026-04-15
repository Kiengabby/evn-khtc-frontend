// ============================================
// Service: Quản lý Chỉ tiêu — Kết nối API thật
// ============================================
// Sử dụng DimAccountApiService để gọi /api/v2/DimAccount/*
// Map dữ liệu BE (AccountNode) ↔ FE (ChiTieu)
//
// === LUỒNG DỮ LIỆU ===
// 1. Component gọi ChiTieuService.layDanhSach(boLoc)
// 2. Service gọi DimAccountApiService.getFlatList()
// 3. Map FlatAccountNode[] → ChiTieu[] (có filter client-side)
// 4. Trả về KetQuaApi<ChiTieu[]> cho component
// ============================================

import { Injectable, inject } from '@angular/core';
import { DimAccountApiService, FlatAccountNode } from './dim-account-api.service';
import {
    ChiTieu,
    ChiTieuTaoMoi,
    ChiTieuCapNhat,
    ChiTieuBoLoc,
    LoaiLuuTru,
} from '../../config/models/chi-tieu.model';
import { KetQuaApi } from '../../config/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ChiTieuService {

    private dimAccountApi = inject(DimAccountApiService);

    // =====================================================================
    //  Đọc dữ liệu
    // =====================================================================

    /**
     * Lấy danh sách chỉ tiêu (flat list, đã sắp xếp theo cây)
     * Áp dụng filter client-side vì BE không hỗ trợ filter trên get-tree.
     */
    async layDanhSach(boLoc: ChiTieuBoLoc = {}): Promise<KetQuaApi<ChiTieu[]>> {
        try {
            const flatList = await this.dimAccountApi.getFlatList();
            let chiTieus = flatList.map(node => this.mapToChiTieu(node));

            // Filter client-side
            if (boLoc.tuKhoa) {
                const kw = boLoc.tuKhoa.toLowerCase();
                chiTieus = chiTieus.filter(ct =>
                    ct.maChiTieu.toLowerCase().includes(kw) ||
                    ct.tenChiTieu.toLowerCase().includes(kw)
                );
            }
            if (boLoc.loaiLuuTru) {
                chiTieus = chiTieus.filter(ct => ct.loaiLuuTru === boLoc.loaiLuuTru);
            }

            return {
                trangThai: true,
                maLoi: null,
                thongBao: 'Tải dữ liệu thành công',
                duLieu: chiTieus,
                tongSoBanGhi: chiTieus.length,
            };
        } catch (err) {
            console.error('[ChiTieuService] layDanhSach error:', err);
            return {
                trangThai: false,
                maLoi: 'LOAD_ERROR',
                thongBao: 'Không thể tải danh sách chỉ tiêu',
                duLieu: [],
            };
        }
    }

    // =====================================================================
    //  Tạo mới
    // =====================================================================

    async taoMoi(dto: ChiTieuTaoMoi): Promise<KetQuaApi<string>> {
        const result = await this.dimAccountApi.create({
            accountCode: dto.maChiTieu,
            accountName: dto.tenChiTieu,
            parentAccountId: dto.idChiTieuCha,
            accountType: dto.loaiTaiKhoan,
            dataStorage: dto.loaiLuuTru,
            formula: dto.congThuc || '',
            unit: dto.donViTinh,
            orderIndex: dto.thuTu,
        });

        return {
            trangThai: result.ok,
            maLoi: result.ok ? null : 'CREATE_ERROR',
            thongBao: result.message ?? (result.ok ? 'Tạo chỉ tiêu thành công' : 'Tạo chỉ tiêu thất bại'),
            duLieu: result.id ?? '',
        };
    }

    // =====================================================================
    //  Cập nhật
    // =====================================================================

    async capNhat(dto: ChiTieuCapNhat): Promise<KetQuaApi<null>> {
        const result = await this.dimAccountApi.update(dto.id, {
            accountCode: dto.maChiTieu,
            accountName: dto.tenChiTieu,
            parentAccountId: dto.idChiTieuCha,
            accountType: dto.loaiTaiKhoan,
            dataStorage: dto.loaiLuuTru,
            formula: dto.congThuc || '',
            unit: dto.donViTinh,
            orderIndex: dto.thuTu,
        });

        return {
            trangThai: result.ok,
            maLoi: result.ok ? null : 'UPDATE_ERROR',
            thongBao: result.message ?? (result.ok ? 'Cập nhật thành công' : 'Cập nhật thất bại'),
            duLieu: null,
        };
    }

    // =====================================================================
    //  Xóa
    // =====================================================================

    async xoa(id: string): Promise<KetQuaApi<null>> {
        const result = await this.dimAccountApi.delete(id);

        return {
            trangThai: result.ok,
            maLoi: result.ok ? null : 'DELETE_ERROR',
            thongBao: result.message ?? (result.ok ? 'Xóa thành công' : 'Xóa thất bại'),
            duLieu: null,
        };
    }

    // =====================================================================
    //  Private: Map BE → FE
    // =====================================================================

    /** Ánh xạ FlatAccountNode (BE) → ChiTieu (FE) */
    private mapToChiTieu(node: FlatAccountNode): ChiTieu {
        return {
            id: node.accountId,
            maChiTieu: node.accountCode,
            tenChiTieu: node.accountName,
            capDo: node.depth,
            maChiTieuCha: node.parentCode,
            idChiTieuCha: node.parentAccountId,
            loaiTaiKhoan: (node.accountType as 0 | 1) ?? 0,
            loaiLuuTru: this.parseLoaiLuuTru(node.dataStorage),
            congThuc: node.formula || null,
            donViTinh: node.unit || '',
            thuTu: node.orderIndex ?? 0,
        };
    }

    /** Parse dataStorage string → LoaiLuuTru (có fallback an toàn) */
    private parseLoaiLuuTru(dataStorage: string): LoaiLuuTru {
        const valid: LoaiLuuTru[] = ['STORE', 'DYNAMIC_CALC', 'LABEL_ONLY'];
        return valid.includes(dataStorage as LoaiLuuTru)
            ? (dataStorage as LoaiLuuTru)
            : 'STORE';
    }
}
