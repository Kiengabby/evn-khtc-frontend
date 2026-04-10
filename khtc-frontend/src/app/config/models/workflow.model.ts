// ============================================
// Model: Workflow — Hồ sơ nộp & Phê duyệt
// ============================================

/** Trạng thái hồ sơ */
export type TrangThaiHoSo = 'nhap' | 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'tra_lai';

/** Hồ sơ đã nộp (Submission) */
export interface HoSoNop {
    id: number;
    submissionId?: string;           // UUID từ API (dùng khi edit)
    maHoSo: string;               // VD: "KHTC.2026.001"
    tieuDe: string;

    // Đơn vị (mã danh mục)
    entityCode: string;           // Mã danh mục (EVN, EVN_PC, EVN_TX, ...)
    entityName: string;           // Tên đơn vị

    // Báo cáo (Biểu mẫu)
    formCode: string;             // Mã báo cáo (KHTC_FINANCE_2026, ...)
    formName: string;             // Tên báo cáo

    // Kỳ báo cáo
    period?: string;              // Kỳ báo cáo (Q1, Q2, Tháng 01, ...)
    year?: number;                // Năm

    // Trạng thái & thời gian
    trangThai: TrangThaiHoSo;
    ngayTao: string;
    updatedAt?: string;           // Ngày cập nhật

    // Người dùng
    nguoiTao: string;
    nguoiDuyet?: string;
    ngayDuyet?: string;
    ghiChu?: string;

    // Phiên bản (legacy, keep for backward compatibility)
    maPhienBan?: string;
    maBieuMau?: string;
    maDonVi?: string;
    tenDonVi?: string;
}

/** Mục trong hộp thư phê duyệt */
export interface PheDuyetItem {
    id: number;
    hoSo: HoSoNop;
    ngayNhan: string;
    mucDoUuTien: 'cao' | 'trung_binh' | 'thap';
}

/** DTO hành động phê duyệt */
export interface PheDuyetDto {
    hoSoId: number;
    hanhDong: 'duyet' | 'tu_choi' | 'tra_lai';
    ghiChu?: string;
}

/** KPI Dashboard */
export interface ThongKeDashboard {
    doanhThu: number;
    chiPhi: number;
    loiNhuan: number;
    tyLeDuyet: number;
    tongHoSo: number;
    hoSoChoDuyet: number;
    hoSoDaDuyet: number;
    hoSoTuChoi: number;
    hoSoGanDay: HoSoNop[];
    tienDoTheoEntity: TienDoEntity[];
}

/** Tiến độ nộp báo cáo theo đơn vị */
export interface TienDoEntity {
    maDonVi: string;
    tenDonVi: string;
    tongBieuMau: number;
    daNop: number;
    daDuyet: number;
}
