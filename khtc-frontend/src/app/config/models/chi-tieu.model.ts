// ============================================
// Model: Chỉ tiêu (Dimension Account)
// ============================================
// Ánh xạ từ BE API /api/v2/DimAccount/*
//
// BE Request/Response fields:
//   accountCode, accountName, parentAccountId (UUID),
//   accountType (int), dataStorage (string),
//   formula, unit, orderIndex
//
// FE dùng tên Việt hóa để dễ đọc trong component,
// ChiTieuService sẽ map qua lại giữa BE ↔ FE.
// ============================================

/**
 * Loại lưu trữ dữ liệu của chỉ tiêu (ánh xạ từ field "dataStorage" bên BE)
 * - 'STORE'        : Lưu trữ trực tiếp (người dùng nhập tay)
 * - 'DYNAMIC_CALC' : Tính toán tự động (tổng các con, công thức)
 * - 'LABEL_ONLY'   : Chỉ hiển thị nhãn, không chứa dữ liệu
 */
export type LoaiLuuTru = 'STORE' | 'DYNAMIC_CALC' | 'LABEL_ONLY';

/**
 * Loại tài khoản (ánh xạ từ field "accountType" bên BE)
 * - 0: Tài khoản thường (nhập liệu bình thường)
 * - 1: Tài khoản nhóm (tổng hợp từ các tài khoản con)
 */
export type AccountType = 0 | 1;

/**
 * Chỉ tiêu (DimAccount) — Model FE
 *
 * Ví dụ:
 * {
 *   id: 'b4e2b9a2-a6bf-47d8-a5ce-841f0a8ee045',  // UUID từ BE
 *   maChiTieu: 'DT_BAN_DIEN',
 *   tenChiTieu: 'Doanh thu bán điện',
 *   capDo: 2,
 *   maChiTieuCha: 'DOANH_THU',
 *   idChiTieuCha: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
 *   loaiTaiKhoan: 0,
 *   loaiLuuTru: 'STORE',
 *   congThuc: null,
 *   donViTinh: 'Tỷ đồng',
 *   thuTu: 1,
 * }
 */
export interface ChiTieu {
    id: string;                          // UUID — primary key (accountId từ BE)
    maChiTieu: string;                   // Mã chỉ tiêu (accountCode, VD: 'DT_BAN_DIEN')
    tenChiTieu: string;                  // Tên hiển thị (accountName)
    capDo: number;                       // Cấp độ trong cây (0=gốc, 1=con, 2=cháu...)
    maChiTieuCha: string | null;        // Mã của chỉ tiêu cha (accountCode của cha)
    idChiTieuCha: string | null;        // UUID của chỉ tiêu cha (parentAccountId)
    loaiTaiKhoan: AccountType;           // accountType: 0=Thường, 1=Nhóm
    loaiLuuTru: LoaiLuuTru;             // dataStorage: STORE/DYNAMIC_CALC/LABEL_ONLY
    congThuc: string | null;             // formula — công thức HyperFormula
    donViTinh: string;                   // unit — đơn vị tính
    thuTu: number;                       // orderIndex — thứ tự hiển thị
}

/**
 * Node cây chỉ tiêu — dùng cho TreeTable (nếu cần)
 */
export interface ChiTieuNode extends ChiTieu {
    children?: ChiTieuNode[];
    expanded?: boolean;
}

/**
 * DTO tạo mới chỉ tiêu — map sang BE request body
 * POST /api/v2/DimAccount/create
 */
export interface ChiTieuTaoMoi {
    maChiTieu: string;              // → accountCode
    tenChiTieu: string;             // → accountName
    idChiTieuCha: string | null;   // → parentAccountId (UUID)
    loaiTaiKhoan: AccountType;      // → accountType
    loaiLuuTru: LoaiLuuTru;        // → dataStorage
    congThuc: string;               // → formula
    donViTinh: string;              // → unit
    thuTu: number;                  // → orderIndex
}

/**
 * DTO cập nhật chỉ tiêu — map sang BE request body
 * PUT /api/v2/DimAccount/update/{id}
 */
export interface ChiTieuCapNhat extends ChiTieuTaoMoi {
    id: string;                     // UUID — bắt buộc
}

/**
 * Bộ lọc tìm kiếm (xử lý client-side vì BE không hỗ trợ filter trên get-tree)
 */
export interface ChiTieuBoLoc {
    tuKhoa?: string;                // Từ khóa tìm mã hoặc tên
    loaiLuuTru?: LoaiLuuTru;       // Lọc theo loại lưu trữ
}
