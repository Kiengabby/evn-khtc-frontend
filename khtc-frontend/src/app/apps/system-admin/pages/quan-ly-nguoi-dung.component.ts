// ============================================
// Component: Quáº£n lÃ½ NgÆ°á»i dÃ¹ng â€” User Management CRUD
// ============================================

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { UserService } from '../../service/user.service';
import { RoleService } from '../../service/role.service';
import { UserAdmin, UserCreateDto, UserUpdateDto, UserFilterDto } from '../../../config/models/admin.model';
import { RoleAdmin } from '../../../config/models/admin.model';
import { DonViService } from '../../service/don-vi.service';
import { DonVi } from '../../../config/models/don-vi.model';

@Component({
  selector: 'app-quan-ly-nguoi-dung',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './quan-ly-nguoi-dung.component.html',
  styleUrl: './quan-ly-nguoi-dung.component.scss'
})
export class QuanLyNguoiDungComponent implements OnInit {

    // ============================================
    // State Management
    // ============================================
    users = signal<UserAdmin[]>([]);
    roles = signal<RoleAdmin[]>([]);
    entities = signal<DonVi[]>([]);
    dangTai = signal(false);
    hienDialog = signal(false);
    dangChinhSua = signal(false);
    userHienTai = signal<UserAdmin | null>(null);
    thongBao = signal<{ loai: 'success' | 'error'; noiDung: string } | null>(null);
    
    // Filter state
    tuKhoa = signal('');
    entityFilter = signal('');
    roleFilter = signal(0);
    activeFilter = signal<boolean | undefined>(undefined);

    // Form data
    formData: UserCreateDto = {
        username: '',
        fullName: '',
        email: '',
        phoneNumber: '',
        entityCode: '',
        password: '',
        roleIds: [],
        isActive: true,
        notes: ''
    };

    constructor(
        private userService: UserService,
        private roleService: RoleService,
        private donViService: DonViService
    ) {}

    async ngOnInit(): Promise<void> {
        await Promise.all([
            this.taiDanhSachUsers(),
            this.taiDanhSachRoles(),
            this.taiDanhSachEntities()
        ]);
    }

    // ============================================
    // Data Loading
    // ============================================
    private async taiDanhSachUsers(): Promise<void> {
        try {
            this.dangTai.set(true);
            const filter: UserFilterDto = {
                keyword: this.tuKhoa() || undefined,
                entityCode: this.entityFilter() || undefined,
                roleId: this.roleFilter() || undefined,
                isActive: this.activeFilter()
            };
            
            const ketQua = await this.userService.layDanhSach(filter);
            if (ketQua.trangThai) {
                this.users.set(ketQua.duLieu);
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('KhÃ´ng thá»ƒ táº£i danh sÃ¡ch ngÆ°á»i dÃ¹ng', 'error');
        } finally {
            this.dangTai.set(false);
        }
    }

    private async taiDanhSachRoles(): Promise<void> {
        try {
            const ketQua = await this.roleService.layDanhSach({ includeSystemRoles: true });
            if (ketQua.trangThai) {
                this.roles.set(ketQua.duLieu);
            }
        } catch (error) {
            console.warn('KhÃ´ng thá»ƒ táº£i vai trÃ²:', error);
        }
    }

    private async taiDanhSachEntities(): Promise<void> {
        try {
            const ketQua = await this.donViService.layDanhSach();
            if (ketQua.trangThai) {
                this.entities.set(ketQua.duLieu);
            }
        } catch (error) {
            console.warn('KhÃ´ng thá»ƒ táº£i Ä‘Æ¡n vá»‹:', error);
        }
    }

    // ============================================
    // Search & Filter
    // ============================================
    async timKiem(): Promise<void> {
        await this.taiDanhSachUsers();
    }

    lamMoiBoLoc(): void {
        this.tuKhoa.set('');
        this.entityFilter.set('');
        this.roleFilter.set(0);
        this.activeFilter.set(undefined);
        this.taiDanhSachUsers();
    }

    // ============================================
    // CRUD Operations
    // ============================================
    moDialogTaoMoi(): void {
        this.dangChinhSua.set(false);
        this.userHienTai.set(null);
        this.resetForm();
        this.hienDialog.set(true);
    }

    async moDialogChinhSua(user: UserAdmin): Promise<void> {
        this.dangChinhSua.set(true);
        this.userHienTai.set(user);
        
        // Load form with user data
        this.formData = {
            username: user.username,
            fullName: user.fullName,
            email: user.email || '',
            phoneNumber: user.phoneNumber || '',
            entityCode: user.entityCode,
            password: '', // KhÃ´ng hiá»ƒn thá»‹ password cÅ©
            roleIds: user.roles.map(r => r.roleId),
            isActive: user.isActive,
            notes: user.notes || ''
        };
        
        this.hienDialog.set(true);
    }

    dongDialog(): void {
        this.hienDialog.set(false);
        this.resetForm();
    }

    async luuUser(): Promise<void> {
        try {
            this.dangTai.set(true);
            
            let ketQua;
            if (this.dangChinhSua()) {
                const dto: UserUpdateDto = {
                    userId: this.userHienTai()!.userId,
                    fullName: this.formData.fullName,
                    email: this.formData.email,
                    phoneNumber: this.formData.phoneNumber,
                    entityCode: this.formData.entityCode,
                    roleIds: this.formData.roleIds,
                    isActive: this.formData.isActive,
                    isLocked: this.userHienTai()!.isLocked,
                    notes: this.formData.notes
                };
                ketQua = await this.userService.capNhat(dto);
            } else {
                ketQua = await this.userService.taoMoi(this.formData);
            }

            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao, 'success');
                this.dongDialog();
                await this.taiDanhSachUsers();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('CÃ³ lá»—i xáº£y ra khi lÆ°u', 'error');
        } finally {
            this.dangTai.set(false);
        }
    }

    async xoaUser(user: UserAdmin): Promise<void> {
        if (!confirm(`XÃ¡c nháº­n xÃ³a ngÆ°á»i dÃ¹ng "${user.username}"?`)) return;

        try {
            const ketQua = await this.userService.xoa(user.userId);
            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao, 'success');
                await this.taiDanhSachUsers();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('CÃ³ lá»—i xáº£y ra khi xÃ³a', 'error');
        }
    }

    async toggleKhoaUser(user: UserAdmin): Promise<void> {
        const action = user.isLocked ? 'má»Ÿ khÃ³a' : 'khÃ³a';
        if (!confirm(`XÃ¡c nháº­n ${action} tÃ i khoáº£n "${user.username}"?`)) return;

        try {
            const ketQua = await this.userService.toggleKhoa(user.userId);
            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao, 'success');
                await this.taiDanhSachUsers();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('CÃ³ lá»—i xáº£y ra', 'error');
        }
    }

    async resetPassword(user: UserAdmin): Promise<void> {
        if (!confirm(`XÃ¡c nháº­n reset máº­t kháº©u cho "${user.username}"?`)) return;

        try {
            const ketQua = await this.userService.resetMatKhau({
                userId: user.userId,
                newPassword: '123456', // Default password
                requireChangeOnLogin: true
            });
            
            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao + ' (Máº­t kháº©u má»›i: 123456)', 'success');
                await this.taiDanhSachUsers();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('CÃ³ lá»—i xáº£y ra', 'error');
        }
    }

    // ============================================
    // Helper Methods
    // ============================================
    private resetForm(): void {
        this.formData = {
            username: '',
            fullName: '',
            email: '',
            phoneNumber: '',
            entityCode: '',
            password: '',
            roleIds: [],
            isActive: true,
            notes: ''
        };
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ loai, noiDung });
        setTimeout(() => this.thongBao.set(null), 3000);
    }

    // Template helpers
    formatDate(dateStr: Date | string | null | undefined): string {
        if (!dateStr) return 'ChÆ°a tá»«ng';
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return date.toLocaleDateString('vi-VN');
    }

    getUserStatus(user: UserAdmin): string {
        if (user.isLocked) return 'locked';
        if (!user.isActive) return 'inactive';
        return 'active';
    }

    getStatusLabel(user: UserAdmin): string {
        if (user.isLocked) return 'KhÃ³a';
        if (!user.isActive) return 'VÃ´ hiá»‡u';
        return 'Hoáº¡t Ä‘á»™ng';
    }

    onRoleToggle(roleId: number, isChecked: boolean): void {
        if (isChecked) {
            if (!this.formData.roleIds.includes(roleId)) {
                this.formData.roleIds.push(roleId);
            }
        } else {
            this.formData.roleIds = this.formData.roleIds.filter(id => id !== roleId);
        }
    }

    isRoleSelected(roleId: number): boolean {
        return this.formData.roleIds.includes(roleId);
    }

    getRoleNames(user: UserAdmin): string {
        return user.roles.map(r => r.roleName).join(', ') || 'KhÃ´ng cÃ³';
    }
}