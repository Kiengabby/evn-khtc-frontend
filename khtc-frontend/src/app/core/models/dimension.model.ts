// ============================================
// Core Data Models — Dimensions
// Maps to: DIM_ACCOUNT, DIM_ENTITY, DIM_VERSION
// ============================================

/** DIM_ACCOUNT — Cây chỉ tiêu tài chính */
export interface DimAccount {
  accountId: number;
  accountCode: string;
  accountName: string;
  parentId: number | null;
  accountType: 'REVENUE' | 'EXPENSE' | 'ASSET' | 'LIABILITY' | 'OTHER';
  dataStorage: 'STORE' | 'DYNAMIC_CALC' | 'LABEL';
  operator: 1 | -1;
  formula: string | null;
  unit: string | null;
  isLeaf: boolean;
  sortOrder?: number;
  level?: number;
  path?: string;
  children?: DimAccount[];
}

/** DIM_ENTITY — Cây tổ chức đơn vị */
export interface DimEntity {
  entityId: number;
  entityCode: string;
  entityName: string;
  parentId: number | null;
  entityType: 'HOLDING' | 'GENCO' | 'PC' | 'NPT' | 'OTHER';
  level: number;
  path: string;
  isActive: boolean;
  children?: DimEntity[];
}

/** DIM_VERSION — Phiên bản số liệu */
export interface DimVersion {
  versionCode: string;
  versionName?: string;
  versionType: 'PLAN' | 'FORECAST' | 'ACTUAL';
  sortOrder: number;
  isLocked: boolean;
}

/** Kịch bản (Scenario) */
export type Scenario = 'Plan' | 'Actual' | 'Forecast';

/** Period Helper */
export interface PeriodInfo {
  year: number;
  month?: number;       // 1-12
  quarter?: number;     // 1-4
  periodKey: number;    // e.g., 202601
  label: string;        // e.g., "Tháng 1/2026"
}
