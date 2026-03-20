// ============================================
// Core Data Models — Form Template
// Maps to: SYS_FORM_TEMPLATE, SYS_FORM_VERSION, SYS_FORM_MAPPING
// ============================================

/** SYS_FORM_TEMPLATE */
export interface FormTemplate {
    formId: string;
    formName: string;
    layoutConfig: FormLayoutSummary;
    isDynamicRow: boolean;
    orgList: string[];
    ngayTao?: string;
    ngayCapNhat?: string;
}

/** Summary layout info stored on the template */
export interface FormLayoutSummary {
    type: string;
    allowDynamicRows: boolean;
    freezeColumns: number;
}

/** DTO for creating a template */
export interface FormTemplateTaoMoi {
    formId: string;
    formName: string;
    orgList: string[];
    isDynamicRow: boolean;
    layoutConfig: FormLayoutSummary;
}

/** SYS_FORM_VERSION */
export interface FormVersion {
    versionId: number;
    formId: string;
    year: number;
    layoutJSON: FormLayoutConfig;
    createdAt?: string;
    updatedAt?: string;
}

/** Cấu trúc JSON cho Handsontable layout */
export interface FormLayoutConfig {
    // Handsontable settings
    columns: ColumnConfig[];
    mergeCells?: MergeCell[];
    fixedRowsTop?: number;
    fixedColumnsLeft?: number;
    hiddenColumns?: {
        columns: number[];
        indicators: boolean;
    };

    // Header rows
    headerRows: HeaderRow[];

    // Row definitions
    rows?: LayoutRowDef[];

    // Metadata
    formTitle?: string;
    description?: string;
    unitLabel?: string;
}

/** Column definition for a form */
export interface ColumnConfig {
    key: string;           // e.g., 'A', 'B'
    colCode?: string;      // e.g., 'ACTUAL_N2', 'PLAN_N'
    title: string;
    width?: number;
    type?: 'text' | 'numeric' | 'dropdown';
    format?: string;       // Number format
    readOnly?: boolean;
}

/** Row definition for a form (used in new layoutJSON format) */
export interface LayoutRowDef {
    rowKey: string;
    rowCode: string;
    title: string;
    level: number;
    isReadOnly?: boolean;
}

/** Column definition from mock JSON */
export interface ColumnDefinition {
    colKey: string;
    colName: string;
    groupHeader?: string;
    dataType: 'numeric' | 'formula' | 'text';
    width: number;
    format: string;
    formula?: string;
    isEditable: boolean;
}

export interface HeaderRow {
    cells: HeaderCell[];
}

export interface HeaderCell {
    label: string;
    colKey?: string;   // e.g. 'A','B' — để BE map chính xác cột
    colspan?: number;
    rowspan?: number;
    className?: string;
}

export interface MergeCell {
    row: number;
    col: number;
    rowspan: number;
    colspan: number;
}

/** SYS_FORM_MAPPING */
export interface FormMapping {
    mappingId: number;
    versionId: number;
    rowKey: string;        // UUID hoặc R1, R2...
    colKey: string;        // e.g., 'A', 'B'
    rowCode?: string;      // metadata row identifier
    colCode?: string;      // metadata col identifier
    accountCode: string;
    isReadOnly?: boolean;
    formula?: string;      // HyperFormula formula
    styleJSON?: string;    // Custom cell style
}
