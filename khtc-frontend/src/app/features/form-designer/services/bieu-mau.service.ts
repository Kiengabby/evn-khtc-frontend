// ============================================
// Service: Quản lý Biểu mẫu (Form Template Service)
// ============================================
// Thin wrapper → MockApiService (sau này đổi sang API thật)
// ============================================

import { Injectable, inject } from '@angular/core';
import { MockApiService } from '../../../core/services/mock-api.service';
import { FormTemplate, FormTemplateTaoMoi, ColumnDefinition } from '../../../core/models/form-template.model';
import { KetQuaApi } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class BieuMauService {

    private api = inject(MockApiService);

    layDanhSach(boLoc: { tuKhoa?: string } = {}): Promise<KetQuaApi<FormTemplate[]>> {
        return this.api.layDanhSachBieuMau(boLoc);
    }

    layTheoId(formId: string): Promise<KetQuaApi<FormTemplate | null>> {
        return this.api.layBieuMauTheoId(formId);
    }

    taoMoi(dto: FormTemplateTaoMoi): Promise<KetQuaApi<FormTemplate>> {
        return this.api.taoBieuMau(dto);
    }

    capNhat(formId: string, dto: Partial<FormTemplateTaoMoi>): Promise<KetQuaApi<FormTemplate>> {
        return this.api.capNhatBieuMau(formId, dto);
    }

    xoa(formId: string): Promise<KetQuaApi<null>> {
        return this.api.xoaBieuMau(formId);
    }

    layCauHinhCot(formId: string): Promise<KetQuaApi<ColumnDefinition[]>> {
        return this.api.layCauHinhCot(formId);
    }

    layDanhMucMaChiTieu(): Promise<KetQuaApi<any>> {
        return this.api.layDanhMucMaChiTieu();
    }
}
