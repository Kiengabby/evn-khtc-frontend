// ============================================
// GridDataService — chuyển đổi FormDataResponse thành
// cấu trúc mà Handsontable hiểu (data[][], columns, cells)
// ============================================

import { Injectable } from '@angular/core';
import {
  FormDataResponse,
  DimAccount,
  FormMapping,
  PlanningFactData,
  FormLayoutConfig
} from './mock-api.service';

// === Interfaces nội bộ dùng cho Grid ===

export interface CauHinhCot {
  colKey: string;
  tenCot: string;
  nhomCha?: string;
  chiDoc?: boolean;
  congThucCot?: string;
  doRong: number;
}

export interface DongChiTieu {
  rowKey: string;
  maChiTieu: string;
  tenChiTieu: string;
  capDo: number;
  laDongTong: boolean;
  operator?: number;
}

/** Kết quả cuối cùng để truyền vào Handsontable.updateSettings() */
export interface GridConfig {
  dsCot: CauHinhCot[];
  dsDong: DongChiTieu[];
  data: any[][];
  nestedHeaders: string[][];
  colWidths: number[];
  fixedColumnsStart: number;
}

@Injectable({ providedIn: 'root' })
export class GridDataService {

  /**
   * Chuyển đổi FormDataResponse → GridConfig.
   * Component chỉ cần gọi method này rồi truyền vào Handsontable.
   */
  transform(response: FormDataResponse): GridConfig {
    const layout = response.formLayout.layoutJSON;
    const colKeys = layout.colKeys;

    // 1. Xây dsCot từ colKeys + nestedHeaders
    const lastHeaderRow = layout.nestedHeaders[layout.nestedHeaders.length - 1];
    const dsCot: CauHinhCot[] = colKeys.map((key, i) => ({
      colKey: key,
      tenCot: lastHeaderRow[i + 2] ?? key,   // +2 vì STT, Nội dung chiếm 2 cột đầu
      doRong: layout.colWidths[i + 2] ?? 100,
    }));

    // 2. Xây dsDong từ accounts
    const dsDong: DongChiTieu[] = response.accounts.map((acc, idx) => ({
      rowKey: acc.parentID ? `R${String(idx).padStart(2, '0')}` : 'R_TONG',
      maChiTieu: acc.accountCode,
      tenChiTieu: acc.accountName,
      capDo: acc.parentID ? 2 : 0,
      laDongTong: !acc.parentID && acc.dataStorage === 'DYNAMIC_CALC',
      operator: acc.operator,
    }));

    // 3. Tạo lookup tọa độ mapping (rowKey:colKey → FormMapping)
    const mappingMap = new Map<string, FormMapping>();
    for (const m of response.mappings) {
      mappingMap.set(`${m.rowKey}:${m.colKey}`, m);
    }

    // 4. Tạo lookup factData (accountCode → PlanningFactData[])
    const factMap = new Map<string, PlanningFactData[]>();
    for (const f of response.factData) {
      const list = factMap.get(f.accountCode) ?? [];
      list.push(f);
      factMap.set(f.accountCode, list);
    }

    // 5. Dựng data[][]
    const data: any[][] = [];
    let stt = 1;

    for (let r = 0; r < dsDong.length; r++) {
      const dong = dsDong[r];
      const row: any[] = [
        dong.laDongTong ? '' : String(stt++),
        dong.tenChiTieu
      ];

      for (let c = 0; c < dsCot.length; c++) {
        const cot = dsCot[c];
        const dataCol = c + 2; // index thực trong mảng row
        const mapping = mappingMap.get(`${dong.rowKey}:${cot.colKey}`);

        if (dong.laDongTong) {
          // Công thức SUM toàn bộ dòng con
          const childRowNums = dsDong
            .map((d, i) => (d.capDo >= 1 && !d.laDongTong ? i + 1 : null))
            .filter((i): i is number => i !== null);
          if (childRowNums.length > 0) {
            const colLetter = this.colIndexToLetter(dataCol);
            row.push('=' + childRowNums.map(n => colLetter + n).join('+'));
          } else {
            row.push(null);
          }
        } else if (mapping?.formula) {
          // Mapping có formula riêng → convert row number
          row.push(this.resolveFormula(mapping.formula, r + 1));
        } else {
          // Ô nhập liệu: lấy giá trị từ factData
          const facts = factMap.get(dong.maChiTieu);
          const value = facts?.[c]?.value ?? null;
          row.push(value);
        }
      }

      data.push(row);
    }

    return {
      dsCot,
      dsDong,
      data,
      nestedHeaders: layout.nestedHeaders,
      colWidths: layout.colWidths,
      fixedColumnsStart: layout.fixedColumnsStart,
    };
  }

  /** Tạo cấu hình columns cho Handsontable */
  buildColumns(dsCot: CauHinhCot[]): any[] {
    const cols: any[] = [
      { data: 0, type: 'text', readOnly: true, width: 50 },
      { data: 1, type: 'text', readOnly: true, width: 250 },
    ];
    for (let i = 0; i < dsCot.length; i++) {
      cols.push({
        data: i + 2,
        type: 'numeric',
        numericFormat: { pattern: '#,##0.00' },
        width: dsCot[i].doRong,
      });
    }
    return cols;
  }

  /** Tạo hàm cells() cho Handsontable */
  buildCellCallback(dsDong: DongChiTieu[], dsCot: CauHinhCot[], mappingMap: Map<string, FormMapping>) {
    return (row: number, col: number): any => {
      const cell: any = {};

      if (col <= 1) {
        cell.readOnly = true;
        cell.className = col === 0 ? 'htCenter htMiddle cell-stt' : 'htMiddle cell-noidung';
        return cell;
      }

      const dong = dsDong[row];
      const cot = dsCot[col - 2];
      if (!dong || !cot) return cell;

      if (dong.laDongTong) {
        cell.readOnly = true;
        cell.className = 'htRight htMiddle cell-tong';
      } else {
        const mapping = mappingMap.get(`${dong.rowKey}:${cot.colKey}`);
        const isFormula = !!mapping?.formula;
        cell.readOnly = isFormula;
        cell.className = isFormula
          ? 'htRight htMiddle cell-formula'
          : 'htRight htMiddle cell-editable';
      }
      return cell;
    };
  }

  /** Xây mappingMap từ response (tiện cho buildCellCallback) */
  buildMappingMap(mappings: FormMapping[]): Map<string, FormMapping> {
    const m = new Map<string, FormMapping>();
    for (const item of mappings) {
      m.set(`${item.rowKey}:${item.colKey}`, item);
    }
    return m;
  }

  // === Private helpers ===

  /** Chuyển column index (0-based) thành ký tự Excel (A, B, ..., Z, AA, ...) */
  private colIndexToLetter(index: number): string {
    let letter = '';
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode((n % 26) + 65) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }

  /** Thay số dòng trong công thức (VD: =C1+D1 → =C3+D3) */
  private resolveFormula(formula: string, excelRow: number): string {
    if (formula.includes('{row}')) {
      return formula.replace(/{row}/g, String(excelRow));
    }
    // Nếu là công thức dạng =C1+D1+E1+F1 → thay tất cả số thành excelRow
    if (!formula.includes(':')) {
      return formula.replace(/([A-Z]+)\d+/g, `$1${excelRow}`);
    }
    return formula;
  }
}
