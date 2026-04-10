// ============================================
// TemplateParserService
// Chuyển đổi Template JSON (từ BE) + Dimension Metadata
// thành cấu hình Handsontable (nestedHeaders, data, cells)
// ============================================

import { Injectable } from '@angular/core';

// ============================================
// Interfaces — Template JSON Structure (BE API)
// ============================================

export interface TemplateJson {
  templateId: string;
  templateName: string;
  version: string;
  description: string;
  POV: {
    Dimension: string[];   // e.g. ["ENT","VER"]
    Promt: string[];       // e.g. ["Đơn vị","Phiên bản"]
  };
  GRID: {
    COLS: ColDef[];
    ROWS: RowDef[];
  };
}

export interface ColDef {
  Key: string;
  Type: 'Text' | 'Dim' | 'Data';
  Promt: string;
  ListValues?: string[];
  Dimension?: DimRef[];
}

export interface RowDef {
  Key: string;
  Type: 'Data' | 'Formula';
  Promt: string;
  Dimension?: DimRef[];
  Formula?: string;
}

export interface DimRef {
  Key: string;                // dimension key (YEA, SCE, ACC ...)
  ListType: 'Var' | 'Mem';
  ListValue: MemberRef[];
}

export interface MemberRef {
  Key: string;
  Display: {
    Type: 'Text' | 'Dim';
    Value: string;
  };
}

/** Metadata tra cứu tên dimension member (từ BE) */
export interface DimMetadata {
  [dimKey: string]: {
    [memberKey: string]: { Name: string; [p: string]: any };
  };
}

/** Giá trị POV user đã chọn */
export interface PovSelection {
  [dimKey: string]: string;
}

/** Một điểm dữ liệu fact từ BE — dimension intersection → value */
export interface FactDataPoint {
  dimensions: Record<string, string>;
  value: number | string | null;
}

// ============================================
// Interfaces — Parser Output (cho Handsontable)
// ============================================

export interface PhysicalCol {
  logicalKey: string;            // Key cột gốc (A, B, C, D…)
  type: 'Text' | 'Dim' | 'Data';
  dimIntersection?: { dimKey: string; memberKey: string }[];
  width: number;
}

export interface RowMeta {
  logicalKey: string;
  type: 'Data' | 'Formula';
  dimMembers?: { dimKey: string; memberKey: string }[];
  memberDisplay?: string;
  isFormula: boolean;
  formulaRef?: string;
}

export interface ParsedGridConfig {
  nestedHeaders: any[][];
  data: any[][];
  colWidths: number[];
  fixedColumnsStart: number;
  columns: any[];
  physicalCols: PhysicalCol[];
  rowMeta: RowMeta[];
}

// ============================================
// Service
// ============================================

@Injectable({ providedIn: 'root' })
export class TemplateParserService {

  // ==========================================================
  // Main entry: Template JSON → Handsontable config
  // ==========================================================

  parse(template: TemplateJson, dimMeta: DimMetadata, _pov: PovSelection, nam: number): ParsedGridConfig {
    const cols = template.GRID.COLS;
    const rows = template.GRID.ROWS;

    const physicalCols  = this.buildPhysicalCols(cols);
    const nestedHeaders = this.buildNestedHeaders(cols, dimMeta, nam);
    const { rowMeta, data } = this.buildRows(rows, cols, physicalCols, dimMeta, nam);
    const colWidths = physicalCols.map(pc => pc.width);

    return {
      nestedHeaders,
      data,
      colWidths,
      fixedColumnsStart: this.countFixedCols(cols),
      columns: this.buildColumns(physicalCols),
      physicalCols,
      rowMeta,
    };
  }

  // ==========================================================
  // 1. Physical Columns  (mỗi cột vật lý = 1 cột Handsontable)
  // ==========================================================

  private buildPhysicalCols(cols: ColDef[]): PhysicalCol[] {
    const result: PhysicalCol[] = [];

    for (const col of cols) {
      if (col.Type === 'Text' || col.Type === 'Dim') {
        result.push({
          logicalKey: col.Key,
          type: col.Type,
          width: col.Promt === 'STT' ? 55 : col.Type === 'Dim' ? 220 : 110,
        });
      } else if (col.Type === 'Data' && col.Dimension) {
        const combos = this.cartesian(col.Dimension.map(d => d.ListValue));
        for (const combo of combos) {
          result.push({
            logicalKey: col.Key,
            type: 'Data',
            dimIntersection: col.Dimension.map((d, i) => ({
              dimKey: d.Key,
              memberKey: combo[i].Key,
            })),
            width: col.Promt ? 160 : 130,
          });
        }
      }
    }
    return result;
  }

  // ==========================================================
  // 2. Nested Headers  (header nhiều tầng cho Handsontable)
  // ==========================================================

  private buildNestedHeaders(cols: ColDef[], dimMeta: DimMetadata, nam: number): any[][] {
    let maxDepth = 1;
    for (const col of cols) {
      if (col.Type === 'Data' && col.Dimension) {
        maxDepth = Math.max(maxDepth, col.Dimension.length);
      }
    }

    const headers: any[][] = [];

    for (let level = 0; level < maxDepth; level++) {
      const row: any[] = [];

      for (const col of cols) {
        if (col.Type === 'Text' || col.Type === 'Dim') {
          // Cột Text / Dim: lặp Promt ở mọi tầng header
          row.push(col.Promt);

        } else if (col.Type === 'Data' && col.Dimension) {
          const dims = col.Dimension;
          const totalPhys = this.dimProduct(dims);

          if (level === 0) {
            // --- Tầng trên cùng ---
            if (col.Promt) {
              // Data col có Promt → dùng Promt là tiêu đề nhóm
              row.push(totalPhys > 1
                ? { label: col.Promt, colspan: totalPhys }
                : col.Promt);
            } else if (dims.length >= 2) {
              // Nhóm theo chiều (dimension) đầu tiên
              const subCount = this.dimProduct(dims.slice(1));
              for (const m of dims[0].ListValue) {
                const label = this.resolveDisplay(m, dims[0].Key, dimMeta, nam);
                row.push(subCount > 1 ? { label, colspan: subCount } : label);
              }
            } else {
              // 1 chiều duy nhất → header riêng lẻ
              for (const m of dims[0].ListValue) {
                row.push(this.resolveDisplay(m, dims[0].Key, dimMeta, nam));
              }
            }

          } else if (level === 1 && dims.length >= 2) {
            // --- Tầng thứ hai: hiển thị chiều cuối cùng ---
            for (const _m0 of dims[0].ListValue) {
              for (const m1 of dims[1].ListValue) {
                row.push(this.resolveDisplay(m1, dims[1].Key, dimMeta, nam));
              }
            }

          } else {
            // Tầng sâu hơn (hiếm) — để trống
            for (let i = 0; i < totalPhys; i++) row.push('');
          }
        }
      }

      headers.push(row);
    }
    return headers;
  }

  // ==========================================================
  // 3. Rows & Data  (xây dựng data[][] + metadata dòng)
  // ==========================================================

  private buildRows(
    rows: RowDef[], cols: ColDef[], physicalCols: PhysicalCol[],
    dimMeta: DimMetadata, nam: number,
  ): { rowMeta: RowMeta[]; data: any[][] } {
    const meta: RowMeta[] = [];
    const data: any[][] = [];
    let globalIdx = 0;

    // Theo dõi dòng thuộc mỗi RowKey → phục vụ công thức
    const keyToIndices = new Map<string, number[]>();

    for (const rowDef of rows) {
      // ---- Data rows ----
      if (rowDef.Type === 'Data' && rowDef.Dimension) {
        const dim = rowDef.Dimension[0]; // hàng chỉ có 1 chiều (ACC)
        const indices: number[] = [];

        for (let mi = 0; mi < dim.ListValue.length; mi++) {
          const member = dim.ListValue[mi];
          const display = this.resolveDisplay(member, dim.Key, dimMeta, nam);

          meta.push({
            logicalKey: rowDef.Key,
            type: 'Data',
            dimMembers: [{ dimKey: dim.Key, memberKey: member.Key }],
            memberDisplay: display,
            isFormula: false,
          });

          data.push(this.makeDataRow(cols, globalIdx, display));
          indices.push(globalIdx);
          globalIdx++;
        }
        keyToIndices.set(rowDef.Key, indices);

      // ---- Formula rows ----
      } else if (rowDef.Type === 'Formula') {
        meta.push({
          logicalKey: rowDef.Key,
          type: 'Formula',
          memberDisplay: rowDef.Promt,
          isFormula: true,
          formulaRef: rowDef.Formula,
        });

        const refIndices = rowDef.Formula
          ? (keyToIndices.get(rowDef.Formula) ?? [])
          : [];

        data.push(this.makeFormulaRow(cols, globalIdx, rowDef.Promt, refIndices));
        keyToIndices.set(rowDef.Key, [globalIdx]);
        globalIdx++;
      }
    }

    return { rowMeta: meta, data };
  }

  /** Tạo 1 dòng dữ liệu (Data row) */
  private makeDataRow(cols: ColDef[], globalIdx: number, memberDisplay: string): any[] {
    const row: any[] = [];
    for (const col of cols) {
      if (col.Type === 'Text') {
        row.push(col.ListValues?.[globalIdx] ?? '');
      } else if (col.Type === 'Dim') {
        row.push(memberDisplay);
      } else if (col.Type === 'Data') {
        const n = this.countDataCols(col);
        for (let i = 0; i < n; i++) row.push(null);
      }
    }
    return row;
  }

  /** Tạo 1 dòng công thức (Formula row) */
  private makeFormulaRow(cols: ColDef[], globalIdx: number, promt: string, refIndices: number[]): any[] {
    const row: any[] = [];
    let pcIdx = 0;

    for (const col of cols) {
      if (col.Type === 'Text') {
        row.push(col.ListValues?.[globalIdx] ?? '');
        pcIdx++;
      } else if (col.Type === 'Dim') {
        row.push(promt);
        pcIdx++;
      } else if (col.Type === 'Data') {
        const n = this.countDataCols(col);
        for (let i = 0; i < n; i++) {
          if (refIndices.length > 0) {
            const letter = this.colLetter(pcIdx);
            const excelRows = refIndices.map(ri => ri + 1); // 1-based
            row.push(
              this.isConsecutive(excelRows) && excelRows.length >= 2
                ? `=SUM(${letter}${excelRows[0]}:${letter}${excelRows[excelRows.length - 1]})`
                : '=' + excelRows.map(er => letter + er).join('+'),
            );
          } else {
            row.push(null);
          }
          pcIdx++;
        }
      }
    }
    return row;
  }

  // ==========================================================
  // 4. Handsontable columns config
  // ==========================================================

  private buildColumns(physicalCols: PhysicalCol[]): any[] {
    return physicalCols.map((pc, i) => {
      if (pc.type === 'Text' || pc.type === 'Dim') {
        return { data: i, type: 'text', readOnly: true, width: pc.width };
      }
      return { data: i, type: 'numeric', numericFormat: { pattern: '#,##0.00' }, width: pc.width };
    });
  }

  // ==========================================================
  // 5. cells() callback  (phân loại ô: readOnly, className)
  // ==========================================================

  buildCellCallback(rowMeta: RowMeta[], physicalCols: PhysicalCol[]): (row: number, col: number) => any {
    return (row: number, col: number): any => {
      const cell: any = {};
      const pc = physicalCols[col];
      const rm = rowMeta[row];
      if (!pc || !rm) return cell;

      // --- Dòng công thức: toàn bộ ô đều readOnly + style Tổng ---
      if (rm.isFormula) {
        cell.readOnly = true;
        if (pc.type === 'Dim') {
          cell.className = 'htMiddle cell-noidung cell-tong';
        } else if (pc.type === 'Text') {
          cell.className = 'htCenter htMiddle cell-tong';
        } else {
          cell.className = 'htRight htMiddle cell-tong';
        }
        return cell;
      }

      // --- Dòng dữ liệu ---
      if (pc.type === 'Text') {
        cell.readOnly = true;
        cell.className = 'htCenter htMiddle cell-stt';
      } else if (pc.type === 'Dim') {
        cell.readOnly = true;
        cell.className = 'htMiddle cell-noidung';
      } else {
        cell.readOnly = false;
        cell.className = 'htRight htMiddle cell-editable';
      }
      return cell;
    };
  }

  // ==========================================================
  // 6. Populate fact data  (fill giá trị thực vào data[][])
  // ==========================================================

  /**
   * Điền giá trị fact data từ BE vào các ô Data trong grid.
   * Gọi sau parse() để fill dữ liệu thực.
   *
   * Cơ chế: mỗi ô Data có tọa độ dimension = POV + row dims + col dims.
   * So khớp tọa độ này với factData.dimensions để tìm giá trị.
   */
  populateFactData(
    config: ParsedGridConfig,
    factData: FactDataPoint[],
    pov: PovSelection,
  ): void {
    const factMap = new Map<string, number | string | null>();
    for (const fd of factData) {
      factMap.set(this.buildDimKey(fd.dimensions), fd.value);
    }

    for (let row = 0; row < config.rowMeta.length; row++) {
      const rm = config.rowMeta[row];
      if (rm.isFormula) continue;

      for (let col = 0; col < config.physicalCols.length; col++) {
        const pc = config.physicalCols[col];
        if (pc.type !== 'Data') continue;

        const cellDims: Record<string, string> = { ...pov };

        if (rm.dimMembers) {
          for (const dm of rm.dimMembers) {
            cellDims[dm.dimKey] = dm.memberKey;
          }
        }

        if (pc.dimIntersection) {
          for (const di of pc.dimIntersection) {
            cellDims[di.dimKey] = di.memberKey;
          }
        }

        const value = factMap.get(this.buildDimKey(cellDims));
        if (value !== undefined) {
          config.data[row][col] = value;
        }
      }
    }
  }

  /** Tạo key xác định duy nhất từ tọa độ dimension (sorted, deterministic) */
  private buildDimKey(dims: Record<string, string>): string {
    return Object.keys(dims).sort().map(k => `${k}=${dims[k]}`).join('|');
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  private resolveDisplay(member: MemberRef, dimKey: string, meta: DimMetadata, _nam: number): string {
    if (member.Display.Type === 'Text') {
      return member.Display.Value;
    }
    // Type === 'Dim' → tra cứu metadata
    // Safe access: check cả dim, memberData và property trước khi truy cập
    const dim = meta?.[dimKey];
    const memberData = dim?.[member.Key];
    if (memberData) {
      return memberData[member.Display.Value] ?? member.Key;
    }
    return member.Key;
  }

  private dimProduct(dims: DimRef[]): number {
    return dims.reduce((p, d) => p * d.ListValue.length, 1);
  }

  private countDataCols(col: ColDef): number {
    return col.Dimension ? this.dimProduct(col.Dimension) : 1;
  }

  private countFixedCols(cols: ColDef[]): number {
    let n = 0;
    for (const c of cols) {
      if (c.Type === 'Text' || c.Type === 'Dim') n++;
      else break;
    }
    return n;
  }

  private cartesian(arrays: MemberRef[][]): MemberRef[][] {
    if (arrays.length === 0) return [[]];
    return arrays.reduce<MemberRef[][]>(
      (acc, curr) => acc.flatMap(combo => curr.map(item => [...combo, item])),
      [[]],
    );
  }

  private colLetter(index: number): string {
    let s = '';
    let n = index;
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }

  private isConsecutive(nums: number[]): boolean {
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i - 1] + 1) return false;
    }
    return true;
  }
}
