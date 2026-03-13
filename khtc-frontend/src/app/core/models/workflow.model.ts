// ============================================
// Model: Workflow — Hồ sơ nộp & Phê duyệt
// ============================================

/** Trạng thái hồ sơ */
export type TrangThaiHoSo = 'nhap' | 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'tra_lai';

/** Hồ sơ đã nộp (Submission) */
export interface HoSoNop {
    id: number;
    maHoSo: string;               // VD: "KHTC.2026.001"
    tieuDe: string;
    maDonVi: string;
    tenDonVi: string;
    maPhienBan: string;
    maBieuMau: string;
    trangThai: TrangThaiHoSo;
    nguoiTao: string;
    ngayTao: string;
    nguoiDuyet?: string;
    ngayDuyet?: string;
    ghiChu?: string;
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
