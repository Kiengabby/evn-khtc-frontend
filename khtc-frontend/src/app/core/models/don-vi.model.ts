// ============================================
// Model: Đơn vị (Entity / Dimension Entity)
// ============================================
// Đại diện cho các đơn vị thành viên trong Tập đoàn EVN
// VD: Tập đoàn EVN > Tổng công ty EVNNPC > PC Nam Định
//
// === API Endpoints ===
// GET  /api/danh-muc/don-vi          → Danh sách đơn vị (flat/tree)
// GET  /api/danh-muc/don-vi/:id      → Chi tiết 1 đơn vị
// POST /api/danh-muc/don-vi          → Tạo đơn vị mới
// PUT  /api/danh-muc/don-vi/:id      → Cập nhật đơn vị
// ============================================

/**
 * Cấp đơn vị trong cây tổ chức
 */
export type CapDonVi = 'TAP_DOAN' | 'TONG_CONG_TY' | 'CONG_TY' | 'CHI_NHANH' | 'DIEN_LUC';

/**
 * Đơn vị (Entity) — Model chính
 *
 * Ví dụ:
 * {
 *   id: 10,
 *   maDonVi: 'PC_NAM_DINH',
 *   tenDonVi: 'Công ty Điện lực Nam Định',
 *   tenVietTat: 'PC Nam Định',
 *   capDonVi: 'CONG_TY',
 *   maDonViCha: 'EVNNPC',
 *   trangThai: true
 * }
 */
export interface DonVi {
    id: number;
    maDonVi: string;                     // Mã đơn vị (unique, VD: 'PC_NAM_DINH')
    tenDonVi: string;                    // Tên đầy đủ
    tenVietTat: string;                  // Tên viết tắt hiển thị trên báo cáo
    capDonVi: CapDonVi;                  // Cấp đơn vị
    maDonViCha: string | null;          // Mã đơn vị cha (null = gốc/Tập đoàn)
    trangThai: boolean;                  // Đang hoạt động / Ngừng
    diaChi?: string;
    soDienThoai?: string;
    maSoThue?: string;
    ghiChu?: string;
    ngayTao?: string;
    ngayCapNhat?: string;
}

/** Node cây đơn vị — cho TreeTable */
export interface DonViNode extends DonVi {
    children?: DonViNode[];
    expanded?: boolean;
}

/** DTO tạo mới đơn vị */
export interface DonViTaoMoi {
    maDonVi: string;
    tenDonVi: string;
    tenVietTat: string;
    capDonVi: CapDonVi;
    maDonViCha: string | null;
    diaChi?: string;
    soDienThoai?: string;
    maSoThue?: string;
    ghiChu?: string;
}
