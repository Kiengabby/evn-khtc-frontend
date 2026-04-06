// ============================================
// Core Data Models — Planning Data
// Maps to: FACT_PLANNING_DATA
// ============================================

/** FACT_PLANNING_DATA */
export interface PlanningData {
    orgCode: string;
    accountCode: string;
    period: number;        // e.g., 202601
    scenarioCode: string;  // 'Plan' | 'Actual' | 'Forecast'
    versionCode: string;   // 'V1' | 'Final'
    value: number;
    year: number;
    currency?: string;
}

/** Point of View — Bộ lọc context khi nhập liệu */
export interface PointOfView {
    year: number;
    scenario: string;
    version: string;
    entityCode: string;
    formId?: string;
}

/** Cell data key — unique identifier for a cell value */
export interface CellDataKey {
    orgCode: string;
    accountCode: string;
    period: number;
    scenarioCode: string;
    versionCode: string;
}

/** Grid row data — represents one row in the Handsontable */
export interface GridRowData {
    rowKey: string;
    accountCode: string;
    accountName: string;
    unit?: string;
    dataStorage: 'STORE' | 'DYNAMIC_CALC' | 'LABEL';
    level: number;
    isLeaf: boolean;
    values: Record<string, number | null>;  // colKey → value
}

/** Save payload */
export interface SavePlanningPayload {
    pov: PointOfView;
    items: PlanningData[];
    submittedBy?: string;
}
