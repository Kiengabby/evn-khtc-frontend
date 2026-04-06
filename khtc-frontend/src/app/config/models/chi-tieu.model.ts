// ============================================
// Model: Chỉ tiêu (Account / Dimension Account)
// ============================================
// Đây là model đại diện cho "Chỉ tiêu" trong hệ thống KHTC.
// Chỉ tiêu là đơn vị nhỏ nhất của dữ liệu tài chính (VD: Doanh thu bán điện, Chi phí nhân công...)
//
// === INPUT (từ Backend API) ===
// GET /api/danh-muc/chi-tieu         → Lấy danh sách tất cả chỉ tiêu (flat list)
// GET /api/danh-muc/chi-tieu/tree    → Lấy cây chỉ tiêu (hierarchical)
// GET /api/danh-muc/chi-tieu/:id     → Lấy chi tiết 1 chỉ tiêu
// POST /api/danh-muc/chi-tieu        → Tạo chỉ tiêu mới
// PUT /api/danh-muc/chi-tieu/:id     → Cập nhật chỉ tiêu
// DELETE /api/danh-muc/chi-tieu/:id  → Xóa chỉ tiêu
//
// === OUTPUT (trả về cho Backend) ===
// Body của POST/PUT: ChiTieuCreateDto hoặc ChiTieuUpdateDto
// ============================================

/**
 * Loại lưu trữ dữ liệu của chỉ tiêu
 * - 'STORE': Lưu trữ trực tiếp (người dùng nhập tay)
 * - 'DYNAMIC_CALC': Tính toán tự động (tổng các con, công thức)
 * - 'LABEL_ONLY': Chỉ hiển thị nhãn, không chứa dữ liệu
 */
export type LoaiLuuTru = 'STORE' | 'DYNAMIC_CALC' | 'LABEL_ONLY';

/**
 * Phương thức tổng hợp khi hợp nhất dữ liệu từ đơn vị con lên cha
 * - 'SUM': Cộng tổng (VD: Doanh thu)
 * - 'AVG': Trung bình (VD: Giá trung bình)
 * - 'NONE': Không tổng hợp
 * - 'FORMULA': Tính theo công thức riêng
 */
export type PhuongThucTongHop = 'SUM' | 'AVG' | 'NONE' | 'FORMULA';

/**
 * Chỉ tiêu (Account) — Model chính
 *
 * Ví dụ 1 chỉ tiêu:
 * {
 *   id: 1,
 *   maChiTieu: 'DT_BAN_DIEN',
 *   tenChiTieu: 'Doanh thu bán điện',
 *   capDo: 2,
 *   maChiTieuCha: 'DOANH_THU',
 *   loaiLuuTru: 'STORE',
 *   phuongThucTongHop: 'SUM',
 *   donViTinh: 'Tỷ đồng',
 *   congThuc: null,
 *   thuTu: 1,
 *   trangThai: true
 * }
 */
export interface ChiTieu {
    id: number;                          // ID tự tăng (primary key)
    maChiTieu: string;                   // Mã chỉ tiêu (unique, VD: 'DT_BAN_DIEN')
    tenChiTieu: string;                  // Tên hiển thị (VD: 'Doanh thu bán điện')
    capDo: number;                       // Cấp độ trong cây (1 = gốc, 2 = con, 3 = cháu...)
    maChiTieuCha: string | null;        // Mã của chỉ tiêu cha (null nếu là gốc)
    loaiLuuTru: LoaiLuuTru;             // Store / Dynamic Calc / Label Only
    phuongThucTongHop: PhuongThucTongHop; // Cách tổng hợp lên cấp cha
    donViTinh: string;                   // Đơn vị tính (Tỷ đồng, kWh, %, Lít...)
    congThuc: string | null;             // Công thức HyperFormula (nếu DYNAMIC_CALC)
    thuTu: number;                       // Thứ tự sắp xếp trong cùng cấp
    trangThai: boolean;                  // true = đang dùng, false = đã ẩn
    ghiChu?: string;                     // Ghi chú bổ sung
    ngayTao?: string;                    // ISO date (do BE trả về)
    ngayCapNhat?: string;                // ISO date (do BE trả về)
    nguoiTao?: string;                   // Username người tạo
}

/**
 * Node cây chỉ tiêu — dùng cho TreeTable
 * Mở rộng từ ChiTieu, thêm trường children để tạo cây
 */
export interface ChiTieuNode extends ChiTieu {
    children?: ChiTieuNode[];           // Danh sách chỉ tiêu con
    expanded?: boolean;                  // TreeTable: đang mở/đóng
}

/**
 * DTO tạo mới chỉ tiêu — gửi lên Backend qua POST
 * (không có id, ngayTao, ngayCapNhat vì do BE sinh)
 */
export interface ChiTieuTaoMoi {
    maChiTieu: string;
    tenChiTieu: string;
    maChiTieuCha: string | null;
    loaiLuuTru: LoaiLuuTru;
    phuongThucTongHop: PhuongThucTongHop;
    donViTinh: string;
    congThuc?: string | null;
    thuTu?: number;
    ghiChu?: string;
}

/**
 * DTO cập nhật chỉ tiêu — gửi lên Backend qua PUT
 */
export interface ChiTieuCapNhat extends Partial<ChiTieuTaoMoi> {
    id: number;                          // Bắt buộc có ID
    trangThai?: boolean;
}

/**
 * Bộ lọc tìm kiếm chỉ tiêu — gửi dưới dạng query params
 * GET /api/danh-muc/chi-tieu?tuKhoa=doanh+thu&trangThai=true&trang=1&soBanGhi=25
 */
export interface ChiTieuBoLoc {
    tuKhoa?: string;                     // Từ khóa tìm kiếm (mã hoặc tên)
    loaiLuuTru?: LoaiLuuTru;            // Lọc theo loại
    trangThai?: boolean;                 // Lọc đang dùng / đã ẩn
    trang?: number;                      // Số trang (1-indexed)
    soBanGhi?: number;                   // Số bản ghi / trang (mặc định 25)
}
