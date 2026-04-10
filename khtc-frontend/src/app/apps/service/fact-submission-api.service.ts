// ============================================
// FactSubmissionApiService
// Gọi API thật để lấy danh sách hồ sơ nộp
//
// Endpoint: GET /api/v2/FactSubmission/history
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { ConfigService } from '../../core/app-config.service';
import { HoSoNop, TrangThaiHoSo } from '../../config/models/workflow.model';
import { normalizeApiResponse } from '../../config/models/form-config-api.model';

interface FactSubmissionBeResponse {
    id: string;
    entityCode?: string;
    entityName?: string;
    formId?: string;
    formName?: string;
    formCode?: string;
    year?: number;
    period?: string;
    status?: string;
    created?: string;
    createdBy?: string;
    lastModified?: string;
    lastModifiedBy?: string;
}

@Injectable({ providedIn: 'root' })
export class FactSubmissionApiService {

    private http = inject(HttpClient);
    private configService = inject(ConfigService);

    // ================================================================
    // TOGGLE: set false để fallback về mock data khi BE chưa ready
    // ================================================================
    private readonly useRealApi = true;  // ← TRUE để gọi API thực

    private get apiBase(): string {
        return this.configService.apiBaseUrl;
    }

    /**
     * Lấy danh sách hồ sơ nộp từ BE
     * GET /api/v2/FactSubmission/history
     */
    getSubmissionHistory(filters?: {
        tuKhoa?: string;
        trangThai?: TrangThaiHoSo;
        maDonVi?: string;
    }): Observable<HoSoNop[]> {
        // Fallback về mock data nếu useRealApi = false
        if (!this.useRealApi) {
            console.log('[FactSubmissionApi] Using MOCK data');
            return of(this.getMockData()).pipe(
                map(data => this.filterMockData(data, filters))
            );
        }

        const url = `${this.apiBase}/api/v2/FactSubmission/history`;

        let params = new HttpParams();
        if (filters?.tuKhoa) {
            params = params.set('keyword', filters.tuKhoa);
        }
        if (filters?.trangThai) {
            params = params.set('status', filters.trangThai);
        }
        if (filters?.maDonVi) {
            params = params.set('entityCode', filters.maDonVi);
        }

        console.log('[FactSubmissionApi] GET:', url, 'filters:', filters);

        return this.http.get<any>(url, { params }).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FactSubmissionApi] HTTP', httpErr.status, 'body:', errBody);
                    return of(errBody);
                }
                console.error('[FactSubmissionApi] Error:', httpErr);
                throw httpErr;
            }),
            map(raw => {
                // Normalize PascalCase → camelCase
                const response = normalizeApiResponse(raw);

                if (!response.succeeded) {
                    console.warn('[FactSubmissionApi] API call failed:', response.message);
                    return [];
                }

                // BE returns data as object with "items" property
                const dataObj = response.data || {};
                const itemsArray = dataObj.items || [];

                if (!Array.isArray(itemsArray)) {
                    console.warn('[FactSubmissionApi] Items is not array');
                    return [];
                }

                return itemsArray.map((item: FactSubmissionBeResponse) =>
                    this.mapBeToFrontend(item)
                );
            }),
        );
    }

    /**
     * Map BE response → HoSoNop model
     */
    private mapBeToFrontend(be: FactSubmissionBeResponse): HoSoNop {
        return {
            id: be.id ? parseInt(be.id.substring(0, 8), 16) : 0,
            submissionId: be.id,  // ✅ Lưu UUID gốc để dùng khi edit
            maHoSo: `${be.formCode || 'N/A'}.${be.year}`,
            tieuDe: be.formName || '',
            entityCode: be.entityCode || '',
            entityName: be.entityName || '',
            formCode: be.formCode || '',
            formName: be.formName || '',
            period: be.period || undefined,
            year: be.year || new Date().getFullYear(),
            maDonVi: be.entityCode || '',
            tenDonVi: be.entityName || '',
            maPhienBan: '',
            maBieuMau: be.formCode || '',
            trangThai: this.mapStatus(be.status || ''),
            nguoiTao: be.createdBy || '',
            ngayTao: be.created || '',
            updatedAt: be.lastModified || be.created || '',
            nguoiDuyet: be.lastModifiedBy,
            ngayDuyet: be.lastModified,
            ghiChu: undefined,
        };
    }

    /**
     * Map API status → TrangThaiHoSo
     */
    private mapStatus(beStatus: string): TrangThaiHoSo {
        const map: Record<string, TrangThaiHoSo> = {
            'draft': 'nhap',
            'Draft': 'nhap',
            'pending': 'cho_duyet',
            'Pending': 'cho_duyet',
            'pending_approval': 'cho_duyet',
            'approved': 'da_duyet',
            'Approved': 'da_duyet',
            'rejected': 'tu_choi',
            'Rejected': 'tu_choi',
            'returned': 'tra_lai',
            'Returned': 'tra_lai',
        };
        return map[beStatus] || 'nhap';
    }

    // ================================================================
    //  MOCK DATA (fallback khi BE endpoint chưa sẵn sàng)
    // ================================================================

    private getMockData(): HoSoNop[] {
        return [
            {
                id: 1,
                maHoSo: 'KHTC.2026.001',
                tieuDe: 'Kế hoạch tài chính 2026 - Q1',
                entityCode: 'EVN',
                entityName: 'Tập đoàn Điện lực Việt Nam',
                formCode: 'KHTC_FINANCE_2026',
                formName: 'Báo cáo tài chính hàng quý',
                period: 'Q1',
                year: 2026,
                trangThai: 'da_duyet',
                nguoiTao: 'Nguyễn Văn A',
                ngayTao: '2026-01-15',
                updatedAt: '2026-01-20',
                nguoiDuyet: 'Trần Văn B',
                ngayDuyet: '2026-01-20',
                maPhienBan: 'v1.0',
                maBieuMau: 'KHTC_FINANCE_2026',
                maDonVi: 'EVN',
                tenDonVi: 'Tập đoàn Điện lực Việt Nam',
            },
            {
                id: 2,
                maHoSo: 'KHTC.2026.002',
                tieuDe: 'Kế hoạch tài chính 2026 - Q2',
                entityCode: 'EVN_PC',
                entityName: 'EVN - Phát điện',
                formCode: 'KHTC_FINANCE_2026',
                formName: 'Báo cáo tài chính hàng quý',
                period: 'Q2',
                year: 2026,
                trangThai: 'cho_duyet',
                nguoiTao: 'Lê Văn C',
                ngayTao: '2026-02-10',
                updatedAt: '2026-02-15',
                maPhienBan: 'v1.0',
                maBieuMau: 'KHTC_FINANCE_2026',
                maDonVi: 'EVN_PC',
                tenDonVi: 'EVN - Phát điện',
            },
            {
                id: 3,
                maHoSo: 'KHTC.2026.003',
                tieuDe: 'Kế hoạch tài chính 2026 - Tháng 3',
                entityCode: 'EVN_TX',
                entityName: 'EVN - Truyền tải',
                formCode: 'KHTC_MONTHLY_2026',
                formName: 'Báo cáo tài chính hàng tháng',
                period: 'Tháng 03',
                year: 2026,
                trangThai: 'nhap',
                nguoiTao: 'Phạm Văn D',
                ngayTao: '2026-02-25',
                updatedAt: '2026-03-01',
                maPhienBan: 'v1.0',
                maBieuMau: 'KHTC_MONTHLY_2026',
                maDonVi: 'EVN_TX',
                tenDonVi: 'EVN - Truyền tải',
            },
            {
                id: 4,
                maHoSo: 'KHTC.2026.004',
                tieuDe: 'Kế hoạch tài chính 2026 - Tháng 4',
                entityCode: 'EVN_VN',
                entityName: 'EVN - Vận tải',
                formCode: 'KHTC_MONTHLY_2026',
                formName: 'Báo cáo tài chính hàng tháng',
                period: 'Tháng 04',
                year: 2026,
                trangThai: 'tu_choi',
                nguoiTao: 'Hoàng Văn E',
                ngayTao: '2026-03-01',
                updatedAt: '2026-03-05',
                nguoiDuyet: 'Trần Văn B',
                ngayDuyet: '2026-03-05',
                ghiChu: 'Dữ liệu không chính xác, cần bổ sung thêm chi tiết',
                maPhienBan: 'v1.0',
                maBieuMau: 'KHTC_MONTHLY_2026',
                maDonVi: 'EVN_VN',
                tenDonVi: 'EVN - Vận tải',
            },
            {
                id: 5,
                maHoSo: 'KHTC.2026.005',
                tieuDe: 'Kế hoạch tài chính 2026 - Năm',
                entityCode: 'EVN',
                entityName: 'Tập đoàn Điện lực Việt Nam',
                formCode: 'KHTC_ANNUAL_2026',
                formName: 'Báo cáo tài chính hàng năm',
                period: 'Năm',
                year: 2026,
                trangThai: 'da_duyet',
                nguoiTao: 'Nguyễn Văn A',
                ngayTao: '2026-03-10',
                updatedAt: '2026-03-25',
                nguoiDuyet: 'Trần Văn B',
                ngayDuyet: '2026-03-25',
                maPhienBan: 'v1.0',
                maBieuMau: 'KHTC_ANNUAL_2026',
                maDonVi: 'EVN',
                tenDonVi: 'Tập đoàn Điện lực Việt Nam',
            },
        ];
    }

    private filterMockData(
        data: HoSoNop[],
        filters?: { tuKhoa?: string; trangThai?: TrangThaiHoSo; maDonVi?: string }
    ): HoSoNop[] {
        let result = [...data];

        if (filters?.tuKhoa) {
            const kw = filters.tuKhoa.toLowerCase();
            result = result.filter(hs =>
                hs.maHoSo.toLowerCase().includes(kw) ||
                hs.tieuDe.toLowerCase().includes(kw) ||
                (hs.tenDonVi?.toLowerCase().includes(kw) ?? false) ||
                (hs.entityName?.toLowerCase().includes(kw) ?? false) ||
                (hs.formName?.toLowerCase().includes(kw) ?? false)
            );
        }

        if (filters?.trangThai) {
            result = result.filter(hs => hs.trangThai === filters.trangThai);
        }

        if (filters?.maDonVi) {
            result = result.filter(hs => hs.maDonVi === filters.maDonVi);
        }

        return result;
    }
}
