// ============================================
// Mock API Service — giả lập Backend REST API
// Dựa trên Database Schema (main.tex)
// ============================================

import { Injectable } from '@angular/core';
import { Observable, of, delay, forkJoin, map } from 'rxjs';

// === INTERFACES DỰA TRÊN DATABASE SCHEMA ===

/** DIM_ACCOUNT */
export interface DimAccount {
  accountID: number;
  accountCode: string;
  accountName: string;
  parentID?: number;
  accountType: 'REVENUE' | 'EXPENSE' | 'ASSET';
  dataStorage: 'STORE' | 'DYNAMIC_CALC' | 'LABEL';
  operator: number;
  formula?: string;
  unit: string;
  isLeaf: boolean;
}

/** DIM_ENTITY */
export interface DimEntity {
  entityID: number;
  entityCode: string;
  entityName: string;
  parentID?: number;
  entityType: 'HOLDING' | 'PC' | 'GENCO';
  level: number;
  path: string;
}

/** SYS_FORM_VERSION — cấu hình layout biểu mẫu */
export interface FormLayoutConfig {
  versionID: number;
  formID: string;
  year: number;
  layoutJSON: {
    /** Mảng colKey tương ứng 1-1 với cột data (không gồm STT, Nội dung) */
    colKeys: string[];
    nestedHeaders: string[][];
    colWidths: number[];
    fixedColumnsStart: number;
  };
}

/** SYS_FORM_MAPPING */
export interface FormMapping {
  mappingID: number;
  versionID: number;
  rowKey: string;
  colKey: string;
  accountCode: string;
  isReadOnly: boolean;
  formula?: string;
  styleJSON?: any;
}

/** FACT_PLANNING_DATA */
export interface PlanningFactData {
  orgCode: string;
  accountCode: string;
  period: number;
  scenarioCode: 'PLAN' | 'ACTUAL' | 'FORECAST';
  versionCode: string;
  value: number;
  currency: string;
  year: number;
}

/** Request filter */
export interface FormDataRequest {
  formID: string;
  orgCode: string;
  year: number;
  scenarioCode: string;
  versionCode: string;
}

/** Composite response trả về khi load 1 biểu mẫu */
export interface FormDataResponse {
  accounts: DimAccount[];
  formLayout: FormLayoutConfig;
  mappings: FormMapping[];
  factData: PlanningFactData[];
}

@Injectable({ providedIn: 'root' })
export class MockApiService {

  // === API 1: Lấy cấu hình biểu mẫu (SYS_FORM_VERSION) ===
  getFormConfiguration(formID: string, year: number): Observable<FormLayoutConfig> {
    const layouts: Record<string, FormLayoutConfig> = {
      'F01_CP_IPP': {
        versionID: 1,
        formID: 'F01_CP_IPP',
        year,
        layoutJSON: {
          colKeys: ['C_BT', 'C_CD', 'C_TD', 'C_DD', 'C_TONG_SL', 'C_CP_MUA', 'C_THUE_TNN', 'C_DVMTR', 'C_CQKT', 'C_TONG_CP', 'C_GIA_BQ'],
          nestedHeaders: [
            ['STT', 'Nội dung', 'Sản lượng điện (kWh)', 'Sản lượng điện (kWh)', 'Sản lượng điện (kWh)', 'Sản lượng điện (kWh)', 'Tổng SL', 'Chi phí (Tỷ đồng)', 'Chi phí (Tỷ đồng)', 'Chi phí (Tỷ đồng)', 'Chi phí (Tỷ đồng)', 'Tổng CP', 'Giá bình quân'],
            ['STT', 'Nội dung', 'Bình thường', 'Cao điểm', 'Thấp điểm', 'Điện dư', 'Tổng SL', 'CP mua điện', 'Thuế TNN', 'Tiền DVMTR', 'Tiền CQ khai thác', 'Tổng CP', 'VNĐ/kWh']
          ],
          colWidths: [50, 250, 100, 100, 100, 100, 120, 120, 110, 110, 160, 130, 100],
          fixedColumnsStart: 2
        }
      },
      'F02_DOANH_THU': {
        versionID: 2,
        formID: 'F02_DOANH_THU',
        year,
        layoutJSON: {
          colKeys: ['SL_SH', 'SL_SX', 'SL_TONG', 'DT_SH', 'DT_SX', 'DT_TONG'],
          nestedHeaders: [
            ['STT', 'Nội dung', 'Sản lượng (MWh)', 'Sản lượng (MWh)', 'Sản lượng (MWh)', 'Doanh thu (Tỷ đồng)', 'Doanh thu (Tỷ đồng)', 'Doanh thu (Tỷ đồng)'],
            ['STT', 'Nội dung', 'Sinh hoạt', 'Sản xuất', 'Tổng SL', 'Sinh hoạt', 'Sản xuất', 'Tổng DT']
          ],
          colWidths: [50, 250, 120, 120, 130, 120, 120, 130],
          fixedColumnsStart: 2
        }
      }
    };

    // fallback layout cho biểu mẫu chưa cấu hình
    const layout = layouts[formID] ?? layouts['F02_DOANH_THU']!;
    return of(layout).pipe(delay(300));
  }

  // === API 2: Lấy danh mục chỉ tiêu (DIM_ACCOUNT) ===
  getAccountMaster(formID: string): Observable<DimAccount[]> {
    const mockAccounts: DimAccount[] = [
      {
        accountID: 1,
        accountCode: 'TONG_CP_IPP',
        accountName: 'TỔNG CHI PHÍ IPP',
        accountType: 'EXPENSE',
        dataStorage: 'DYNAMIC_CALC',
        operator: 1,
        formula: '[BAC_GIANG_1] + [BAC_KAN_1] + [BAC_ME] + [BAC_ME_1] + [BACH_DANG] + [BA_THUOC]',
        unit: 'Tỷ đồng',
        isLeaf: false
      },
      {
        accountID: 2,
        accountCode: 'BAC_GIANG_1',
        accountName: 'Bắc Giang 1',
        parentID: 1,
        accountType: 'EXPENSE',
        dataStorage: 'STORE',
        operator: 1,
        unit: 'Tỷ đồng', 
        isLeaf: true
      },
      {
        accountID: 3,
        accountCode: 'BAC_KAN_1',
        accountName: 'Bắc Kạn 1',
        parentID: 1,
        accountType: 'EXPENSE',
        dataStorage: 'STORE',
        operator: 1,
        unit: 'Tỷ đồng',
        isLeaf: true
      },
      {
        accountID: 4,
        accountCode: 'BAC_ME',
        accountName: 'Bắc Mê',
        parentID: 1,
        accountType: 'EXPENSE',
        dataStorage: 'STORE', 
        operator: 1,
        unit: 'Tỷ đồng',
        isLeaf: true
      },
      {
        accountID: 5,
        accountCode: 'BAC_ME_1',
        accountName: 'Bắc Mê 1',
        parentID: 1,
        accountType: 'EXPENSE',
        dataStorage: 'STORE',
        operator: 1,
        unit: 'Tỷ đồng',
        isLeaf: true
      },
      {
        accountID: 6,
        accountCode: 'BACH_DANG',
        accountName: 'Bạch Đằng',
        parentID: 1,
        accountType: 'EXPENSE',
        dataStorage: 'STORE',
        operator: 1,
        unit: 'Tỷ đồng',
        isLeaf: true
      },
      {
        accountID: 7,
        accountCode: 'BA_THUOC',
        accountName: 'Bà Thước',
        parentID: 1,
        accountType: 'EXPENSE',
        dataStorage: 'STORE',
        operator: 1,
        unit: 'Tỷ đồng',
        isLeaf: true
      }
    ];

    return of(mockAccounts).pipe(delay(200));
  }

  // === API 3: Lấy ánh xạ tọa độ (SYS_FORM_MAPPING) ===
  getFormMapping(versionID: number): Observable<FormMapping[]> {
    const mockMappings: FormMapping[] = [
      // Dòng tổng - các ô công thức
      { mappingID: 1, versionID: 1, rowKey: 'R_TONG', colKey: 'C_BT', accountCode: 'TONG_CP_IPP', isReadOnly: true, formula: '=SUM(C2:C7)' },
      { mappingID: 2, versionID: 1, rowKey: 'R_TONG', colKey: 'C_CD', accountCode: 'TONG_CP_IPP', isReadOnly: true, formula: '=SUM(D2:D7)' },
      { mappingID: 3, versionID: 1, rowKey: 'R_TONG', colKey: 'C_TD', accountCode: 'TONG_CP_IPP', isReadOnly: true, formula: '=SUM(E2:E7)' },
      
      // Dòng chi tiết - có thể nhập liệu
      { mappingID: 4, versionID: 1, rowKey: 'R01', colKey: 'C_BT', accountCode: 'BAC_GIANG_1', isReadOnly: false },
      { mappingID: 5, versionID: 1, rowKey: 'R01', colKey: 'C_CD', accountCode: 'BAC_GIANG_1', isReadOnly: false },
      { mappingID: 6, versionID: 1, rowKey: 'R01', colKey: 'C_TD', accountCode: 'BAC_GIANG_1', isReadOnly: false },
      { mappingID: 7, versionID: 1, rowKey: 'R01', colKey: 'C_TONG_SL', accountCode: 'BAC_GIANG_1', isReadOnly: true, formula: '=C1+D1+E1+F1' },
      
      { mappingID: 8, versionID: 1, rowKey: 'R02', colKey: 'C_BT', accountCode: 'BAC_KAN_1', isReadOnly: false },
      { mappingID: 9, versionID: 1, rowKey: 'R02', colKey: 'C_CD', accountCode: 'BAC_KAN_1', isReadOnly: false },
      { mappingID: 10, versionID: 1, rowKey: 'R02', colKey: 'C_TD', accountCode: 'BAC_KAN_1', isReadOnly: false },
      { mappingID: 11, versionID: 1, rowKey: 'R02', colKey: 'C_TONG_SL', accountCode: 'BAC_KAN_1', isReadOnly: true, formula: '=C2+D2+E2+F2' }
    ];

    return of(mockMappings).pipe(delay(250));
  }

  // === API 4: Lấy dữ liệu thực tế (FACT_PLANNING_DATA) ===
  getPlanningData(request: FormDataRequest): Observable<PlanningFactData[]> {
    const mockFactData: PlanningFactData[] = [
      // BAC_GIANG_1 data
      { orgCode: 'EVNNPC', accountCode: 'BAC_GIANG_1', period: 202601, scenarioCode: 'PLAN', versionCode: 'V1', value: 1250.5, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BAC_GIANG_1', period: 202602, scenarioCode: 'PLAN', versionCode: 'V1', value: 980.2, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BAC_GIANG_1', period: 202603, scenarioCode: 'PLAN', versionCode: 'V1', value: 760.1, currency: 'VND', year: 2026 },
      
      // BAC_KAN_1 data  
      { orgCode: 'EVNNPC', accountCode: 'BAC_KAN_1', period: 202601, scenarioCode: 'PLAN', versionCode: 'V1', value: 1180.3, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BAC_KAN_1', period: 202602, scenarioCode: 'PLAN', versionCode: 'V1', value: 920.4, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BAC_KAN_1', period: 202603, scenarioCode: 'PLAN', versionCode: 'V1', value: 710.6, currency: 'VND', year: 2026 },

      // BAC_ME data
      { orgCode: 'EVNNPC', accountCode: 'BAC_ME', period: 202601, scenarioCode: 'PLAN', versionCode: 'V1', value: 890.7, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BAC_ME', period: 202602, scenarioCode: 'PLAN', versionCode: 'V1', value: 750.8, currency: 'VND', year: 2026 },

      // BAC_ME_1 data
      { orgCode: 'EVNNPC', accountCode: 'BAC_ME_1', period: 202601, scenarioCode: 'PLAN', versionCode: 'V1', value: 1350.2, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BAC_ME_1', period: 202602, scenarioCode: 'PLAN', versionCode: 'V1', value: 1120.5, currency: 'VND', year: 2026 },

      // BACH_DANG data
      { orgCode: 'EVNNPC', accountCode: 'BACH_DANG', period: 202601, scenarioCode: 'PLAN', versionCode: 'V1', value: 2100.1, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BACH_DANG', period: 202602, scenarioCode: 'PLAN', versionCode: 'V1', value: 1850.3, currency: 'VND', year: 2026 },

      // BA_THUOC data
      { orgCode: 'EVNNPC', accountCode: 'BA_THUOC', period: 202601, scenarioCode: 'PLAN', versionCode: 'V1', value: 675.8, currency: 'VND', year: 2026 },
      { orgCode: 'EVNNPC', accountCode: 'BA_THUOC', period: 202602, scenarioCode: 'PLAN', versionCode: 'V1', value: 580.2, currency: 'VND', year: 2026 }
    ];

    // Filter theo request
    const filtered = mockFactData.filter(item => 
      item.orgCode === request.orgCode &&
      item.scenarioCode === request.scenarioCode &&
      item.versionCode === request.versionCode &&
      item.year === request.year
    );

    return of(filtered).pipe(delay(400));
  }

  // === API 5: Load toàn bộ dữ liệu form (composite) ===
  loadFormData(request: FormDataRequest): Observable<FormDataResponse> {
    return forkJoin({
      accounts:   this.getAccountMaster(request.formID),
      formLayout: this.getFormConfiguration(request.formID, request.year),
      mappings:   this.getFormMapping(1),
      factData:   this.getPlanningData(request)
    });
  }

  // === API 6: Save changes ===
  savePlanningData(changes: any[], request: FormDataRequest): Observable<boolean> {
    console.log('📊 Saving changes:', changes);
    console.log('📋 Form context:', request);
    
    // Simulate API call
    return of(true).pipe(delay(800));
  }

  // === API 7: Lấy danh mục đơn vị ===
  getEntityMaster(): Observable<DimEntity[]> {
    const mockEntities: DimEntity[] = [
      { entityID: 1, entityCode: 'EVN', entityName: 'Tập đoàn Điện lực Việt Nam', entityType: 'HOLDING', level: 1, path: '/1/' },
      { entityID: 2, entityCode: 'EVNNPC', entityName: 'TCT Điện lực miền Bắc', parentID: 1, entityType: 'PC', level: 2, path: '/1/2/' },
      { entityID: 3, entityCode: 'EVNCPC', entityName: 'TCT Điện lực miền Trung', parentID: 1, entityType: 'PC', level: 2, path: '/1/3/' },
      { entityID: 4, entityCode: 'EVNSPC', entityName: 'TCT Điện lực miền Nam', parentID: 1, entityType: 'PC', level: 2, path: '/1/4/' },
      { entityID: 5, entityCode: 'EVNHCMC', entityName: 'TCT Điện lực TP.HCM', parentID: 1, entityType: 'PC', level: 2, path: '/1/5/' },
      { entityID: 6, entityCode: 'EVNHANOI', entityName: 'TCT Điện lực Hà Nội', parentID: 1, entityType: 'PC', level: 2, path: '/1/6/' }
    ];

    return of(mockEntities).pipe(delay(200));
  }
}