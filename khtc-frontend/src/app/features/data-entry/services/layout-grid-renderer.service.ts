// ============================================
// LayoutGridRendererService
// Chuyển đổi LayoutJSON (format V2 từ Form Designer)
// thành cấu hình Handsontable cho Data Entry module.
//
// Sử dụng data-row headers + mergeCells (thay vì nestedHeaders)
// để hỗ trợ đầy đủ rowspan/colspan cho header phức tạp.
// ============================================

import { Injectable } from '@angular/core';
import {
  LayoutJSON, LayoutColumnDef, LayoutRowDef,
  LayoutHeaderRow, GridCellData, MergeCellDef,
} from '../../../core/models/layout-template.model';

// ============================================
// Output interfaces
// ============================================

export interface RenderedGridConfig {
  /** data[row][col] — Handsontable data matrix (headers + body) */
  data: any[][];
  /** Column widths */
  colWidths: number[];
  /** Fixed columns on the left */
  fixedColumnsStart: number;
  /** Handsontable columns config (type, readOnly, etc.) */
  columns: any[];
  /** Merge cell definitions (for both header and body area) */
  mergeCells: MergeCellDef[];
  /** Number of fixed rows at top (= header rows) */
  fixedRowsTop: number;
  /** Number of header rows in the data array */
  headerRowCount: number;
  /** Row metadata for save tracking (includes header rows) */
  rowMeta: RenderedRowMeta[];
  /** Column metadata for save tracking */
  colMeta: RenderedColMeta[];
}

export interface RenderedRowMeta {
  rowCode: string;
  title: string;
  level: number;
  isReadOnly: boolean;
  /** True if this row is a header row (not a data row) */
  isHeader?: boolean;
}

export interface RenderedColMeta {
  colCode: string;
  title: string;
  type: string;
  isReadOnly: boolean;
  /** Index within the visible columns array */
  visibleIndex: number;
}

// ============================================
// Service
// ============================================

@Injectable({ providedIn: 'root' })
export class LayoutGridRendererService {

  // ==========================================================
  // Main entry: LayoutJSON + dbData → Handsontable config
  // ==========================================================

  render(layout: LayoutJSON, dbData: GridCellData[] = []): RenderedGridConfig {
    const allCols = layout.columns;

    // Separate hidden (METADATA_ROW) from visible columns
    const metadataColIdx = allCols.findIndex(c => c.colCode === 'METADATA_ROW');
    const visibleCols = allCols.filter(c => c.colCode !== 'METADATA_ROW');

    const headerRowCount = layout.fixedRowsTop || layout.headerRows?.length || 0;
    const bodyRows = layout.rows || [];

    // ── Build header rows as data rows ──
    const headerData = this.buildHeaderDataRows(layout.headerRows, visibleCols);
    const headerRowMeta: RenderedRowMeta[] = headerData.map((_, i) => ({
      rowCode: `__HEADER_${i}__`,
      title: '',
      level: 0,
      isReadOnly: true,
      isHeader: true,
    }));

    // ── Build body data rows ──
    const { data: bodyData, rowMeta: bodyRowMeta } = this.buildDataRows(visibleCols, bodyRows);

    // ── Combine header + body ──
    const data = [...headerData, ...bodyData];
    const rowMeta = [...headerRowMeta, ...bodyRowMeta];

    // ── Other config ──
    const colWidths = visibleCols.map(c => c.width || 120);
    const columns = this.buildColumns(visibleCols);
    const mergeCells = this.buildMergeCells(layout.mergeCells, metadataColIdx);
    const colMeta = this.buildColMeta(visibleCols);

    // ── Populate fact data (only body rows, header rows are skipped by rowCode lookup) ──
    this.populateDbData(data, rowMeta, colMeta, dbData);

    return {
      data,
      colWidths,
      fixedColumnsStart: Math.max(0, (layout.freezeColumns || 1) - (metadataColIdx >= 0 ? 1 : 0)),
      columns,
      mergeCells,
      fixedRowsTop: headerData.length,
      headerRowCount: headerData.length,
      rowMeta,
      colMeta,
    };
  }

  // ==========================================================
  // Header Data Rows (replace nestedHeaders with data rows)
  // ==========================================================

  private buildHeaderDataRows(
    headerRows: LayoutHeaderRow[] | undefined,
    visibleCols: LayoutColumnDef[],
  ): any[][] {
    if (!headerRows || headerRows.length === 0) {
      // Single header row from column titles
      return [visibleCols.map(c => c.title)];
    }

    // Build colKey → visible column index lookup
    const colKeyToIdx = new Map<string, number>();
    for (let i = 0; i < visibleCols.length; i++) {
      colKeyToIdx.set(visibleCols[i].key, i);
    }

    const result: any[][] = [];
    for (const headerRow of headerRows) {
      const row = new Array(visibleCols.length).fill(null);
      for (const cell of headerRow.cells) {
        if (cell.colKey === 'ID') continue; // Skip metadata column
        const idx = colKeyToIdx.get(cell.colKey);
        if (idx !== undefined) {
          row[idx] = cell.label;
        }
      }
      result.push(row);
    }
    return result;
  }

  // ==========================================================
  // Body Data Rows
  // ==========================================================

  private buildDataRows(
    visibleCols: LayoutColumnDef[],
    bodyRows: LayoutRowDef[],
  ): { data: any[][]; rowMeta: RenderedRowMeta[] } {
    const data: any[][] = [];
    const rowMeta: RenderedRowMeta[] = [];

    // Column index lookups
    const sttIdx = visibleCols.findIndex(c => c.colCode === 'STT');
    const chitieuIdx = visibleCols.findIndex(c =>
      c.colCode === 'CHITIEU_NAME' || c.colCode === 'NOI_DUNG'
    );

    // Hierarchical STT counters per level: [level0, level1, level2, ...]
    const sttCounters: number[] = [0, 0, 0, 0, 0];

    for (const rowDef of bodyRows) {
      const row = new Array(visibleCols.length).fill(null);

      // STT column — hierarchical numbering (1, 2, 2.1, 2.2, 2.2.1, ...)
      if (sttIdx >= 0 && !rowDef.isReadOnly) {
        const level = rowDef.level;
        // Increment counter at this level
        sttCounters[level]++;
        // Reset all deeper-level counters
        for (let l = level + 1; l < sttCounters.length; l++) {
          sttCounters[l] = 0;
        }
        // Build hierarchical STT string
        const parts: string[] = [];
        for (let l = 0; l <= level; l++) {
          parts.push(String(sttCounters[l]));
        }
        row[sttIdx] = parts.join('.');
      }

      // CHITIEU_NAME column (with indent)
      if (chitieuIdx >= 0) {
        const indent = rowDef.level > 0 ? '  '.repeat(rowDef.level) : '';
        const prefix = rowDef.level >= 2 ? '- ' : '';
        row[chitieuIdx] = indent + prefix + rowDef.title;
      }

      data.push(row);
      rowMeta.push({
        rowCode: rowDef.rowCode,
        title: rowDef.title,
        level: rowDef.level,
        isReadOnly: rowDef.isReadOnly ?? false,
      });
    }

    return { data, rowMeta };
  }

  // ==========================================================
  // Handsontable columns config
  // ==========================================================

  private buildColumns(visibleCols: LayoutColumnDef[]): any[] {
    return visibleCols.map((col, idx) => {
      const base: any = { data: idx, width: col.width || 120 };
      const colCode = col.colCode?.toUpperCase();

      // STT should always be text (displays 1, 2, 3 — not 1.00, 2.00)
      if (colCode === 'STT' || colCode === 'MA_CHITIEU') {
        base.type = 'text';
      } else if (col.type === 'numeric') {
        base.type = 'numeric';
        base.numericFormat = { pattern: '#,##0' };
      } else {
        base.type = 'text';
      }

      if (col.readOnly) {
        base.readOnly = true;
      }

      return base;
    });
  }

  // ==========================================================
  // Merge cells (adjust for hidden METADATA_ROW column)
  // Headers are now data rows → include header merges
  // ==========================================================

  private buildMergeCells(
    mergeCells: MergeCellDef[] | undefined,
    metadataColIdx: number,
  ): MergeCellDef[] {
    if (!mergeCells) return [];

    return mergeCells
      // Skip merges on the metadata column (it's hidden)
      .filter(mc => mc.col !== metadataColIdx)
      // Adjust col index (subtract 1 if metadata column is before this column)
      .map(mc => ({
        ...mc,
        col: metadataColIdx >= 0 && mc.col > metadataColIdx ? mc.col - 1 : mc.col,
      }));
  }

  // ==========================================================
  // Column metadata
  // ==========================================================

  private buildColMeta(visibleCols: LayoutColumnDef[]): RenderedColMeta[] {
    return visibleCols.map((col, idx) => ({
      colCode: col.colCode,
      title: col.title,
      type: col.type,
      isReadOnly: col.readOnly,
      visibleIndex: idx,
    }));
  }

  // ==========================================================
  // Populate database data into grid cells
  // ==========================================================

  private populateDbData(
    data: any[][],
    rowMeta: RenderedRowMeta[],
    colMeta: RenderedColMeta[],
    dbData: GridCellData[],
  ): void {
    if (!dbData || dbData.length === 0) return;

    // Các cột label không được ghi đè từ dbData
    const labelColCodes = new Set([
      'STT', 'CHITIEU_NAME', 'NOI_DUNG', 'UNIT', 'DVT',
      'MA_CHITIEU', 'TEN_CHITIEU', 'DON_VI',
    ]);

    // Build lookup: rowCode → row index in data array
    // Header rows have rowCode "__HEADER_*__" → won't match any dbData → naturally skipped
    const rowLookup = new Map<string, number>();
    for (let i = 0; i < rowMeta.length; i++) {
      if (!rowMeta[i].isHeader) {
        rowLookup.set(rowMeta[i].rowCode, i);
      }
    }

    // Build lookup: colCode → visible column index
    const colLookup = new Map<string, number>();
    for (const cm of colMeta) {
      colLookup.set(cm.colCode, cm.visibleIndex);
    }

    // Fill values (skip label columns)
    for (const cell of dbData) {
      if (labelColCodes.has(cell.colCode.toUpperCase())) continue;

      const rowIdx = rowLookup.get(cell.rowCode);
      const colIdx = colLookup.get(cell.colCode);
      if (rowIdx !== undefined && colIdx !== undefined) {
        data[rowIdx][colIdx] = cell.value;
      }
    }
  }

  // ==========================================================
  // cells() callback builder (styling + readOnly)
  // ==========================================================

  buildCellCallback(
    rowMeta: RenderedRowMeta[],
    visibleCols: RenderedColMeta[] | LayoutColumnDef[],
  ): (row: number, col: number) => any {
    return (row: number, col: number): any => {
      const cell: any = {};
      const rm = rowMeta[row];
      const cm = visibleCols[col] as any;
      if (!rm || !cm) return cell;

      // ── Header rows (frozen at top) ──
      if (rm.isHeader) {
        cell.readOnly = true;
        cell.className = 'htCenter htMiddle cell-header';
        return cell;
      }

      // ── ReadOnly rows (totals, formula rows) ──
      if (rm.isReadOnly) {
        cell.readOnly = true;
        if (cm.type === 'numeric') {
          cell.className = 'htRight htMiddle cell-tong';
        } else {
          cell.className = 'htMiddle cell-tong';
        }
        return cell;
      }

      // ── ReadOnly columns (STT, chi tiêu name, DVT) ──
      const isColReadOnly = cm.isReadOnly ?? cm.readOnly ?? false;
      if (isColReadOnly) {
        cell.readOnly = true;
        const colCode = cm.colCode?.toUpperCase();
        if (colCode === 'STT') {
          cell.className = 'htCenter htMiddle cell-stt';
        } else {
          cell.className = 'htMiddle cell-noidung';
        }
        return cell;
      }

      // ── Editable data cells ──
      cell.readOnly = false;
      cell.className = 'htRight htMiddle cell-editable';
      return cell;
    };
  }

  // ==========================================================
  // Extract changed cells for saving
  // ==========================================================

  extractChanges(
    data: any[][],
    rowMeta: RenderedRowMeta[],
    colMeta: RenderedColMeta[],
    changes: [number, number | string, any, any][],
  ): GridCellData[] {
    const result: GridCellData[] = [];

    for (const [row, prop, _oldVal, newVal] of changes) {
      const col = typeof prop === 'number' ? prop : parseInt(prop, 10);
      const rm = rowMeta[row];
      const cm = colMeta[col];
      // Skip header rows and missing meta
      if (!rm || !cm || rm.isHeader) continue;

      result.push({
        rowCode: rm.rowCode,
        colCode: cm.colCode,
        value: newVal,
      });
    }

    return result;
  }

  // ==========================================================
  // Extract ALL data cells from grid for full save
  // ==========================================================

  /**
   * Trích xuất toàn bộ dữ liệu từ grid (không chỉ cells thay đổi).
   * Dùng để gửi tất cả dữ liệu lên API save-submission.
   *
   * Bỏ qua:
   *   - Header rows
   *   - ReadOnly rows (dòng tổng)
   *   - Label columns (STT, CHITIEU_NAME, UNIT)
   */
  extractAllDataCells(
    hotInstance: any,
    rowMeta: RenderedRowMeta[],
    colMeta: RenderedColMeta[],
  ): GridCellData[] {
    const result: GridCellData[] = [];

    // Các cột label không được gửi lên BE
    const labelColCodes = new Set([
      'STT', 'CHITIEU_NAME', 'NOI_DUNG', 'UNIT', 'DVT',
      'MA_CHITIEU', 'TEN_CHITIEU', 'DON_VI', 'METADATA_ROW',
    ]);

    for (let row = 0; row < rowMeta.length; row++) {
      const rm = rowMeta[row];
      // Skip header rows and readOnly rows
      if (rm.isHeader || rm.isReadOnly) continue;

      for (let col = 0; col < colMeta.length; col++) {
        const cm = colMeta[col];
        // Skip label columns
        if (labelColCodes.has(cm.colCode.toUpperCase())) continue;
        if (cm.isReadOnly) continue;

        const value = hotInstance.getDataAtCell(row, col);

        // Luôn gửi giá trị (kể cả 0, null) để BE lưu đúng trạng thái
        result.push({
          rowCode: rm.rowCode,
          colCode: cm.colCode,
          value: value ?? 0,
        });
      }
    }

    console.log(`[LayoutGridRenderer] extractAllDataCells: ${result.length} cells extracted`);
    return result;
  }
}
