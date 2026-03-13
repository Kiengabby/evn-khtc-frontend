// ============================================
// Wizard Tạo Báo Cáo — Model
// ============================================

/** Trạng thái của mỗi bước wizard */
export type TrangThaiBuoc = 'chua_dien' | 'dang_dien' | 'da_hoan_thanh';

/** Một bước trong wizard */
export interface BuocWizard {
    soBuoc: number;
    tieuDe: string;
    moTa: string;
    trangThai: TrangThaiBuoc;
    icon: string;
}

/** Nhóm cột (ví dụ: "Thực hiện Tháng 12", "Lũy kế từ đầu năm") */
export interface NhomCot {
    tenNhom: string;
    danhSachCot: CotBaoCao[];
}

/** Một cột trong bảng báo cáo */
export interface CotBaoCao {
    id: string;
    tenCot: string;
    donViTinh: string;
    loai: 'nhap_lieu' | 'cong_thuc' | 'chi_tieu_text';
    congThuc?: string;          // Ví dụ: "=C3/C2"
    doRong?: number;
    format?: string;            // "#,##0.00"
}

/** Loại đơn vị được chọn */
export interface DonViBaoCao {
    maDonVi: string;
    tenDonVi: string;
    daChon: boolean;
    laHangTongCong?: boolean;   // Hàng tổng cộng (tính tổng)
    laNhom?: boolean;           // Nhóm (ví dụ: "I. Hạ áp")
}

/** Phân quyền cho biểu mẫu */
export interface QuyenBaoCao {
    maDonVi: string;
    tenDonVi: string;
    nguoiNhapLieu: string;      // username
    nguoiDuyet: string;         // username
    hanNop?: Date;
}

/** Toàn bộ dữ liệu wizard */
export interface DuLieuWizard {
    // Bước 1: Thông tin chung
    tenBaoCao: string;
    maBaoCao: string;
    moTa: string;
    kyBaoCao: 'thang' | 'quy' | 'nam';
    namBaoCao: number;
    thangBaoCao?: number;

    // Bước 2: Đơn vị báo cáo
    danhSachDonVi: DonViBaoCao[];

    // Bước 3: Thiết kế bảng (Handsontable)
    cotNoiDung: string;         // Tên cột đầu tiên (thường là "Nội dung")
    danhSachNhomCot: NhomCot[]; // Parsed từ grid cho summary
    gridNestedHeaders?: any[][];
    gridData?: any[][];
    gridColWidths?: number[];
    gridCotCoDinh?: number;
    gridMergeCells?: { row: number; col: number; rowspan: number; colspan: number }[];

    // Bước 4: Phân quyền
    danhSachQuyen: QuyenBaoCao[];

    // Metadata
    ngayTao?: Date;
    nguoiTao?: string;
}

/** Mẫu báo cáo cũ (từ năm trước) để load vào grid */
export interface MauBaoCaoCu {
    maTemplate: string;
    tenTemplate: string;
    kyBaoCao: string;
    namTao: number;
    cauTrucBang: {
        headerRows: any[][];
        dataRows: any[][];
        colWidths: number[];
        cotCoDinh: number;
    };
}

/** Giá trị mặc định cho wizard */
export function taoDuLieuWizardMacDinh(): DuLieuWizard {
    return {
        tenBaoCao: '',
        maBaoCao: '',
        moTa: '',
        kyBaoCao: 'thang',
        namBaoCao: new Date().getFullYear(),
        thangBaoCao: new Date().getMonth() + 1,
        danhSachDonVi: [],
        cotNoiDung: 'Nội dung',
        danhSachNhomCot: [],
        danhSachQuyen: [],
    };
}

/** Danh sách 5 bước */
export function taoDanhSachBuoc(): BuocWizard[] {
    return [
        { soBuoc: 1, tieuDe: 'Thông tin chung', moTa: 'Tên, kỳ báo cáo', trangThai: 'dang_dien', icon: 'info' },
        { soBuoc: 2, tieuDe: 'Đơn vị báo cáo', moTa: 'Chọn đơn vị nộp', trangThai: 'chua_dien', icon: 'business' },
        { soBuoc: 3, tieuDe: 'Thiết kế cột', moTa: 'Cấu trúc bảng', trangThai: 'chua_dien', icon: 'table' },
        { soBuoc: 4, tieuDe: 'Phân quyền', moTa: 'Ai nhập, ai duyệt', trangThai: 'chua_dien', icon: 'security' },
        { soBuoc: 5, tieuDe: 'Hoàn thành', moTa: 'Xem lại & xuất bản', trangThai: 'chua_dien', icon: 'check' },
    ];
}
