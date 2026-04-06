// ============================================
// GridDataMappingService
// Lá»›p Ã¡nh xáº¡ dá»¯ liá»‡u giá»¯a Handsontable grid
// vÃ  Backend API sá»­ dá»¥ng format colCode/rowCode.
//
// 2 luá»“ng chÃ­nh:
//   â€¢ extractGridData() â€” Save: Grid â†’ API
//   â€¢ buildGridData()   â€” Load: API â†’ Grid
// ============================================

import { Injectable } from '@angular/core';
import {
    LayoutJSON, LayoutColumnDef, LayoutRowDef,
    LayoutHeaderRow, GridCellData,
} from '../../config/models/layout-template.model';

/** Káº¿t quáº£ tráº£ vá» khi build grid config cho Handsontable */
export interface GridRenderConfig {
    /** Máº£ng 2D dá»¯ liá»‡u cho Handsontable */
    data: any[][];
    /** nestedHeaders cho Handsontable */
    nestedHeaders: any[][];
    /** Cáº¥u hÃ¬nh columns cho Handsontable */
    columns: any[];
    /** Máº£ng Ä‘á»™ rá»™ng cá»™t */
    colWidths: number[];
    /** Sá»‘ cá»™t cá»‘ Ä‘á»‹nh bÃªn trÃ¡i */
    fixedColumnsStart: number;
    /** Sá»‘ dÃ²ng header cá»‘ Ä‘á»‹nh trÃªn cÃ¹ng */
    fixedRowsTop: number;
    /** Cáº¥u hÃ¬nh áº©n cá»™t (cá»™t METADATA_ROW) */
    hiddenColumns: { columns: number[]; indicators: boolean };
    /** Cáº¥u hÃ¬nh merge cells */
    mergeCells: any[];
}

@Injectable({ providedIn: 'root' })
export class GridDataMappingService {

    // ==========================================================
    // LOOKUP MAP BUILDERS (Internal helpers)
    // ==========================================================

    /**
     * Táº¡o map: rowCode â†’ visual row index trong Handsontable.
     *
     * VÃ¬ Handsontable dÃ¹ng fixedRowsTop cho header, nÃªn dÃ²ng dá»¯ liá»‡u
     * Ä‘áº§u tiÃªn báº¯t Ä‘áº§u á»Ÿ index = fixedRowsTop.
     *
     * VÃ­ dá»¥ (fixedRowsTop=2):
     *   Row 0,1 = header
     *   Row 2   = rows[0] â†’ rowCode "TONG_CONG_F"
     *   Row 3   = rows[1] â†’ rowCode "CHITIEU_01"
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
     * Táº¡o map ngÆ°á»£c: visual row index â†’ rowCode.
     * DÃ¹ng khi duyá»‡t grid tá»« trÃªn xuá»‘ng Ä‘á»ƒ láº¥y rowCode.
     */
    private buildIndexToRowCodeMap(rows: LayoutRowDef[], fixedRowsTop: number): Map<number, string> {
        const map = new Map<number, string>();
        for (let i = 0; i < rows.length; i++) {
            map.set(i + fixedRowsTop, rows[i].rowCode);
        }
        return map;
    }

    /**
     * Táº¡o map: colCode â†’ column index trong Handsontable.
     *
     * VÃ­ dá»¥:
     *   Col 0 = "METADATA_ROW" (áº©n)
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
     * Táº¡o map ngÆ°á»£c: column index â†’ colCode.
     */
    private buildIndexToColCodeMap(columns: LayoutColumnDef[]): Map<number, string> {
        const map = new Map<number, string>();
        for (let i = 0; i < columns.length; i++) {
            map.set(i, columns[i].colCode);
        }
        return map;
    }

    /**
     * Lá»c ra danh sÃ¡ch cá»™t cho phÃ©p nháº­p liá»‡u:
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
    // Grid â†’ { rowCode, colCode, value }[]
    // ==========================================================

    /**
     * Láº¥y toÃ n bá»™ dá»¯ liá»‡u Ä‘Ã£ nháº­p tá»« Handsontable grid.
     *
     * Quy trÃ¬nh:
     *   1. XÃ¡c Ä‘á»‹nh danh sÃ¡ch cá»™t editable (readOnly=false, khÃ´ng pháº£i METADATA_ROW)
     *   2. Duyá»‡t tá»« dÃ²ng fixedRowsTop Ä‘áº¿n háº¿t
     *   3. Vá»›i má»—i dÃ²ng: láº¥y rowCode tá»« cá»™t 0 (METADATA_ROW)
     *   4. Vá»›i má»—i cá»™t editable: náº¿u cell cÃ³ giÃ¡ trá»‹ â†’ táº¡o GridCellData
     *
     * @param hotInstance - Instance Handsontable Ä‘ang hiá»ƒn thá»‹
     * @param layout      - LayoutJSON tá»« template
     * @returns Máº£ng GridCellData[] chá»‰ chá»©a cÃ¡c Ã´ cÃ³ dá»¯ liá»‡u & editable
     */
    extractGridData(hotInstance: any, layout: LayoutJSON): GridCellData[] {
        const results: GridCellData[] = [];

        if (!hotInstance || !layout) {
            console.warn('[GridDataMapping] extractGridData: hotInstance hoáº·c layout bá»‹ null');
            return results;
        }

        const totalRows = hotInstance.countRows();
        const { fixedRowsTop, columns } = layout;
        const editableCols = this.getEditableColumns(columns);

        // TÃ¬m index cá»™t METADATA_ROW (luÃ´n pháº£i lÃ  cá»™t 0 theo thiáº¿t káº¿)
        const metadataColIndex = this.findMetadataColIndex(columns);

        if (metadataColIndex < 0) {
            console.warn('[GridDataMapping] extractGridData: KhÃ´ng tÃ¬m tháº¥y cá»™t METADATA_ROW!');
            return results;
        }

        // Duyá»‡t tá»«ng dÃ²ng dá»¯ liá»‡u (bá» qua header rows)
        for (let row = fixedRowsTop; row < totalRows; row++) {
            // Láº¥y rowCode tá»« cá»™t áº©n METADATA_ROW
            const rowCode = hotInstance.getDataAtCell(row, metadataColIndex);

            if (!rowCode) {
                console.warn(`[GridDataMapping] extractGridData: DÃ²ng ${row} khÃ´ng cÃ³ rowCode, bá» qua`);
                continue;
            }

            // Kiá»ƒm tra dÃ²ng cÃ³ pháº£i readOnly khÃ´ng (dÃ²ng tá»•ng/cÃ´ng thá»©c)
            const rowDef = layout.rows.find(r => r.rowCode === rowCode);
            if (rowDef?.isReadOnly) {
                continue; // Bá» qua dÃ²ng readOnly (dÃ²ng tá»•ng/cÃ´ng thá»©c)
            }

            // Duyá»‡t tá»«ng cá»™t editable
            for (const { colCode, colIndex } of editableCols) {
                const cellValue = hotInstance.getDataAtCell(row, colIndex);

                // Chá»‰ láº¥y Ã´ cÃ³ dá»¯ liá»‡u (khÃ´ng null, khÃ´ng undefined, khÃ´ng chuá»—i rá»—ng)
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
            `[GridDataMapping] extractGridData: TrÃ­ch xuáº¥t ${results.length} Ã´ dá»¯ liá»‡u`,
            results,
        );

        return results;
    }

    // ==========================================================
    // LOAD FLOW: buildGridData()
    // Template + dbData â†’ Handsontable data[][]
    // ==========================================================

    /**
     * XÃ¢y dá»±ng máº£ng 2D dá»¯ liá»‡u cho Handsontable tá»« template + dbData.
     *
     * Quy trÃ¬nh:
     *   1. Táº¡o máº£ng 2D trá»‘ng (totalRows Ã— totalCols)
     *   2. Äiá»n rowCode vÃ o cá»™t 0 (METADATA_ROW) â€” ráº¥t quan trá»ng!
     *   3. Äiá»n static text (STT, tÃªn chá»‰ tiÃªu) tá»« template.rows
     *   4. Äiá»n cÃ´ng thá»©c tá»« mappings (náº¿u cÃ³)
     *   5. Ãnh xáº¡ dbData vÃ o Ä‘Ãºng Ã´ [rowIndex][colIndex]
     *
     * @param layout - LayoutJSON tá»« template
     * @param dbData - Dá»¯ liá»‡u tá»« database
     * @returns Máº£ng 2D dá»¯ liá»‡u sáºµn sÃ ng load vÃ o Handsontable
     */
    buildGridData(layout: LayoutJSON, dbData: GridCellData[]): any[][] {
        const { columns, rows, fixedRowsTop } = layout;
        const totalCols = columns.length;
        const totalDataRows = rows.length;
        const totalRows = fixedRowsTop + totalDataRows;

        // â”€â”€ BÆ°á»›c 1: Táº¡o máº£ng 2D trá»‘ng â”€â”€
        const data: any[][] = [];

        // Header rows (sáº½ trá»‘ng, vÃ¬ nestedHeaders xá»­ lÃ½ riÃªng)
        for (let h = 0; h < fixedRowsTop; h++) {
            data.push(new Array(totalCols).fill(null));
        }

        // Data rows
        for (let r = 0; r < totalDataRows; r++) {
            data.push(new Array(totalCols).fill(null));
        }

        // â”€â”€ BÆ°á»›c 2: Äiá»n rowCode vÃ o cá»™t METADATA_ROW (cá»™t 0) â”€â”€
        const metadataColIndex = this.findMetadataColIndex(columns);

        if (metadataColIndex < 0) {
            console.warn('[GridDataMapping] buildGridData: KhÃ´ng tÃ¬m tháº¥y cá»™t METADATA_ROW!');
        }

        // â”€â”€ BÆ°á»›c 3: Äiá»n static text tá»« template.rows â”€â”€
        const colCodeToIndex = this.buildColCodeToIndexMap(columns);
        const sttColIndex = colCodeToIndex.get('STT') ?? -1;
        const nameColIndex = colCodeToIndex.get('CHITIEU_NAME') ?? -1;

        for (let i = 0; i < totalDataRows; i++) {
            const rowDef = rows[i];
            const rowIdx = i + fixedRowsTop;

            // Äiá»n rowCode vÃ o cá»™t áº©n
            if (metadataColIndex >= 0) {
                data[rowIdx][metadataColIndex] = rowDef.rowCode;
            }

            // Äiá»n STT (náº¿u cÃ³ cá»™t STT)
            if (sttColIndex >= 0) {
                data[rowIdx][sttColIndex] = this.generateSTT(rowDef, i, rows);
            }

            // Äiá»n tÃªn chá»‰ tiÃªu (náº¿u cÃ³ cá»™t CHITIEU_NAME)
            if (nameColIndex >= 0) {
                // ThÃªm indent dá»±a trÃªn level
                const indent = '  '.repeat(rowDef.level);
                data[rowIdx][nameColIndex] = indent + rowDef.title;
            }
        }

        // â”€â”€ BÆ°á»›c 4: Äiá»n cÃ´ng thá»©c tá»« mappings (náº¿u cÃ³) â”€â”€
        if (layout.mappings) {
            for (const mapping of layout.mappings) {
                if (mapping.cellRole === 'formula' && mapping.formula) {
                    const ri = this.findRowIndex(mapping.rowCode, rows, fixedRowsTop);
                    const ci = colCodeToIndex.get(mapping.colCode);

                    if (ri >= 0 && ci !== undefined) {
                        data[ri][ci] = mapping.formula;
                    } else {
                        console.warn(
                            `[GridDataMapping] buildGridData: KhÃ´ng tÃ¬m tháº¥y vá»‹ trÃ­ cho formula mapping`,
                            { rowCode: mapping.rowCode, colCode: mapping.colCode },
                        );
                    }
                }
            }
        }

        // â”€â”€ BÆ°á»›c 5: Ãnh xáº¡ dbData vÃ o Ä‘Ãºng Ã´ â”€â”€
        const rowCodeToIndex = this.buildRowCodeToIndexMap(rows, fixedRowsTop);
        let populatedCount = 0;
        let skippedCount = 0;

        for (const cellData of dbData) {
            const rowIdx = rowCodeToIndex.get(cellData.rowCode);
            const colIdx = colCodeToIndex.get(cellData.colCode);

            if (rowIdx === undefined) {
                console.warn(
                    `[GridDataMapping] buildGridData: rowCode "${cellData.rowCode}" khÃ´ng tÃ¬m tháº¥y trong template, bá» qua`,
                );
                skippedCount++;
                continue;
            }

            if (colIdx === undefined) {
                console.warn(
                    `[GridDataMapping] buildGridData: colCode "${cellData.colCode}" khÃ´ng tÃ¬m tháº¥y trong template, bá» qua`,
                );
                skippedCount++;
                continue;
            }

            data[rowIdx][colIdx] = cellData.value;
            populatedCount++;
        }

        console.log(
            `[GridDataMapping] buildGridData: Äiá»n ${populatedCount} Ã´, bá» qua ${skippedCount} Ã´`,
        );

        return data;
    }

    // ==========================================================
    // HANDSONTABLE CONFIG BUILDERS
    // ==========================================================

    /**
     * XÃ¢y dá»±ng toÃ n bá»™ config cho Handsontable tá»« layoutJSON + dbData.
     * Gá»i 1 láº§n khi load/render grid.
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
     * Chuyá»ƒn headerRows tá»« layoutJSON thÃ nh format nestedHeaders
     * mÃ  Handsontable hiá»ƒu Ä‘Æ°á»£c.
     *
     * Handsontable nestedHeaders format:
     *   [ ["STT", "Chá»‰ tiÃªu", { label: "NÄƒm N-1", colspan: 2 }, ...],
     *     ["STT", "Chá»‰ tiÃªu", "Thá»±c hiá»‡n", "Káº¿ hoáº¡ch", ...] ]
     */
    buildNestedHeaders(layout: LayoutJSON): any[][] {
        const { headerRows, columns } = layout;

        if (!headerRows || headerRows.length === 0) {
            // Fallback: 1 dÃ²ng header Ä‘Æ¡n giáº£n tá»« column titles
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
     * Táº¡o columns config cho Handsontable.
     *
     * Má»—i cá»™t tráº£ vá» object:
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
     * Táº¡o cells callback cho Handsontable.
     * XÃ¡c Ä‘á»‹nh readOnly, className cho tá»«ng Ã´ dá»±a trÃªn layout.
     */
    buildCellsCallback(layout: LayoutJSON): (row: number, col: number) => any {
        const { columns, rows, fixedRowsTop } = layout;

        return (row: number, col: number): any => {
            const cell: any = {};

            // Header rows â€” luÃ´n readOnly
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

            // â”€â”€ DÃ²ng readOnly (dÃ²ng tá»•ng/cÃ´ng thá»©c) â”€â”€
            if (rowDef.isReadOnly) {
                cell.readOnly = true;
                if (colDef.colCode === 'METADATA_ROW') {
                    // Cá»™t áº©n â€” khÃ´ng style
                } else if (colDef.type === 'text') {
                    cell.className = 'htCenter htMiddle cell-tong';
                } else {
                    cell.className = 'htRight htMiddle cell-tong';
                }
                return cell;
            }

            // â”€â”€ Cá»™t METADATA_ROW (áº©n) â”€â”€
            if (colDef.colCode === 'METADATA_ROW') {
                cell.readOnly = true;
                return cell;
            }

            // â”€â”€ Cá»™t readOnly (STT, tÃªn chá»‰ tiÃªu...) â”€â”€
            if (colDef.readOnly) {
                cell.readOnly = true;
                if (colDef.colCode === 'STT') {
                    cell.className = 'htCenter htMiddle cell-stt';
                } else {
                    cell.className = 'htMiddle cell-noidung';
                }
                return cell;
            }

            // â”€â”€ Cá»™t editable (data) â”€â”€
            cell.readOnly = false;
            cell.className = 'htRight htMiddle cell-editable';
            return cell;
        };
    }

    /**
     * XÃ¡c Ä‘á»‹nh cá»™t nÃ o cáº§n áº©n (METADATA_ROW).
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
     * TÃ¬m index cá»™t METADATA_ROW.
     * Theo thiáº¿t káº¿ luÃ´n lÃ  cá»™t 0, nhÆ°ng tÃ¬m Ä‘á»ƒ Ä‘áº£m báº£o an toÃ n.
     */
    private findMetadataColIndex(columns: LayoutColumnDef[]): number {
        return columns.findIndex(c => c.colCode === 'METADATA_ROW');
    }

    /**
     * TÃ¬m row index thá»±c trong grid tá»« rowCode.
     */
    private findRowIndex(rowCode: string, rows: LayoutRowDef[], fixedRowsTop: number): number {
        const idx = rows.findIndex(r => r.rowCode === rowCode);
        return idx >= 0 ? idx + fixedRowsTop : -1;
    }

    /**
     * Táº¡o STT tá»± Ä‘á»™ng dá»±a trÃªn level vÃ  vá»‹ trÃ­ trong máº£ng rows.
     *
     * Level 0: 1, 2, 3...  (hoáº·c "I", "II"... cho dÃ²ng tá»•ng)
     * Level 1: 1.1, 1.2, 2.1...
     * Level 2: 1.1.1, 1.1.2...
     *
     * Náº¿u dÃ²ng lÃ  isReadOnly (dÃ²ng tá»•ng), tráº£ "" vÃ¬
     * dÃ²ng tá»•ng thÆ°á»ng khÃ´ng cÃ³ STT mÃ  cÃ³ text á»Ÿ cá»™t tÃªn.
     */
    private generateSTT(rowDef: LayoutRowDef, _currentIdx: number, _allRows: LayoutRowDef[]): string {
        // DÃ²ng tá»•ng/formula thÆ°á»ng khÃ´ng cáº§n STT
        if (rowDef.isReadOnly) {
            return '';
        }

        // Náº¿u rowCode cÃ³ dáº¡ng "CHITIEU_01" â†’ trÃ­ch sá»‘ Ä‘á»ƒ táº¡o STT
        // ÄÃ¢y lÃ  giáº£i phÃ¡p Ä‘Æ¡n giáº£n; cho production nÃªn láº¥y STT tá»« template
        const match = rowDef.rowCode.match(/(\d+)$/);
        if (match) {
            return match[1];
        }

        return '';
    }
}
