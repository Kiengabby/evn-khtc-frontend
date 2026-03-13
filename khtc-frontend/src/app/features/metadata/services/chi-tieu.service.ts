// ============================================
// Service: Quản lý Chỉ tiêu (Account Service)
// ============================================
// Service này đóng vai trò trung gian giữa Component và API.
// Hiện tại dùng MockApiService, sau này đổi sang API thật.
//
// === CÁCH DÙNG TRONG COMPONENT ===
//   chiTieuService = inject(ChiTieuService);
//   danhSach = signal<ChiTieu[]>([]);
//
//   async ngOnInit() {
//     const kq = await this.chiTieuService.layDanhSach();
//     if (kq.trangThai) this.danhSach.set(kq.duLieu);
//   }
// ============================================

import { Injectable, inject } from '@angular/core';
import { MockApiService } from '../../../core/services/mock-api.service';
import { ChiTieu, ChiTieuNode, ChiTieuTaoMoi, ChiTieuCapNhat, ChiTieuBoLoc } from '../../../core/models/chi-tieu.model';
import { KetQuaApi } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ChiTieuService {

    // Inject MockApiService (sau này đổi thành HttpClient + ApiService)
    private api = inject(MockApiService);

    /**
     * Lấy danh sách chỉ tiêu (flat, có phân trang)
     * @param boLoc - Bộ lọc: từ khóa, loại, trạng thái, phân trang
     * @returns KetQuaApi<ChiTieu[]>
     */
    layDanhSach(boLoc: ChiTieuBoLoc = {}): Promise<KetQuaApi<ChiTieu[]>> {
        return this.api.layDanhSachChiTieu(boLoc);
    }

    /**
     * Lấy cây chỉ tiêu (hierarchical, dùng cho TreeTable)
     * @returns KetQuaApi<ChiTieuNode[]>
     */
    layCayChiTieu(): Promise<KetQuaApi<ChiTieuNode[]>> {
        return this.api.layCayChiTieu();
    }

    /**
     * Lấy chi tiết 1 chỉ tiêu
     * @param id - ID chỉ tiêu
     */
    layTheoId(id: number): Promise<KetQuaApi<ChiTieu | null>> {
        return this.api.layChiTieuTheoId(id);
    }

    /**
     * Tạo chỉ tiêu mới
     * @param dto - Dữ liệu tạo mới (không cần id)
     */
    taoMoi(dto: ChiTieuTaoMoi): Promise<KetQuaApi<ChiTieu>> {
        return this.api.taoChiTieu(dto);
    }

    /**
     * Cập nhật chỉ tiêu
     * @param dto - Dữ liệu cập nhật (bắt buộc có id)
     */
    capNhat(dto: ChiTieuCapNhat): Promise<KetQuaApi<ChiTieu>> {
        return this.api.capNhatChiTieu(dto);
    }

    /**
     * Xóa chỉ tiêu
     * @param id - ID chỉ tiêu cần xóa
     */
    xoa(id: number): Promise<KetQuaApi<null>> {
        return this.api.xoaChiTieu(id);
    }
}
