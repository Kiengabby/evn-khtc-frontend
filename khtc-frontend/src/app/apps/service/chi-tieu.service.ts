// ============================================
// Service: Quản lý Ch�0 tiêu (Account Service)
// ============================================
// Service này �óng vai trò trung gian giữa Component và API.
// Hi�!n tại dùng MockApiService, sau này ��"i sang API thật.
//
// === CÁCH D�"NG TRONG COMPONENT ===
//   chiTieuService = inject(ChiTieuService);
//   danhSach = signal<ChiTieu[]>([]);
//
//   async ngOnInit() {
//     const kq = await this.chiTieuService.layDanhSach();
//     if (kq.trangThai) this.danhSach.set(kq.duLieu);
//   }
// ============================================

import { Injectable, inject } from '@angular/core';
import { MockApiService } from './_deprecated/mock-api.service';
import { ChiTieu, ChiTieuNode, ChiTieuTaoMoi, ChiTieuCapNhat, ChiTieuBoLoc } from '../../config/models/chi-tieu.model';
import { KetQuaApi } from '../../config/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ChiTieuService {

    // Inject MockApiService (sau này ��"i thành HttpClient + ApiService)
    private api = inject(MockApiService);

    /**
     * Lấy danh sách ch�0 tiêu (flat, có phân trang)
     * @param boLoc - B�" lọc: từ khóa, loại, trạng thái, phân trang
     * @returns KetQuaApi<ChiTieu[]>
     */
    layDanhSach(boLoc: ChiTieuBoLoc = {}): Promise<KetQuaApi<ChiTieu[]>> {
        return this.api.layDanhSachChiTieu(boLoc);
    }

    /**
     * Lấy cây ch�0 tiêu (hierarchical, dùng cho TreeTable)
     * @returns KetQuaApi<ChiTieuNode[]>
     */
    layCayChiTieu(): Promise<KetQuaApi<ChiTieuNode[]>> {
        return this.api.layCayChiTieu();
    }

    /**
     * Lấy chi tiết 1 ch�0 tiêu
     * @param id - ID ch�0 tiêu
     */
    layTheoId(id: number): Promise<KetQuaApi<ChiTieu | null>> {
        return this.api.layChiTieuTheoId(id);
    }

    /**
     * Tạo ch�0 tiêu m�:i
     * @param dto - Dữ li�!u tạo m�:i (không cần id)
     */
    taoMoi(dto: ChiTieuTaoMoi): Promise<KetQuaApi<ChiTieu>> {
        return this.api.taoChiTieu(dto);
    }

    /**
     * Cập nhật ch�0 tiêu
     * @param dto - Dữ li�!u cập nhật (bắt bu�"c có id)
     */
    capNhat(dto: ChiTieuCapNhat): Promise<KetQuaApi<ChiTieu>> {
        return this.api.capNhatChiTieu(dto);
    }

    /**
     * Xóa ch�0 tiêu
     * @param id - ID ch�0 tiêu cần xóa
     */
    xoa(id: number): Promise<KetQuaApi<null>> {
        return this.api.xoaChiTieu(id);
    }
}
