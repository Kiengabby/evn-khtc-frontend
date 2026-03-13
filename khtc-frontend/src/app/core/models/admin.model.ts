// ============================================
// Admin Management Models — User & Role CRUD
// Extends base User/Role models for administration
// ============================================

import { User, UserRole, RolePermission } from './user.model';

/** Enhanced User for admin management */
export interface UserAdmin extends User {
    email?: string;
    phoneNumber?: string;
    createdDate: Date;
    lastLoginDate?: Date | null;
    isLocked: boolean;
    failedLoginCount: number;
    createdBy: string;
    notes?: string;
}

/** Enhanced Role for admin management */
export interface RoleAdmin extends UserRole {
    description?: string;
    permissions: RolePermission[];
    userCount: number;
    createdDate: Date;
    createdBy: string;
    isSystemRole: boolean;
}

/** User creation DTO */
export interface UserCreateDto {
    username: string;
    fullName: string;
    email?: string;
    phoneNumber?: string;
    entityCode: string;
    password: string;
    roleIds: number[];
    isActive: boolean;
    notes?: string;
}

/** User update DTO */
export interface UserUpdateDto {
    userId: number;
    fullName: string;
    email?: string;
    phoneNumber?: string;
    entityCode: string;
    roleIds: number[];
    isActive: boolean;
    isLocked: boolean;
    notes?: string;
}

/** Password reset DTO */
export interface PasswordResetDto {
    userId: number;
    newPassword: string;
    requireChangeOnLogin: boolean;
}

/** Role creation DTO */
export interface RoleCreateDto {
    roleName: string;
    description?: string;
    permissions: RolePermissionDto[];
}

/** Role update DTO */
export interface RoleUpdateDto {
    roleId: number;
    roleName: string;
    description?: string;
    permissions: RolePermissionDto[];
}

/** Permission assignment DTO */
export interface RolePermissionDto {
    menuId: number;
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
}

/** User search filter */
export interface UserFilterDto {
    keyword?: string;
    entityCode?: string;
    roleId?: number;
    isActive?: boolean;
    isLocked?: boolean;
}

/** Role search filter */
export interface RoleFilterDto {
    keyword?: string;
    includeSystemRoles?: boolean;
}

/** User status types */
export type UserStatus = 'active' | 'inactive' | 'locked' | 'new';

/** Permission levels */
export const PERMISSIONS = {
    READ: 'canRead',
    WRITE: 'canWrite', 
    APPROVE: 'canApprove'
} as const;