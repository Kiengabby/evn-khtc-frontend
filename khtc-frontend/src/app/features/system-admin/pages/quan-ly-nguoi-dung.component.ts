// ============================================
// Component: Quản lý Người dùng — User Management CRUD
// ============================================

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { UserService } from '../services/user.service';
import { RoleService } from '../services/role.service';
import { UserAdmin, UserCreateDto, UserUpdateDto, UserFilterDto } from '../../../core/models/admin.model';
import { RoleAdmin } from '../../../core/models/admin.model';
import { DonViService } from '../../metadata/services/don-vi.service';
import { DonVi } from '../../../core/models/don-vi.model';

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
            this.hienThongBao('Không thể tải danh sách người dùng', 'error');
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
            console.warn('Không thể tải vai trò:', error);
        }
    }

    private async taiDanhSachEntities(): Promise<void> {
        try {
            const ketQua = await this.donViService.layDanhSach();
            if (ketQua.trangThai) {
                this.entities.set(ketQua.duLieu);
            }
        } catch (error) {
            console.warn('Không thể tải đơn vị:', error);
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
            password: '', // Không hiển thị password cũ
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
            this.hienThongBao('Có lỗi xảy ra khi lưu', 'error');
        } finally {
            this.dangTai.set(false);
        }
    }

    async xoaUser(user: UserAdmin): Promise<void> {
        if (!confirm(`Xác nhận xóa người dùng "${user.username}"?`)) return;

        try {
            const ketQua = await this.userService.xoa(user.userId);
            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao, 'success');
                await this.taiDanhSachUsers();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('Có lỗi xảy ra khi xóa', 'error');
        }
    }

    async toggleKhoaUser(user: UserAdmin): Promise<void> {
        const action = user.isLocked ? 'mở khóa' : 'khóa';
        if (!confirm(`Xác nhận ${action} tài khoản "${user.username}"?`)) return;

        try {
            const ketQua = await this.userService.toggleKhoa(user.userId);
            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao, 'success');
                await this.taiDanhSachUsers();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('Có lỗi xảy ra', 'error');
        }
    }

    async resetPassword(user: UserAdmin): Promise<void> {
        if (!confirm(`Xác nhận reset mật khẩu cho "${user.username}"?`)) return;

        try {
            const ketQua = await this.userService.resetMatKhau({
                userId: user.userId,
                newPassword: '123456', // Default password
                requireChangeOnLogin: true
            });
            
            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao + ' (Mật khẩu mới: 123456)', 'success');
                await this.taiDanhSachUsers();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('Có lỗi xảy ra', 'error');
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
        if (!dateStr) return 'Chưa từng';
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return date.toLocaleDateString('vi-VN');
    }

    getUserStatus(user: UserAdmin): string {
        if (user.isLocked) return 'locked';
        if (!user.isActive) return 'inactive';
        return 'active';
    }

    getStatusLabel(user: UserAdmin): string {
        if (user.isLocked) return 'Khóa';
        if (!user.isActive) return 'Vô hiệu';
        return 'Hoạt động';
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
        return user.roles.map(r => r.roleName).join(', ') || 'Không có';
    }
}