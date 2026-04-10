// ============================================
// Service: Workflow — API Integration
// ============================================
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MockApiService } from './_deprecated/mock-api.service';
import { FactSubmissionApiService } from './fact-submission-api.service';
import { TrangThaiHoSo, PheDuyetDto, HoSoNop } from '../../config/models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
    private mockApi = inject(MockApiService);
    private factSubmissionApi = inject(FactSubmissionApiService);

    /**
     * Lấy danh sách hồ sơ nộp từ API
     * Dùng API thực /api/v2/FactSubmission/history
     */
    async layDanhSachHoSo(boLoc: { tuKhoa?: string; trangThai?: TrangThaiHoSo; maDonVi?: string } = {}) {
        try {
            const duLieu = await firstValueFrom(
                this.factSubmissionApi.getSubmissionHistory(boLoc)
            );
            return {
                trangThai: true,
                duLieu,
                thongBao: 'Tải danh sách thành công',
            };
        } catch (err) {
            console.error('[WorkflowService] Error loading submissions:', err);
            return {
                trangThai: false,
                duLieu: [] as HoSoNop[],
                thongBao: 'Lỗi khi tải danh sách hồ sơ',
            };
        }
    }

    layHopThuPheDuyet() {
        return this.mockApi.layHopThuPheDuyet();
    }

    xuLyPheDuyet(dto: PheDuyetDto) {
        return this.mockApi.xuLyPheDuyet(dto);
    }

    nopHoSo(hoSoId: number) {
        return this.mockApi.nopHoSo(hoSoId);
    }

    rutHoSo(hoSoId: number) {
        return this.mockApi.rutHoSo(hoSoId);
    }
}
