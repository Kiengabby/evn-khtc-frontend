// ============================================
// Core Data Models — Layout Template (New Format)
// Dùng cho Data Mapping Layer: Save/Load dữ liệu
// giữa Handsontable grid và Backend API.
//
// Khác với TemplateJson (dimension-based cũ),
// format này dùng colCode/rowCode để định danh ô.
// ============================================

// ─── Column Definition ───────────────────────

/** Định nghĩa 1 cột trong layoutJSON */
export interface LayoutColumnDef {
    /** Tọa độ cột dạng chữ cái: A, B, C, D… */
    key: string;
    /** Mã định danh ngữ nghĩa duy nhất: "METADATA_ROW", "STT", "ACTUAL_N2", "PLAN_N"… */
    colCode: string;
    /** Tiêu đề hiển thị ở header dòng cuối */
    title: string;
    /** Độ rộng pixel */
    width: number;
    /** Kiểu dữ liệu */
    type: 'text' | 'numeric';
    /** true = user không được sửa (cột STT, tên chỉ tiêu, cột ẩn…) */
    readOnly: boolean;
}

// ─── Row Definition ──────────────────────────

/** Định nghĩa 1 dòng dữ liệu trong layoutJSON.rows */
export interface LayoutRowDef {
    /** Tọa độ dòng: R4, R5, R6… */
    rowKey: string;
    /** Mã định danh ngữ nghĩa duy nhất: "TONG_CONG_F", "CHITIEU_01"… */
    rowCode: string;
    /** Tên hiển thị: "Tổng cộng", "Chỉ tiêu con 1"… */
    title: string;
    /** Mức lùi đầu dòng (0 = gốc, 1 = con, 2 = cháu…) */
    level: number;
    /** true = dòng tổng/công thức, không cho nhập */
    isReadOnly?: boolean;
    /** Công thức (nếu có) dạng HyperFormula: "=SUM(D3:D4)" */
    formula?: string;
}

// ─── Header Definition ──────────────────────

/** Định nghĩa 1 ô trong header row */
export interface LayoutHeaderCell {
    /** Chữ hiển thị trên header */
    label: string;
    /** Tọa độ cột tương ứng (key của LayoutColumnDef) */
    colKey: string;
    /** Số cột gộp ngang (optional) */
    colspan?: number;
    /** Số dòng gộp dọc (optional) */
    rowspan?: number;
}

/** 1 dòng header (bảng có thể có 2+ dòng header) */
export interface LayoutHeaderRow {
    cells: LayoutHeaderCell[];
}

// ─── Mapping (Formula cells) ────────────────

/** Mapping cho ô công thức trong lưới */
export interface LayoutCellMapping {
    rowKey: string;
    colKey: string;
    rowCode: string;
    colCode: string;
    cellRole: 'formula' | 'data' | 'header';
    formula?: string;
    isReadOnly: boolean;
}

// ─── LayoutJSON (Core) ──────────────────────

/** Cấu trúc JSON chính mô tả toàn bộ layout của bảng */
export interface LayoutJSON {
    /** Danh sách cột từ trái sang phải */
    columns: LayoutColumnDef[];
    /** Danh sách dòng header (mỗi phần tử = 1 tầng header) */
    headerRows: LayoutHeaderRow[];
    /** Danh sách dòng dữ liệu (không bao gồm header) */
    rows: LayoutRowDef[];
    /** Danh sách merge ô header (optional) */
    mergeCells?: MergeCellDef[];
    /** Số dòng header cố định trên cùng */
    fixedRowsTop: number;
    /** Số cột cố định bên trái */
    freezeColumns: number;
    /** Mappings cho các ô công thức (optional) */
    mappings?: LayoutCellMapping[];
}

export interface MergeCellDef {
    row: number;
    col: number;
    rowspan: number;
    colspan: number;
}

// ─── Template Root ──────────────────────────

/** Template gốc — chứa metadata + version layout */
export interface LayoutTemplate {
    formId: string;
    formName: string;
    version: {
        year: number;
        layoutJSON: LayoutJSON;
    };
}

// ─── Data Exchange (API payloads) ───────────

/** 1 ô dữ liệu: giao điểm rowCode × colCode = value */
export interface GridCellData {
    rowCode: string;
    colCode: string;
    value: number | string | null;
}

/** Payload gửi lên API khi Save */
export interface SaveGridPayload {
    formId: string;
    version_year: number;
    orgId: string;
    /** Kỳ báo cáo (VD: '12', 'Q1') */
    period?: string;
    /** Kịch bản (VD: 'Kế hoạch', 'Thực hiện') */
    scenario?: string;
    data: GridCellData[];
}

/** Response từ API khi Load */
export interface LoadGridResponse {
    template: LayoutTemplate;
    dbData: GridCellData[];
}
