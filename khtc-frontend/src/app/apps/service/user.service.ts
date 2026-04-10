// ============================================
// Service: User Management � Quản lý người dùng
// Thin wrapper around MockApiService for user operations
// ============================================

import { Injectable } from '@angular/core';
import { MockApiService } from './_deprecated/mock-api.service';
import { UserAdmin, UserCreateDto, UserUpdateDto, PasswordResetDto, UserFilterDto } from '../../config/models/admin.model';
import { KetQuaApi } from '../../config/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class UserService {

    constructor(private mockApi: MockApiService) {}

    // === READ Operations ===
    
    async layDanhSach(filter: UserFilterDto = {}): Promise<KetQuaApi<UserAdmin[]>> {
        return this.mockApi.layDanhSachUsers(filter);
    }

    async layChiTiet(userId: number): Promise<KetQuaApi<UserAdmin>> {
        return this.mockApi.layChiTietUser(userId);
    }

    // === CRUD Operations ===

    async taoMoi(dto: UserCreateDto): Promise<KetQuaApi<UserAdmin>> {
        return this.mockApi.taoUser(dto);
    }

    async capNhat(dto: UserUpdateDto): Promise<KetQuaApi<UserAdmin>> {
        return this.mockApi.capNhatUser(dto);
    }

    async xoa(userId: number): Promise<KetQuaApi<null>> {
        return this.mockApi.xoaUser(userId);
    }

    // === Administrative Actions ===

    async resetMatKhau(dto: PasswordResetDto): Promise<KetQuaApi<null>> {
        return this.mockApi.resetPassword(dto);
    }

    async toggleKhoa(userId: number): Promise<KetQuaApi<UserAdmin>> {
        return this.mockApi.toggleLockUser(userId);
    }
}