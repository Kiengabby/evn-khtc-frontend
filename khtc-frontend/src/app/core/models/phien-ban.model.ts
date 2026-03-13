// ============================================
// Model: Phiên bản / Kịch bản (Version / Scenario)
// ============================================
// Dùng để phân biệt các bộ dữ liệu khác nhau:
// - Kế hoạch (Budget), Dự báo (Forecast), Thực hiện (Actual)
// - Mỗi Version có thể gắn với 1 Scenario (VD: Kịch bản lạc quan, bi quan)
//
// === API Endpoints ===
// GET  /api/danh-muc/phien-ban       → Danh sách phiên bản
// POST /api/danh-muc/phien-ban       → Tạo phiên bản mới
// PUT  /api/danh-muc/phien-ban/:id   → Cập nhật phiên bản
// ============================================

/**
 * Loại phiên bản
 */
export type LoaiPhienBan = 'KE_HOACH' | 'DU_BAO' | 'THUC_HIEN';

/**
 * Phiên bản (Version) — Model chính
 */
export interface PhienBan {
    id: number;
    maPhienBan: string;                  // VD: 'BUDGET_2026', 'FORECAST_Q1_2026'
    tenPhienBan: string;                 // VD: 'Kế hoạch năm 2026'
    loaiPhienBan: LoaiPhienBan;
    namKeHoach: number;                  // Năm tài chính (VD: 2026)
    trangThai: boolean;                  // Đang mở / Đã khóa
    laPhienBanMacDinh: boolean;         // Phiên bản mặc định khi mở form
    ghiChu?: string;
    ngayTao?: string;
    ngayCapNhat?: string;
}

/** DTO tạo phiên bản mới */
export interface PhienBanTaoMoi {
    maPhienBan: string;
    tenPhienBan: string;
    loaiPhienBan: LoaiPhienBan;
    namKeHoach: number;
    ghiChu?: string;
}
