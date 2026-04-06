// ============================================
// App Constants
// ============================================

export const APP_CONSTANTS = {
    APP_NAME: 'Hệ thống Kế hoạch Tài chính',
    APP_SHORT_NAME: 'KHTC',
    VERSION: '1.0.0',

    // LocalStorage keys
    STORAGE_KEYS: {
        USER_INFO: 'KHTC_USER_INFO',
        TOKEN: 'KHTC_TOKEN',
        REFRESH_TOKEN: 'KHTC_REFRESH_TOKEN',
        CONFIG: 'KHTC_CONFIG',
        THEME: 'KHTC_THEME',
        SIDEBAR_COLLAPSED: 'KHTC_SIDEBAR_COLLAPSED',
        LAST_POV: 'KHTC_LAST_POV',
    },

    // Default pagination
    DEFAULT_PAGE_SIZE: 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100],

    // Date formats
    DATE_FORMAT: 'dd/MM/yyyy',
    DATETIME_FORMAT: 'dd/MM/yyyy HH:mm',

    // Number format
    DECIMAL_PLACES: 2,
    THOUSAND_SEPARATOR: '.',
    DECIMAL_SEPARATOR: ',',

    // Scenarios
    SCENARIOS: ['Plan', 'Actual', 'Forecast'] as const,

    // Data Storage types
    DATA_STORAGE_TYPES: [
        { value: 'STORE', label: 'Cho phép nhập liệu' },
        { value: 'DYNAMIC_CALC', label: 'Tự động tính' },
        { value: 'LABEL', label: 'Chỉ tiêu đề' },
    ] as const,

    // Workflow statuses
    WORKFLOW_STATUS: {
        DRAFT: 'DRAFT',
        SUBMITTED: 'SUBMITTED',
        IN_REVIEW: 'IN_REVIEW',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
    } as const,
} as const;
