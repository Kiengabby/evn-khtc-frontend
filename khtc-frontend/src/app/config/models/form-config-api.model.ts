// ============================================
// Core Data Models — FormConfig API (BE v2)
// Endpoints:
//   POST /api/v2/FormTemplate/save-form
//   POST /api/v2/FormConfig/save-form-config
//   GET  /api/v2/PlanningData/load-form
//
// Khớp với Swagger v2 tại http://10.1.117.143:9090
// ============================================

// ─── FormTemplate (Step 1: Tạo biểu mẫu) ───

/** Payload gửi lên /api/v2/FormTemplate/save-form */
export interface FormTemplateSaveRequest {
    /** UUID — null/empty khi tạo mới, có giá trị khi update */
    formID: string | null;
    /** Mã biểu mẫu duy nhất (e.g. "KHTC_SXKD_03") */
    formCode: string;
    /** Tên hiển thị */
    formName: string;
    /** Trạng thái hoạt động */
    isActive: boolean;
    /** Danh sách đơn vị áp dụng (comma-separated hoặc JSON string) */
    appliedEntities: string;
    /**
     * Mã loại biểu mẫu (e.g. "THANG", "QUY", "NAM", "THANG_QUY", "KY").
     * Xác định danh sách kỳ báo cáo hợp lệ cho biểu mẫu này.
     */
    formTypeCode?: string;
    /**
     * Danh sách kỳ báo cáo được phép (JSON array string hoặc comma-separated).
     * VD: '["T01","T02","T03","Q1"]'
     */
    allowedPeriods?: string;
}

// ─── FormConfig (Step 2: Lưu layout + mappings) ───

/** Payload gửi lên /api/v2/FormConfig/save-form-config */
export interface FormConfigSaveRequest {
    /** Mã biểu mẫu — phải tồn tại trên BE (đã được tạo bởi save-form) */
    formID: string;
    /** Năm phiên bản */
    year: number;
    /** Layout JSON dạng string (JSON.stringify của toàn bộ layout object) */
    layoutJSON: string;
    /** Ngày hiệu lực (ISO 8601) */
    effectiveDate: string;
    /** Ngày hết hạn (ISO 8601) */
    expiryDate: string;
    /** Danh sách mapping ô */
    mappings: FormConfigMappingItem[];
}

/** 1 mapping item trong request */
export interface FormConfigMappingItem {
    /** Mã dòng (e.g. "CHITIEU_01") */
    rowCode: string;
    /** Mã cột (e.g. "ACTUAL_N2") */
    colCode: string;
    /** Giá trị mặc định của ô (0 nếu không có) */
    value: number;
    /** Mã tài khoản kế toán liên kết */
    accountCode: string;
    /** Mã thuộc tính bổ sung */
    attributeCode: string;
    /** Công thức HyperFormula nếu có */
    formula: string;
    /** true = ô chỉ đọc */
    isReadOnly: boolean;
}

// ─── PlanningData (Data Entry) ──────────────

/** Params cho GET /api/v2/PlanningData/load-form */
export interface LoadFormParams {
    formId: string;
    entityCode: string;
    year: number;
    period?: string;
    scenario?: string;
}

/** Payload gửi lên POST /api/v2/PlanningData/save-submission */
export interface SubmissionSaveRequest {
    submissionId: number;
    entityCode: string;
    /** JSON string chứa dữ liệu đã nhập */
    jsonData: string;
}

// ─── Response (chung cho tất cả API) ────────

/** Response chuẩn từ BE (format .NET) */
export interface FormConfigApiResponse<T = any> {
    succeeded: boolean;
    message: string;
    data: T | null;
    errors: string[];
    statusCode: number;
    errorCode: number;
}

// ─── Normalizer (.NET PascalCase → camelCase) ───

/**
 * BE .NET trả về PascalCase: { Succeeded, Message, Data, Errors, StatusCode, ErrorCode }
 * FE dùng camelCase:         { succeeded, message, data, errors, statusCode, errorCode }
 *
 * Hàm này chuyển đổi response BE → FE, hỗ trợ cả 2 casing.
 */
export function normalizeApiResponse<T = any>(raw: any): FormConfigApiResponse<T> {
    if (!raw || typeof raw !== 'object') {
        return {
            succeeded: false,
            message: 'Response rỗng hoặc không hợp lệ',
            data: null,
            errors: [],
            statusCode: 0,
            errorCode: 0,
        };
    }
    return {
        succeeded: raw.Succeeded ?? raw.succeeded ?? false,
        message:   raw.Message   ?? raw.message   ?? '',
        data:      (raw.Data !== undefined ? raw.Data : raw.data) ?? null,
        errors:    raw.Errors    ?? raw.errors    ?? [],
        statusCode: raw.StatusCode ?? raw.statusCode ?? 0,
        errorCode:  raw.ErrorCode  ?? raw.errorCode  ?? 0,
    };
}

