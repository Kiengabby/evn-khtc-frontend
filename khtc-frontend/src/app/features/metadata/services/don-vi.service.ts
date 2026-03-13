import { Injectable, inject } from '@angular/core';
import { MockApiService } from '../../../core/services/mock-api.service';
import { DonVi, DonViTaoMoi } from '../../../core/models/don-vi.model';
import { KetQuaApi } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class DonViService {
    private api = inject(MockApiService);

    layDanhSach(boLoc: { tuKhoa?: string; capDonVi?: string } = {}): Promise<KetQuaApi<DonVi[]>> {
        return this.api.layDanhSachDonVi(boLoc);
    }

    taoMoi(dto: DonViTaoMoi): Promise<KetQuaApi<DonVi>> {
        return this.api.taoDonVi(dto);
    }

    capNhat(id: number, dto: Partial<DonViTaoMoi>): Promise<KetQuaApi<DonVi>> {
        return this.api.capNhatDonVi(id, dto);
    }

    xoa(id: number): Promise<KetQuaApi<null>> {
        return this.api.xoaDonVi(id);
    }
}
