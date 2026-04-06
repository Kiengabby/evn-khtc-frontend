// ============================================
// Service: Tải và lưu dữ liệu kế hoạch tài chính
// Abstraction layer giữa Component và API backend
// ============================================

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// === Request gửi đi khi user chọn filter ===
export interface TaiChinhFilter {
    kichBan: 'PLAN' | 'ACTUAL' | 'FORECAST';
    bieuMau: string;
    donVi: string;
    nam: number;
    phienBan?: string;
}

// === 1 dòng chỉ tiêu ===
export interface DongChiTieu {
    rowKey: string;
    maChiTieu: string;
    tenChiTieu: string;
    capDo: number;
    laDongTong: boolean;
    congThucDong?: string;
    operator?: number;
}

// === 1 cột biểu mẫu ===
export interface CotBieuMau {
    colKey: string;
    tenCot: string;
    nhomCha?: string;
    chiDoc?: boolean;
    congThucCot?: string;
    doRong?: number;
    dinhDang?: string;
}

// === 1 ô thay đổi cần lưu ===
export interface OThayDoi {
    row: number;
    col: number;
    giaTriCu: any;
    giaTriMoi: any;
    maChiTieu: string;
    colKey: string;
}

@Injectable({ providedIn: 'root' })
export class TaiChinhDataService {

    constructor(private http: HttpClient) {}

    /** Load dữ liệu từ API backend */
    loadTuAPI(filter: TaiChinhFilter): Observable<any> {
        return this.http.post('/api/tai-chinh/load-bieu-mau', filter);
    }

    /** Lưu thay đổi về backend */
    luuDuLieu(filter: TaiChinhFilter, changes: OThayDoi[]): Observable<boolean> {
        return this.http.post<boolean>('/api/tai-chinh/save', { filter, changes });
    }

    /** Import từ file Excel */
    importExcel(file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post('/api/tai-chinh/import-excel', formData);
    }
}