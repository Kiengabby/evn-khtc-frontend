// ============================================
// GridDataMappingService
// L�:p ánh xạ dữ li�!u giữa Handsontable grid
// và Backend API sử dụng format colCode/rowCode.
//
// 2 lu�ng chính:
//   ⬢ extractGridData() � Save: Grid �  API
//   ⬢ buildGridData()   � Load: API �  Grid
// ============================================

import { Injectable } from '@angular/core';
import {
    LayoutJSON, LayoutColumnDef, LayoutRowDef,
    LayoutHeaderRow, GridCellData,
} from '../../config/models/layout-template.model';

/** Kết quả trả về khi build grid config cho Handsontable */
export interface GridRenderConfig {
    /** Mảng 2D dữ li�!u cho Handsontable */
    data: any[][];
    /** nestedHeaders cho Handsontable */
    nestedHeaders: any[][];
    /** Cấu hình columns cho Handsontable */
    columns: any[];
    /** Mảng ��" r�"ng c�"t */
    colWidths: number[];
    /** S� c�"t c� ��9nh bên trái */
    fixedColumnsStart: number;
    /** S� dòng header c� ��9nh trên cùng */
    fixedRowsTop: number;
    /** Cấu hình ẩn c�"t (c�"t METADATA_ROW) */
    hiddenColumns: { columns: number[]; indicators: boolean };
    /** Cấu hình merge cells */
    mergeCells: any[];
}

@Injectable({ providedIn: 'root' })
export class GridDataMappingService {

    // ==========================================================
    // LOOKUP MAP BUILDERS (Internal helpers)
    // ==========================================================

    /**
     * Tạo map: rowCode �  visual row index trong Handsontable.
     *
     * Vì Handsontable dùng fixedRowsTop cho header, nên dòng dữ li�!u
     * �ầu tiên bắt �ầu �x index = fixedRowsTop.
     *
     * Ví dụ (fixedRowsTop=2):
     *   Row 0,1 = header
     *   Row 2   = rows[0] �  rowCode "TONG_CONG_F"
     *   Row 3   = rows[1] �  rowCode "CHITIEU_01"
     */
    private buildRowCodeToIndexMap(rows: LayoutRowDef[], fixedRowsTop: number): Map<string, number> {
        const map = new Map<string, number>();
        for (let i = 0; i < rows.length; i++) {
            const rowCode = rows[i].rowCode;
            if (rowCode) {
                map.set(rowCode, i + fixedRowsTop);
            }
        }
        return map;
    }

    /**
     * Tạo map ngược: visual row index �  rowCode.
     * Dùng khi duy�!t grid từ trên xu�ng �Ồ lấy rowCode.
     */
    private buildIndexToRowCodeMap(rows: LayoutRowDef[], fixedRowsTop: number): Map<number, string> {
        const map = new Map<number, string>();
        for (let i = 0; i < rows.length; i++) {
            map.set(i + fixedRowsTop, rows[i].rowCode);
        }
        return map;
    }

    /**
     * Tạo map: colCode �  column index trong Handsontable.
     *
     * Ví dụ:
     *   Col 0 = "METADATA_ROW" (ẩn)
     *   Col 1 = "STT"
     *   Col 2 = "CHITIEU_NAME"
     *   Col 3 = "ACTUAL_N2"
     */
    private buildColCodeToIndexMap(columns: LayoutColumnDef[]): Map<string, number> {
        const map = new Map<string, number>();
        for (let i = 0; i < columns.length; i++) {
            map.set(columns[i].colCode, i);
        }
        return map;
    }

    /**
     * Tạo map ngược: column index �  colCode.
     */
    private buildIndexToColCodeMap(columns: LayoutColumnDef[]): Map<number, string> {
        const map = new Map<number, string>();
        for (let i = 0; i < columns.length; i++) {
            map.set(i, columns[i].colCode);
        }
        return map;
    }

    /**
     * Lọc ra danh sách c�"t cho phép nhập li�!u:
     *   - readOnly = false
     *   - colCode !== 'METADATA_ROW'
     */
    private getEditableColumns(columns: LayoutColumnDef[]): { colCode: string; colIndex: number }[] {
        const result: { colCode: string; colIndex: number }[] = [];
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            if (!col.readOnly && col.colCode !== 'METADATA_ROW') {
                result.push({ colCode: col.colCode, colIndex: i });
            }
        }
        return result;
    }

    // ==========================================================
    // SAVE FLOW: extractGridData()
    // Grid �  { rowCode, colCode, value }[]
    // ==========================================================

    /**
     * Lấy toàn b�" dữ li�!u �ã nhập từ Handsontable grid.
     *
     * Quy trình:
     *   1. Xác ��9nh danh sách c�"t editable (readOnly=false, không phải METADATA_ROW)
     *   2. Duy�!t từ dòng fixedRowsTop �ến hết
     *   3. V�:i m�i dòng: lấy rowCode từ c�"t 0 (METADATA_ROW)
     *   4. V�:i m�i c�"t editable: nếu cell có giá tr�9 �  tạo GridCellData
     *
     * @param hotInstance - Instance Handsontable �ang hiỒn th�9
     * @param layout      - LayoutJSON từ template
     * @returns Mảng GridCellData[] ch�0 chứa các ô có dữ li�!u & editable
     */
    extractGridData(hotInstance: any, layout: LayoutJSON): GridCellData[] {
        const results: GridCellData[] = [];

        if (!hotInstance || !layout) {
            console.warn('[GridDataMapping] extractGridData: hotInstance hoặc layout b�9 null');
            return results;
        }

        const totalRows = hotInstance.countRows();
        const { fixedRowsTop, columns } = layout;
        const editableCols = this.getEditableColumns(columns);

        // Tìm index c�"t METADATA_ROW (luôn phải là c�"t 0 theo thiết kế)
        const metadataColIndex = this.findMetadataColIndex(columns);

        if (metadataColIndex < 0) {
            console.warn('[GridDataMapping] extractGridData: Không tìm thấy c�"t METADATA_ROW!');
            return results;
        }

        // Duy�!t từng dòng dữ li�!u (bỏ qua header rows)
        for (let row = fixedRowsTop; row < totalRows; row++) {
            // Lấy rowCode từ c�"t ẩn METADATA_ROW
            const rowCode = hotInstance.getDataAtCell(row, metadataColIndex);

            if (!rowCode) {
                console.warn(`[GridDataMapping] extractGridData: Dòng ${row} không có rowCode, bỏ qua`);
                continue;
            }

            // KiỒm tra dòng có phải readOnly không (dòng t�"ng/công thức)
            const rowDef = layout.rows.find(r => r.rowCode === rowCode);
            if (rowDef?.isReadOnly) {
                continue; // Bỏ qua dòng readOnly (dòng t�"ng/công thức)
            }

            // Duy�!t từng c�"t editable
            for (const { colCode, colIndex } of editableCols) {
                const cellValue = hotInstance.getDataAtCell(row, colIndex);

                // Ch�0 lấy ô có dữ li�!u (không null, không undefined, không chu�i r�ng)
                if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
                    results.push({
                        rowCode,
                        colCode,
                        value: cellValue,
                    });
                }
            }
        }

        console.log(
            `[GridDataMapping] extractGridData: Trích xuất ${results.length} ô dữ li�!u`,
            results,
        );

        return results;
    }

    // ==========================================================
    // LOAD FLOW: buildGridData()
    // Template + dbData �  Handsontable data[][]
    // ==========================================================

    /**
     * Xây dựng mảng 2D dữ li�!u cho Handsontable từ template + dbData.
     *
     * Quy trình:
     *   1. Tạo mảng 2D tr�ng (totalRows � totalCols)
     *   2. Điền rowCode vào c�"t 0 (METADATA_ROW) � rất quan trọng!
     *   3. Điền static text (STT, tên ch�0 tiêu) từ template.rows
     *   4. Điền công thức từ mappings (nếu có)
     *   5. Ánh xạ dbData vào �úng ô [rowIndex][colIndex]
     *
     * @param layout - LayoutJSON từ template
     * @param dbData - Dữ li�!u từ database
     * @returns Mảng 2D dữ li�!u sẵn sàng load vào Handsontable
     */
    buildGridData(layout: LayoutJSON, dbData: GridCellData[]): any[][] {
        const { columns, rows, fixedRowsTop } = layout;
        const totalCols = columns.length;
        const totalDataRows = rows.length;
        const totalRows = fixedRowsTop + totalDataRows;

        // ���� Bư�:c 1: Tạo mảng 2D tr�ng ����
        const data: any[][] = [];

        // Header rows (sẽ tr�ng, vì nestedHeaders xử lý riêng)
        for (let h = 0; h < fixedRowsTop; h++) {
            data.push(new Array(totalCols).fill(null));
        }

        // Data rows
        for (let r = 0; r < totalDataRows; r++) {
            data.push(new Array(totalCols).fill(null));
        }

        // ���� Bư�:c 2: Điền rowCode vào c�"t METADATA_ROW (c�"t 0) ����
        const metadataColIndex = this.findMetadataColIndex(columns);

        if (metadataColIndex < 0) {
            console.warn('[GridDataMapping] buildGridData: Không tìm thấy c�"t METADATA_ROW!');
        }

        // ���� Bư�:c 3: Điền static text từ template.rows ����
        const colCodeToIndex = this.buildColCodeToIndexMap(columns);
        const sttColIndex = colCodeToIndex.get('STT') ?? -1;
        const nameColIndex = colCodeToIndex.get('CHITIEU_NAME') ?? -1;

        for (let i = 0; i < totalDataRows; i++) {
            const rowDef = rows[i];
            const rowIdx = i + fixedRowsTop;

            // Điền rowCode vào c�"t ẩn
            if (metadataColIndex >= 0) {
                data[rowIdx][metadataColIndex] = rowDef.rowCode;
            }

            // Điền STT (nếu có c�"t STT)
            if (sttColIndex >= 0) {
                data[rowIdx][sttColIndex] = this.generateSTT(rowDef, i, rows);
            }

            // Điền tên ch�0 tiêu (nếu có c�"t CHITIEU_NAME)
            if (nameColIndex >= 0) {
                // Thêm indent dựa trên level
                const indent = '  '.repeat(rowDef.level);
                data[rowIdx][nameColIndex] = indent + rowDef.title;
            }
        }

        // ���� Bư�:c 4: Điền công thức từ mappings (nếu có) ����
        if (layout.mappings) {
            for (const mapping of layout.mappings) {
                if (mapping.cellRole === 'formula' && mapping.formula) {
                    const ri = this.findRowIndex(mapping.rowCode, rows, fixedRowsTop);
                    const ci = colCodeToIndex.get(mapping.colCode);

                    if (ri >= 0 && ci !== undefined) {
                        data[ri][ci] = mapping.formula;
                    } else {
                        console.warn(
                            `[GridDataMapping] buildGridData: Không tìm thấy v�9 trí cho formula mapping`,
                            { rowCode: mapping.rowCode, colCode: mapping.colCode },
                        );
                    }
                }
            }
        }

        // ���� Bư�:c 5: Ánh xạ dbData vào �úng ô ����
        const rowCodeToIndex = this.buildRowCodeToIndexMap(rows, fixedRowsTop);
        let populatedCount = 0;
        let skippedCount = 0;

        for (const cellData of dbData) {
            const rowIdx = rowCodeToIndex.get(cellData.rowCode);
            const colIdx = colCodeToIndex.get(cellData.colCode);

            if (rowIdx === undefined) {
                console.warn(
                    `[GridDataMapping] buildGridData: rowCode "${cellData.rowCode}" không tìm thấy trong template, bỏ qua`,
                );
                skippedCount++;
                continue;
            }

            if (colIdx === undefined) {
                console.warn(
                    `[GridDataMapping] buildGridData: colCode "${cellData.colCode}" không tìm thấy trong template, bỏ qua`,
                );
                skippedCount++;
                continue;
            }

            data[rowIdx][colIdx] = cellData.value;
            populatedCount++;
        }

        console.log(
            `[GridDataMapping] buildGridData: Điền ${populatedCount} ô, bỏ qua ${skippedCount} ô`,
        );

        return data;
    }

    // ==========================================================
    // HANDSONTABLE CONFIG BUILDERS
    // ==========================================================

    /**
     * Xây dựng toàn b�" config cho Handsontable từ layoutJSON + dbData.
     * Gọi 1 lần khi load/render grid.
     */
    buildFullGridConfig(layout: LayoutJSON, dbData: GridCellData[]): GridRenderConfig {
        return {
            data: this.buildGridData(layout, dbData),
            nestedHeaders: this.buildNestedHeaders(layout),
            columns: this.buildColumnsConfig(layout.columns),
            colWidths: layout.columns.map(c => c.width),
            fixedColumnsStart: layout.freezeColumns,
            fixedRowsTop: layout.fixedRowsTop,
            hiddenColumns: this.buildHiddenColumns(layout.columns),
            mergeCells: layout.mergeCells ?? [],
        };
    }

    /**
     * ChuyỒn headerRows từ layoutJSON thành format nestedHeaders
     * mà Handsontable hiỒu �ược.
     *
     * Handsontable nestedHeaders format:
     *   [ ["STT", "Ch�0 tiêu", { label: "NĒm N-1", colspan: 2 }, ...],
     *     ["STT", "Ch�0 tiêu", "Thực hi�!n", "Kế hoạch", ...] ]
     */
    buildNestedHeaders(layout: LayoutJSON): any[][] {
        const { headerRows, columns } = layout;

        if (!headerRows || headerRows.length === 0) {
            // Fallback: 1 dòng header �ơn giản từ column titles
            return [columns.map(c => c.title)];
        }

        const result: any[][] = [];

        for (const headerRow of headerRows) {
            const row: any[] = [];

            for (const cell of headerRow.cells) {
                const entry: any = {};

                if (cell.colspan && cell.colspan > 1) {
                    entry.label = cell.label;
                    entry.colspan = cell.colspan;
                    row.push(entry);
                } else if (cell.rowspan && cell.rowspan > 1) {
                    entry.label = cell.label;
                    entry.rowspan = cell.rowspan;
                    row.push(entry);
                } else {
                    row.push(cell.label);
                }
            }

            result.push(row);
        }

        return result;
    }

    /**
     * Tạo columns config cho Handsontable.
     *
     * M�i c�"t trả về object:
     *   { data: colIndex, type: 'text'|'numeric', readOnly: bool, ... }
     */
    buildColumnsConfig(columns: LayoutColumnDef[]): any[] {
        return columns.map((col, i) => {
            const config: any = {
                data: i,
                type: col.type,
                readOnly: col.readOnly,
                width: col.width,
            };

            if (col.type === 'numeric') {
                config.numericFormat = { pattern: '#,##0.##' };
            }

            return config;
        });
    }

    /**
     * Tạo cells callback cho Handsontable.
     * Xác ��9nh readOnly, className cho từng ô dựa trên layout.
     */
    buildCellsCallback(layout: LayoutJSON): (row: number, col: number) => any {
        const { columns, rows, fixedRowsTop } = layout;

        return (row: number, col: number): any => {
            const cell: any = {};

            // Header rows � luôn readOnly
            if (row < fixedRowsTop) {
                cell.readOnly = true;
                cell.className = 'htCenter htMiddle cell-header';
                return cell;
            }

            // Data rows
            const dataRowIdx = row - fixedRowsTop;
            const rowDef = rows[dataRowIdx];
            const colDef = columns[col];

            if (!rowDef || !colDef) return cell;

            // ���� Dòng readOnly (dòng t�"ng/công thức) ����
            if (rowDef.isReadOnly) {
                cell.readOnly = true;
                if (colDef.colCode === 'METADATA_ROW') {
                    // C�"t ẩn � không style
                } else if (colDef.type === 'text') {
                    cell.className = 'htCenter htMiddle cell-tong';
                } else {
                    cell.className = 'htRight htMiddle cell-tong';
                }
                return cell;
            }

            // ���� C�"t METADATA_ROW (ẩn) ����
            if (colDef.colCode === 'METADATA_ROW') {
                cell.readOnly = true;
                return cell;
            }

            // ���� C�"t readOnly (STT, tên ch�0 tiêu...) ����
            if (colDef.readOnly) {
                cell.readOnly = true;
                if (colDef.colCode === 'STT') {
                    cell.className = 'htCenter htMiddle cell-stt';
                } else {
                    cell.className = 'htMiddle cell-noidung';
                }
                return cell;
            }

            // ���� C�"t editable (data) ����
            cell.readOnly = false;
            cell.className = 'htRight htMiddle cell-editable';
            return cell;
        };
    }

    /**
     * Xác ��9nh c�"t nào cần ẩn (METADATA_ROW).
     */
    buildHiddenColumns(columns: LayoutColumnDef[]): { columns: number[]; indicators: boolean } {
        const hidden: number[] = [];
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].colCode === 'METADATA_ROW') {
                hidden.push(i);
            }
        }
        return { columns: hidden, indicators: false };
    }

    // ==========================================================
    // PRIVATE HELPERS
    // ==========================================================

    /**
     * Tìm index c�"t METADATA_ROW.
     * Theo thiết kế luôn là c�"t 0, nhưng tìm �Ồ �ảm bảo an toàn.
     */
    private findMetadataColIndex(columns: LayoutColumnDef[]): number {
        return columns.findIndex(c => c.colCode === 'METADATA_ROW');
    }

    /**
     * Tìm row index thực trong grid từ rowCode.
     */
    private findRowIndex(rowCode: string, rows: LayoutRowDef[], fixedRowsTop: number): number {
        const idx = rows.findIndex(r => r.rowCode === rowCode);
        return idx >= 0 ? idx + fixedRowsTop : -1;
    }

    /**
     * Tạo STT tự ��"ng dựa trên level và v�9 trí trong mảng rows.
     *
     * Level 0: 1, 2, 3...  (hoặc "I", "II"... cho dòng t�"ng)
     * Level 1: 1.1, 1.2, 2.1...
     * Level 2: 1.1.1, 1.1.2...
     *
     * Nếu dòng là isReadOnly (dòng t�"ng), trả "" vì
     * dòng t�"ng thường không có STT mà có text �x c�"t tên.
     */
    private generateSTT(rowDef: LayoutRowDef, _currentIdx: number, _allRows: LayoutRowDef[]): string {
        // Dòng t�"ng/formula thường không cần STT
        if (rowDef.isReadOnly) {
            return '';
        }

        // Nếu rowCode có dạng "CHITIEU_01" �  trích s� �Ồ tạo STT
        // Đây là giải pháp �ơn giản; cho production nên lấy STT từ template
        const match = rowDef.rowCode.match(/(\d+)$/);
        if (match) {
            return match[1];
        }

        return '';
    }
}
