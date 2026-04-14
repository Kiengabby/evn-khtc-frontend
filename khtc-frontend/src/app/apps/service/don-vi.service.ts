import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DimEntity, DimEntitySaveRequest } from '../../config/models/don-vi.model';
import { normalizeApiResponse } from '../../config/models/form-config-api.model';
import { ConfigService } from '../../core/app-config.service';

export interface DonViApiResult<T> {
    ok: boolean;
    data: T;
    message: string;
}

@Injectable({ providedIn: 'root' })
export class DonViService {
    private http = inject(HttpClient);
    private configService = inject(ConfigService);

    private get base(): string {
        return `${this.configService.apiBaseUrl}/api/v2/DimEntity`;
    }

    async layDanhSach(): Promise<DonViApiResult<DimEntity[]>> {
        try {
            const raw = await firstValueFrom(this.http.get<any>(`${this.base}/get-all`));
            const res = normalizeApiResponse<DimEntity[]>(raw);
            const list = Array.isArray(res.data) ? res.data : [];
            return { ok: res.succeeded, data: list, message: res.message ?? '' };
        } catch (err) {
            return { ok: false, data: [], message: this.extractError(err) };
        }
    }

    async taoMoi(payload: DimEntitySaveRequest): Promise<DonViApiResult<DimEntity | null>> {
        try {
            const raw = await firstValueFrom(this.http.post<any>(`${this.base}/create`, payload));
            const res = normalizeApiResponse<any>(raw);
            return { ok: res.succeeded, data: res.data ?? null, message: res.message ?? '' };
        } catch (err) {
            return { ok: false, data: null, message: this.extractError(err) };
        }
    }

    /**
     * Cập nhật đơn vị.
     * BE tạm thời dùng entityCode (không phải id UUID) để tìm và cập nhật.
     * PM xác nhận: dùng entityCode thay vì id cho update/delete.
     */
    async capNhat(entityCode: string, payload: DimEntitySaveRequest): Promise<DonViApiResult<any>> {
        try {
            const raw = await firstValueFrom(
                this.http.post<any>(`${this.base}/update/${encodeURIComponent(entityCode)}`, payload)
            );
            const res = normalizeApiResponse<any>(raw);
            return { ok: res.succeeded, data: res.data ?? null, message: res.message ?? '' };
        } catch (err) {
            return { ok: false, data: null, message: this.extractError(err) };
        }
    }

    /**
     * Xóa đơn vị.
     * BE tạm thời dùng entityCode (không phải id UUID) để tìm và xóa.
     */
    async xoa(entityCode: string): Promise<DonViApiResult<null>> {
        try {
            const raw = await firstValueFrom(
                this.http.post<any>(`${this.base}/delete/${encodeURIComponent(entityCode)}`, {})
            );
            const res = normalizeApiResponse<null>(raw);
            return { ok: res.succeeded, data: null, message: res.message ?? '' };
        } catch (err) {
            return { ok: false, data: null, message: this.extractError(err) };
        }
    }

    private extractError(err: unknown): string {
        const e = err as HttpErrorResponse;
        return e?.error?.Message ?? e?.error?.message ?? e?.message ?? 'Không thể kết nối máy chủ';
    }
}
