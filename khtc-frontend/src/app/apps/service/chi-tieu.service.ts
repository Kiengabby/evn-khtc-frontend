// ============================================
// Service: Quáº£n lÃ½ Chá»‰ tiÃªu (Account Service)
// ============================================
// Service nÃ y Ä‘Ã³ng vai trÃ² trung gian giá»¯a Component vÃ  API.
// Hiá»‡n táº¡i dÃ¹ng MockApiService, sau nÃ y Ä‘á»•i sang API tháº­t.
//
// === CÃCH DÃ™NG TRONG COMPONENT ===
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

    // Inject MockApiService (sau nÃ y Ä‘á»•i thÃ nh HttpClient + ApiService)
    private api = inject(MockApiService);

    /**
     * Láº¥y danh sÃ¡ch chá»‰ tiÃªu (flat, cÃ³ phÃ¢n trang)
     * @param boLoc - Bá»™ lá»c: tá»« khÃ³a, loáº¡i, tráº¡ng thÃ¡i, phÃ¢n trang
     * @returns KetQuaApi<ChiTieu[]>
     */
    layDanhSach(boLoc: ChiTieuBoLoc = {}): Promise<KetQuaApi<ChiTieu[]>> {
        return this.api.layDanhSachChiTieu(boLoc);
    }

    /**
     * Láº¥y cÃ¢y chá»‰ tiÃªu (hierarchical, dÃ¹ng cho TreeTable)
     * @returns KetQuaApi<ChiTieuNode[]>
     */
    layCayChiTieu(): Promise<KetQuaApi<ChiTieuNode[]>> {
        return this.api.layCayChiTieu();
    }

    /**
     * Láº¥y chi tiáº¿t 1 chá»‰ tiÃªu
     * @param id - ID chá»‰ tiÃªu
     */
    layTheoId(id: number): Promise<KetQuaApi<ChiTieu | null>> {
        return this.api.layChiTieuTheoId(id);
    }

    /**
     * Táº¡o chá»‰ tiÃªu má»›i
     * @param dto - Dá»¯ liá»‡u táº¡o má»›i (khÃ´ng cáº§n id)
     */
    taoMoi(dto: ChiTieuTaoMoi): Promise<KetQuaApi<ChiTieu>> {
        return this.api.taoChiTieu(dto);
    }

    /**
     * Cáº­p nháº­t chá»‰ tiÃªu
     * @param dto - Dá»¯ liá»‡u cáº­p nháº­t (báº¯t buá»™c cÃ³ id)
     */
    capNhat(dto: ChiTieuCapNhat): Promise<KetQuaApi<ChiTieu>> {
        return this.api.capNhatChiTieu(dto);
    }

    /**
     * XÃ³a chá»‰ tiÃªu
     * @param id - ID chá»‰ tiÃªu cáº§n xÃ³a
     */
    xoa(id: number): Promise<KetQuaApi<null>> {
        return this.api.xoaChiTieu(id);
    }
}
