import { Injectable, inject } from '@angular/core';
import { MockApiService } from '../../../core/services/mock-api.service';
import { PhienBan, PhienBanTaoMoi } from '../../../core/models/phien-ban.model';
import { KetQuaApi } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class PhienBanService {
    private api = inject(MockApiService);

    layDanhSach(boLoc: { tuKhoa?: string; loaiPhienBan?: string } = {}): Promise<KetQuaApi<PhienBan[]>> {
        return this.api.layDanhSachPhienBan(boLoc);
    }

    taoMoi(dto: PhienBanTaoMoi): Promise<KetQuaApi<PhienBan>> {
        return this.api.taoPhienBan(dto);
    }

    capNhat(id: number, dto: Partial<PhienBanTaoMoi>): Promise<KetQuaApi<PhienBan>> {
        return this.api.capNhatPhienBan(id, dto);
    }

    khoaMo(id: number): Promise<KetQuaApi<PhienBan>> {
        return this.api.khoaMoPhienBan(id);
    }

    xoa(id: number): Promise<KetQuaApi<null>> {
        return this.api.xoaPhienBan(id);
    }
}
