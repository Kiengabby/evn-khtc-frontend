// ============================================
// LayoutGridRendererService
// Chuyển đổi LayoutJSON (format V2 từ Form Designer)
// thành cấu hình Handsontable cho Data Entry module.
//
// Khác với TemplateParserService (POV/Dimension-based),
// service này dùng colCode/rowCode + headerRows/mergeCells.
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
  /** data[row][col] — Handsontable data matrix */
  data: any[][];
  /** Nested headers for multi-level headers */
  nestedHeaders: any[][];
  /** Column widths */
  colWidths: number[];
  /** Fixed columns on the left */
  fixedColumnsStart: number;
  /** Handsontable columns config (type, readOnly, etc.) */
  columns: any[];
  /** Merge cell definitions */
  mergeCells: MergeCellDef[];
  /** Fixed rows on top */
  fixedRowsTop: number;
  /** Hidden columns config */
  hiddenColumns?: { columns: number[]; indicators: boolean };
  /** Row metadata for save tracking */
  rowMeta: RenderedRowMeta[];
  /** Column metadata for save tracking */
  colMeta: RenderedColMeta[];
}

export interface RenderedRowMeta {
  rowCode: string;
  title: string;
  level: number;
  isReadOnly: boolean;
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
    const hiddenColIndices = metadataColIdx >= 0 ? [metadataColIdx] : [];

    const headerRowCount = layout.fixedRowsTop || layout.headerRows?.length || 1;
    const bodyRows = layout.rows || [];

    // Build components
    const nestedHeaders = this.buildNestedHeaders(layout.headerRows, visibleCols, headerRowCount);
    const { data, rowMeta } = this.buildDataRows(visibleCols, bodyRows);
    const colWidths = visibleCols.map(c => c.width || 120);
    const columns = this.buildColumns(visibleCols);
    const mergeCells = this.buildMergeCells(layout.mergeCells, metadataColIdx);
    const colMeta = this.buildColMeta(visibleCols);

    // Populate fact data from dbData
    this.populateDbData(data, rowMeta, colMeta, dbData);

    return {
      data,
      nestedHeaders,
      colWidths,
      fixedColumnsStart: Math.max(0, (layout.freezeColumns || 1) - (metadataColIdx >= 0 ? 1 : 0)),
      columns,
      mergeCells,
      fixedRowsTop: 0, // header handled by nestedHeaders
      hiddenColumns: hiddenColIndices.length > 0
        ? { columns: hiddenColIndices, indicators: false }
        : undefined,
      rowMeta,
      colMeta,
    };
  }

  // ==========================================================
  // Nested Headers (multi-level header support)
  // ==========================================================

  private buildNestedHeaders(
    headerRows: LayoutHeaderRow[] | undefined,
    visibleCols: LayoutColumnDef[],
    headerRowCount: number,
  ): any[][] {
    if (!headerRows || headerRows.length === 0) {
      // Simple single-row header from column titles
      return [visibleCols.map(c => c.title)];
    }

    const result: any[][] = [];
    for (const headerRow of headerRows) {
      const row: any[] = [];
      for (const cell of headerRow.cells) {
        if (cell.colKey === 'ID') continue; // Skip metadata column

        const colspan = cell.colspan || 1;
        const label = cell.label;

        if (colspan > 1) {
          row.push({ label, colspan });
        } else {
          row.push(label);
        }
      }
      result.push(row);
    }
    return result;
  }

  // ==========================================================
  // Data Rows
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
    const unitIdx = visibleCols.findIndex(c =>
      c.colCode === 'UNIT' || c.colCode === 'DVT'
    );

    let sttCounter = 0;

    for (const rowDef of bodyRows) {
      const row = new Array(visibleCols.length).fill(null);

      // STT column
      if (sttIdx >= 0) {
        if (rowDef.level === 0) {
          sttCounter++;
          // For parent-level items, leave empty or use Roman numerals
          row[sttIdx] = rowDef.isReadOnly ? '' : String(sttCounter);
        }
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

      if (col.type === 'numeric') {
        base.type = 'numeric';
        base.numericFormat = { pattern: '#,##0.00' };
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
  // ==========================================================

  private buildMergeCells(
    mergeCells: MergeCellDef[] | undefined,
    metadataColIdx: number,
  ): MergeCellDef[] {
    if (!mergeCells) return [];

    return mergeCells
      .filter(mc => mc.col !== metadataColIdx) // Skip metadata column merges
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

    // Build lookup: rowCode → row index
    const rowLookup = new Map<string, number>();
    for (let i = 0; i < rowMeta.length; i++) {
      rowLookup.set(rowMeta[i].rowCode, i);
    }

    // Build lookup: colCode → visible column index
    const colLookup = new Map<string, number>();
    for (const cm of colMeta) {
      colLookup.set(cm.colCode, cm.visibleIndex);
    }

    // Fill values
    for (const cell of dbData) {
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

      // ReadOnly rows (totals, formula rows)
      if (rm.isReadOnly) {
        cell.readOnly = true;
        if (cm.type === 'numeric') {
          cell.className = 'htRight htMiddle cell-tong';
        } else {
          cell.className = 'htMiddle cell-tong';
        }
        return cell;
      }

      // ReadOnly columns (STT, chi tiêu name, DVT)
      if (cm.isReadOnly) {
        cell.readOnly = true;
        if (cm.colCode === 'STT') {
          cell.className = 'htCenter htMiddle cell-stt';
        } else {
          cell.className = 'htMiddle cell-noidung';
        }
        return cell;
      }

      // Editable data cells
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
      if (!rm || !cm) continue;

      result.push({
        rowCode: rm.rowCode,
        colCode: cm.colCode,
        value: newVal,
      });
    }

    return result;
  }
}
