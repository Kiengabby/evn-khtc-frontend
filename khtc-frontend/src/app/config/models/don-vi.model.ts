// ============================================
// Model: Đơn vị (DimEntity)
// ============================================
// Khớp với API BE: /api/v2/DimEntity
// GET  /api/v2/DimEntity/get-all
// POST /api/v2/DimEntity/create
// POST /api/v2/DimEntity/update/{id}
// POST /api/v2/DimEntity/delete/{id}
// ============================================

/** Dữ liệu đơn vị trả về từ BE (GET /api/v2/DimEntity/get-all) */
export interface DimEntity {
    id: string;
    entityCode: string;
    entityName: string;
    description: string | null;
    parentId: string | null;
    parentName: string | null;
    isActive: boolean;
    created: string | null;
    createdBy: string | null;
    lastModified: string | null;
    lastModifiedBy: string | null;
}

/** Payload gửi lên khi tạo mới hoặc cập nhật đơn vị */
export interface DimEntitySaveRequest {
    entityCode: string;
    entityName: string;
    description: string | null;
    parentId: string | null;
    isActive: boolean;
}

/** Form state nội bộ trong component */
export interface DimEntityForm {
    entityCode: string;
    entityName: string;
    description: string;
    parentId: string | null;
    isActive: boolean;
}

// ============================================
// Legacy types — backward compatibility
// Các component cũ (analytics...) vẫn dùng DonVi
// ============================================

/** @deprecated Dùng DimEntity thay thế */
export type CapDonVi = 'TAP_DOAN' | 'TONG_CONG_TY' | 'CONG_TY' | 'CHI_NHANH' | 'DIEN_LUC';

/** @deprecated Dùng DimEntity thay thế */
export interface DonVi {
    id: string | number;
    maDonVi: string;
    tenDonVi: string;
    tenVietTat: string;
    capDonVi: CapDonVi;
    maDonViCha: string | null;
    trangThai: boolean;
    diaChi?: string;
    soDienThoai?: string;
    maSoThue?: string;
    ghiChu?: string;
    ngayTao?: string;
    ngayCapNhat?: string;
}

/** @deprecated Dùng DimEntitySaveRequest thay thế */
export interface DonViTaoMoi {
    maDonVi: string;
    tenDonVi: string;
    tenVietTat: string;
    capDonVi: CapDonVi;
    maDonViCha: string | null;
    diaChi?: string;
    ghiChu?: string;
}
