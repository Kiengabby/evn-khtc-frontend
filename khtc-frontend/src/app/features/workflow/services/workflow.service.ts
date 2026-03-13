// ============================================
// Service: Workflow — Wrapper cho MockApiService
// ============================================
import { Injectable, inject } from '@angular/core';
import { MockApiService } from '../../../core/services/mock-api.service';
import { TrangThaiHoSo, PheDuyetDto } from '../../../core/models/workflow.model';

@Injectable({ providedIn: 'root' })
export class WorkflowService {
    private api = inject(MockApiService);

    layDanhSachHoSo(boLoc: { tuKhoa?: string; trangThai?: TrangThaiHoSo; maDonVi?: string } = {}) {
        return this.api.layDanhSachHoSo(boLoc);
    }

    layHopThuPheDuyet() {
        return this.api.layHopThuPheDuyet();
    }

    xuLyPheDuyet(dto: PheDuyetDto) {
        return this.api.xuLyPheDuyet(dto);
    }

    nopHoSo(hoSoId: number) {
        return this.api.nopHoSo(hoSoId);
    }

    rutHoSo(hoSoId: number) {
        return this.api.rutHoSo(hoSoId);
    }
}
