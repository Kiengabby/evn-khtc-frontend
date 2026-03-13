// ============================================
// Core Data Models — User & Auth
// Maps to: SYS_USER, SYS_ROLE, SYS_ROLE_PERMISSION
// ============================================

/** SYS_USER */
export interface User {
    userId: number;
    username: string;
    fullName: string;
    entityCode: string;
    entityName?: string;
    isActive: boolean;
    roles: UserRole[];
    token?: string;
}

/** SYS_ROLE */
export interface UserRole {
    roleId: number;
    roleName: string;
}

/** SYS_ROLE_PERMISSION */
export interface RolePermission {
    roleId: number;
    menuId: number;
    canRead: boolean;
    canWrite: boolean;
    canApprove: boolean;
}

/** SYS_MENU */
export interface MenuItem {
    menuId: number;
    menuName: string;
    parentId: number | null;
    url: string | null;
    formId: string | null;
    icon?: string;
    sortOrder: number;
    children?: MenuItem[];
}

/** Login request / response */
export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    refreshToken: string;
    user: User;
    expiresIn: number;
}

/** Generic API Response */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    errors?: string[];
    total?: number;
}

export interface PagedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
