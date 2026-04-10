// ============================================
// Component: Quản lý Vai trò � Role Management CRUD
// ============================================

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { RoleService } from '../../service/role.service';
import { RoleAdmin, RoleCreateDto, RoleUpdateDto, RoleFilterDto, RolePermissionDto } from '../../../config/models/admin.model';
import { MenuItem } from '../../../config/models/user.model';

@Component({
  selector: 'app-quan-ly-vai-tro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './quan-ly-vai-tro.component.html',
  styleUrl: './quan-ly-vai-tro.component.scss'
})
export class QuanLyVaiTroComponent implements OnInit {

    // ============================================
    // State Management
    // ============================================
    roles = signal<RoleAdmin[]>([]);
    menus = signal<MenuItem[]>([]);
    dangTai = signal(false);
    hienDialog = signal(false);
    dangChinhSua = signal(false);
    roleHienTai = signal<RoleAdmin | null>(null);
    thongBao = signal<{ loai: 'success' | 'error'; noiDung: string } | null>(null);
    
    // Filter state
    tuKhoa = signal('');
    includeSystemRoles = signal(false);

    // Form data
    formData: RoleCreateDto = {
        roleName: '',
        description: '',
        permissions: []
    };

    constructor(private roleService: RoleService) {}

    async ngOnInit(): Promise<void> {
        await Promise.all([
            this.taiDanhSachRoles(),
            this.taiDanhSachMenus()
        ]);
    }

    // ============================================
    // Data Loading
    // ============================================
    private async taiDanhSachRoles(): Promise<void> {
        try {
            this.dangTai.set(true);
            const filter: RoleFilterDto = {
                keyword: this.tuKhoa() || undefined,
                includeSystemRoles: this.includeSystemRoles()
            };
            
            const ketQua = await this.roleService.layDanhSach(filter);
            if (ketQua.trangThai) {
                this.roles.set(ketQua.duLieu);
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('Không thỒ tải danh sách vai trò', 'error');
        } finally {
            this.dangTai.set(false);
        }
    }

    private async taiDanhSachMenus(): Promise<void> {
        try {
            const ketQua = await this.roleService.layDanhSachMenus();
            if (ketQua.trangThai) {
                this.menus.set(ketQua.duLieu);
            }
        } catch (error) {
            console.warn('Không thỒ tải menu:', error);
        }
    }

    // ============================================
    // Search & Filter
    // ============================================
    async timKiem(): Promise<void> {
        await this.taiDanhSachRoles();
    }

    lamMoiBoLoc(): void {
        this.tuKhoa.set('');
        this.includeSystemRoles.set(false);
        this.taiDanhSachRoles();
    }

    // ============================================
    // CRUD Operations
    // ============================================
    moDialogTaoMoi(): void {
        this.dangChinhSua.set(false);
        this.roleHienTai.set(null);
        this.resetForm();
        this.hienDialog.set(true);
    }

    async moDialogChinhSua(role: RoleAdmin): Promise<void> {
        this.dangChinhSua.set(true);
        this.roleHienTai.set(role);
        
        // Load form with role data
        this.formData = {
            roleName: role.roleName,
            description: role.description || '',
            permissions: role.permissions.map(p => ({
                menuId: p.menuId,
                canRead: p.canRead,
                canWrite: p.canWrite,
                canApprove: p.canApprove
            }))
        };
        
        this.hienDialog.set(true);
    }

    dongDialog(): void {
        this.hienDialog.set(false);
        this.resetForm();
    }

    async luuRole(): Promise<void> {
        try {
            this.dangTai.set(true);
            
            let ketQua;
            if (this.dangChinhSua()) {
                const dto: RoleUpdateDto = {
                    roleId: this.roleHienTai()!.roleId,
                    roleName: this.formData.roleName,
                    description: this.formData.description,
                    permissions: this.formData.permissions
                };
                ketQua = await this.roleService.capNhat(dto);
            } else {
                ketQua = await this.roleService.taoMoi(this.formData);
            }

            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao, 'success');
                this.dongDialog();
                await this.taiDanhSachRoles();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('Có l�i xảy ra khi lưu', 'error');
        } finally {
            this.dangTai.set(false);
        }
    }

    async xoaRole(role: RoleAdmin): Promise<void> {
        if (role.isSystemRole) {
            this.hienThongBao('Không thỒ xóa vai trò h�! th�ng', 'error');
            return;
        }

        if (!confirm(`Xác nhận xóa vai trò "${role.roleName}"?`)) return;

        try {
            const ketQua = await this.roleService.xoa(role.roleId);
            if (ketQua.trangThai) {
                this.hienThongBao(ketQua.thongBao, 'success');
                await this.taiDanhSachRoles();
            } else {
                this.hienThongBao(ketQua.thongBao, 'error');
            }
        } catch (error) {
            this.hienThongBao('Có l�i xảy ra khi xóa', 'error');
        }
    }

    // ============================================
    // Permission Management
    // ============================================
    getPermissionForMenu(menuId: number): RolePermissionDto | undefined {
        return this.formData.permissions.find(p => p.menuId === menuId);
    }

    togglePermission(menuId: number, permissionType: 'canRead' | 'canWrite' | 'canApprove', checked: boolean): void {
        let permission = this.getPermissionForMenu(menuId);
        
        if (!permission) {
            permission = {
                menuId,
                canRead: false,
                canWrite: false,
                canApprove: false
            };
            this.formData.permissions.push(permission);
        }

        permission[permissionType] = checked;

        // Auto-check canRead if canWrite or canApprove is checked
        if (checked && (permissionType === 'canWrite' || permissionType === 'canApprove')) {
            permission.canRead = true;
        }

        // Auto-uncheck canWrite and canApprove if canRead is unchecked
        if (!checked && permissionType === 'canRead') {
            permission.canWrite = false;
            permission.canApprove = false;
        }

        // Remove permission if all are false
        if (!permission.canRead && !permission.canWrite && !permission.canApprove) {
            this.formData.permissions = this.formData.permissions.filter(p => p.menuId !== menuId);
        }
    }

    hasPermission(menuId: number, permissionType: 'canRead' | 'canWrite' | 'canApprove'): boolean {
        const permission = this.getPermissionForMenu(menuId);
        return permission ? permission[permissionType] : false;
    }

    // ============================================
    // Helper Methods
    // ============================================
    private resetForm(): void {
        this.formData = {
            roleName: '',
            description: '',
            permissions: []
        };
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ loai, noiDung });
        setTimeout(() => this.thongBao.set(null), 3000);
    }

    // Template helpers
    formatDate(dateStr: Date | string): string {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return date.toLocaleDateString('vi-VN');
    }

    getPermissionSummary(role: RoleAdmin): string {
        const totalMenus = this.menus().length;
        const permissionCount = role.permissions.length;
        const readCount = role.permissions.filter(p => p.canRead).length;
        const writeCount = role.permissions.filter(p => p.canWrite).length;
        const approveCount = role.permissions.filter(p => p.canApprove).length;
        
        return `${permissionCount}/${totalMenus} menu (R:${readCount}, W:${writeCount}, A:${approveCount})`;
    }
}