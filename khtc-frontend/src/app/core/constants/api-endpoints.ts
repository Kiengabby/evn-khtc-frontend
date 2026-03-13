// ============================================
// API Endpoints Constants
// ============================================

export const API_ENDPOINTS = {
    // Auth
    AUTH: {
        LOGIN: '/api/auth/login',
        LOGOUT: '/api/auth/logout',
        REFRESH: '/api/auth/refresh',
        PROFILE: '/api/auth/profile',
    },

    // Dimensions
    ACCOUNT: {
        LIST: '/api/dimensions/accounts',
        TREE: '/api/dimensions/accounts/tree',
        GET: (id: number) => `/api/dimensions/accounts/${id}`,
        CREATE: '/api/dimensions/accounts',
        UPDATE: (id: number) => `/api/dimensions/accounts/${id}`,
        DELETE: (id: number) => `/api/dimensions/accounts/${id}`,
    },

    ENTITY: {
        LIST: '/api/dimensions/entities',
        TREE: '/api/dimensions/entities/tree',
        GET: (id: number) => `/api/dimensions/entities/${id}`,
        CREATE: '/api/dimensions/entities',
        UPDATE: (id: number) => `/api/dimensions/entities/${id}`,
        DELETE: (id: number) => `/api/dimensions/entities/${id}`,
    },

    VERSION: {
        LIST: '/api/dimensions/versions',
        GET: (code: string) => `/api/dimensions/versions/${code}`,
        CREATE: '/api/dimensions/versions',
        UPDATE: (code: string) => `/api/dimensions/versions/${code}`,
    },

    // Form Templates
    TEMPLATE: {
        LIST: '/api/forms/templates',
        GET: (id: string) => `/api/forms/templates/${id}`,
        CREATE: '/api/forms/templates',
        UPDATE: (id: string) => `/api/forms/templates/${id}`,
        VERSIONS: (id: string) => `/api/forms/templates/${id}/versions`,
        MAPPING: (versionId: number) => `/api/forms/versions/${versionId}/mappings`,
    },

    // Planning Data
    PLANNING: {
        GET_DATA: '/api/planning/data',
        SAVE_DATA: '/api/planning/data',
        VALIDATE: '/api/planning/validate',
    },

    // Workflow
    WORKFLOW: {
        SUBMIT: '/api/workflow/submit',
        APPROVE: '/api/workflow/approve',
        REJECT: '/api/workflow/reject',
        HISTORY: (submissionId: number) => `/api/workflow/submissions/${submissionId}/history`,
        INBOX: '/api/workflow/inbox',
    },

    // System
    USERS: {
        LIST: '/api/system/users',
        GET: (id: number) => `/api/system/users/${id}`,
        CREATE: '/api/system/users',
        UPDATE: (id: number) => `/api/system/users/${id}`,
    },

    ROLES: {
        LIST: '/api/system/roles',
        PERMISSIONS: (roleId: number) => `/api/system/roles/${roleId}/permissions`,
    },

    MENU: {
        LIST: '/api/system/menus',
        TREE: '/api/system/menus/tree',
    },

    // Analytics
    ANALYTICS: {
        VARIANCE: '/api/analytics/variance',
        CONSOLIDATION: '/api/analytics/consolidation',
        KPI: '/api/analytics/kpi',
    },

    // Export
    EXPORT: {
        EXCEL: '/api/export/excel',
        PDF: '/api/export/pdf',
    },
} as const;
