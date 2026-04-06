// ============================================
// Service: Role Management â€” Quáº£n lÃ½ vai trÃ²
// Thin wrapper around MockApiService for role operations
// ============================================

import { Injectable } from '@angular/core';
import { MockApiService } from './_deprecated/mock-api.service';
import { RoleAdmin, RoleCreateDto, RoleUpdateDto, RoleFilterDto } from '../../config/models/admin.model';
import { MenuItem } from '../../config/models/user.model';
import { KetQuaApi } from '../../config/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class RoleService {

    constructor(private mockApi: MockApiService) {}

    // === READ Operations ===
    
    async layDanhSach(filter: RoleFilterDto = {}): Promise<KetQuaApi<RoleAdmin[]>> {
        return this.mockApi.layDanhSachRoles(filter);
    }

    async layChiTiet(roleId: number): Promise<KetQuaApi<RoleAdmin>> {
        return this.mockApi.layChiTietRole(roleId);
    }

    async layDanhSachMenus(): Promise<KetQuaApi<MenuItem[]>> {
        return this.mockApi.layDanhSachMenus();
    }

    // === CRUD Operations ===

    async taoMoi(dto: RoleCreateDto): Promise<KetQuaApi<RoleAdmin>> {
        return this.mockApi.taoRole(dto);
    }

    async capNhat(dto: RoleUpdateDto): Promise<KetQuaApi<RoleAdmin>> {
        return this.mockApi.capNhatRole(dto);
    }

    async xoa(roleId: number): Promise<KetQuaApi<null>> {
        return this.mockApi.xoaRole(roleId);
    }
}