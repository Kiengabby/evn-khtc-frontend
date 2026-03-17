import {
  Component, inject, signal, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Handsontable from 'handsontable';
import { BieuMauService } from '../../services/bieu-mau.service';
import { FormTemplate } from '../../../../core/models/form-template.model';

// === Cell type in designer context ===
type CellRole = 'text' | 'dim' | 'data' | 'formula' | 'header';

interface DesignerCell {
  role: CellRole;
  value: any;
  readOnly: boolean;
  dimKey?: string;
  formula?: string;
}

interface DesignerColumn {
  key: string;
  title: string;
  width: number;
  role: CellRole;
  dimKey?: string;
}

interface DesignerRow {
  key: string;
  role: 'data' | 'formula' | 'header';
  formula?: string;
}

// The JSON structure we export for BE
interface ExportedTemplate {
  templateId: string;
  templateName: string;
  version: string;
  description: string;
  gridData: any[][];
  nestedHeaders: any[][];
  columns: DesignerColumn[];
  rows: DesignerRow[];
  mergeCells: { row: number; col: number; rowspan: number; colspan: number }[];
  fixedColumnsStart: number;
  fixedRowsTop: number;
  cellMeta: Record<string, { role: CellRole; readOnly: boolean; formula?: string; dimKey?: string }>;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thiet-ke-bieu-mau.component.html',
  styleUrl: './thiet-ke-bieu-mau.component.scss',
})
export class ThietKeBieuMauComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('hotDesigner') hotDesignerRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bieuMauService = inject(BieuMauService);

  // === State ===
  bieuMau = signal<FormTemplate | null>(null);
  dangTai = signal(false);
  dangLuu = signal(false);
  thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

  // === Designer state ===
  hot: Handsontable | null = null;
  formId = '';
  selectedCell = signal<{ row: number; col: number } | null>(null);
  selectedRange = signal<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  cellInfo = signal('');
  gridRows = 10;
  gridCols = 8;
  fixedCols = 2;
  fixedRows = 2;

  // Cell metadata storage: "row,col" -> metadata
  cellMetadata: Map<string, { role: CellRole; readOnly: boolean; formula?: string }> = new Map();
  mergedCells: { row: number; col: number; rowspan: number; colspan: number }[] = [];

  // === Properties panel ===
  showPropsPanel = signal(false);
  propCellRole: CellRole = 'data';
  propReadOnly = false;
  propFormula = '';
  propColWidth = 100;

  // === Template info dialog ===
  showInfoDialog = signal(false);
  templateInfo = {
    templateId: '',
    templateName: '',
    version: '2026',
    description: '',
  };

  // === Lifecycle ===

  async ngOnInit(): Promise<void> {
    this.formId = this.route.snapshot.paramMap.get('id') || '';
    if (this.formId) {
      await this.loadTemplate();
    } else {
      this.showInfoDialog.set(true);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initDesigner(), 100);
  }

  ngOnDestroy(): void {
    this.hot?.destroy();
  }

  // === Load existing template ===
  private async loadTemplate(): Promise<void> {
    this.dangTai.set(true);
    try {
      const kq = await this.bieuMauService.layTheoId(this.formId);
      if (kq.trangThai && kq.duLieu) {
        this.bieuMau.set(kq.duLieu);
        this.templateInfo.templateId = kq.duLieu.formId;
        this.templateInfo.templateName = kq.duLieu.formName;
      }
    } catch {
      this.notify('Không tải được biểu mẫu', 'error');
    }
    this.dangTai.set(false);
  }

  // === Initialize Handsontable Designer ===
  private initDesigner(): void {
    if (!this.hotDesignerRef?.nativeElement) return;

    const defaultData = this.createDefaultGrid();

    this.hot = new Handsontable(this.hotDesignerRef.nativeElement, {
      data: defaultData,
      colHeaders: true,
      rowHeaders: true,
      width: '100%',
      height: '100%',
      stretchH: 'none',
      licenseKey: 'non-commercial-and-evaluation',

      manualColumnResize: true,
      manualRowResize: true,
      manualColumnMove: true,
      contextMenu: true,
      mergeCells: true,
      undo: true,
      copyPaste: true,
      fillHandle: true,
      autoWrapRow: true,
      autoWrapCol: true,
      outsideClickDeselects: false,

      fixedColumnsStart: this.fixedCols,
      fixedRowsTop: this.fixedRows,

      className: 'designer-grid',

      colWidths: this.createDefaultColWidths(),

      afterSelection: (r: number, c: number, r2: number, c2: number) => {
        this.selectedCell.set({ row: r, col: c });
        this.selectedRange.set({ r1: r, c1: c, r2, c2 });
        this.updateCellInfo(r, c);
        this.loadCellProps(r, c);
      },

      afterChange: (changes: any, source: string) => {
        if (source === 'loadData') return;
      },

      afterMergeCells: (cellRange: any, mergeParent: any, auto: boolean) => {
        if (!auto) {
          const existing = this.mergedCells.find(
            m => m.row === mergeParent.row && m.col === mergeParent.col
          );
          if (!existing) {
            this.mergedCells.push({
              row: mergeParent.row,
              col: mergeParent.col,
              rowspan: mergeParent.rowspan,
              colspan: mergeParent.colspan,
            });
          }
        }
      },

      afterUnmergeCells: (cellRange: any, auto: boolean) => {
        if (!auto) {
          this.mergedCells = this.mergedCells.filter(
            m => !(m.row === cellRange.from.row && m.col === cellRange.from.col)
          );
        }
      },

      cells: (row: number, col: number) => {
        const meta = this.cellMetadata.get(`${row},${col}`);
        const cellProps: any = {};

        if (meta) {
          cellProps.readOnly = meta.readOnly;

          if (meta.role === 'header') {
            cellProps.className = 'cell-designer-header';
          } else if (meta.role === 'text') {
            cellProps.className = 'cell-designer-text';
          } else if (meta.role === 'dim') {
            cellProps.className = 'cell-designer-dim';
          } else if (meta.role === 'data') {
            cellProps.className = 'cell-designer-data';
          } else if (meta.role === 'formula') {
            cellProps.className = 'cell-designer-formula';
          }
        }

        // Header rows styling
        if (row < this.fixedRows) {
          cellProps.className = (cellProps.className || '') + ' cell-designer-header';
          cellProps.readOnly = false;
        }

        return cellProps;
      },
    });
  }

  private createDefaultGrid(): any[][] {
    const data: any[][] = [];
    for (let r = 0; r < this.gridRows; r++) {
      const row: any[] = [];
      for (let c = 0; c < this.gridCols; c++) {
        if (r === 0) {
          // First header row - group headers
          if (c === 0) row.push('STT');
          else if (c === 1) row.push('Chỉ tiêu');
          else if (c === 2) row.push('Đơn vị tính');
          else row.push(`Cột ${c - 2}`);
        } else if (r === 1) {
          // Second header row - sub-headers
          if (c <= 2) row.push('');
          else row.push('');
        } else {
          // Data rows
          if (c === 0) row.push(String(r - 1));
          else if (c === 1) row.push('');
          else row.push(null);
        }
      }
      data.push(row);
    }
    return data;
  }

  private createDefaultColWidths(): number[] {
    const widths: number[] = [];
    for (let c = 0; c < this.gridCols; c++) {
      if (c === 0) widths.push(50);
      else if (c === 1) widths.push(200);
      else if (c === 2) widths.push(100);
      else widths.push(120);
    }
    return widths;
  }

  // === Toolbar Actions ===

  addRow(): void {
    this.hot?.alter('insert_row_below', this.hot.countRows() - 1, 1);
    this.gridRows++;
  }

  addCol(): void {
    this.hot?.alter('insert_col_end', this.hot.countCols() - 1, 1);
    this.gridCols++;
  }

  removeRow(): void {
    const sel = this.selectedCell();
    if (!sel || this.hot!.countRows() <= 3) return;
    this.hot?.alter('remove_row', sel.row, 1);
    this.gridRows--;
  }

  removeCol(): void {
    const sel = this.selectedCell();
    if (!sel || this.hot!.countCols() <= 3) return;
    this.hot?.alter('remove_col', sel.col, 1);
    this.gridCols--;
  }

  mergeCellsAction(): void {
    const range = this.selectedRange();
    if (!range) return;

    const plugin = this.hot?.getPlugin('mergeCells');
    if (!plugin) return;

    plugin.merge(range.r1, range.c1, range.r2, range.c2);
    this.hot?.render();
  }

  unmergeCellsAction(): void {
    const range = this.selectedRange();
    if (!range) return;

    const plugin = this.hot?.getPlugin('mergeCells');
    if (!plugin) return;

    plugin.unmerge(range.r1, range.c1, range.r2, range.c2);
    this.hot?.render();
  }

  setFixedCols(val: number): void {
    this.fixedCols = val;
    this.hot?.updateSettings({ fixedColumnsStart: val });
  }

  setFixedRows(val: number): void {
    this.fixedRows = val;
    this.hot?.updateSettings({ fixedRowsTop: val });
    this.hot?.render();
  }

  // === Cell Properties ===

  private updateCellInfo(row: number, col: number): void {
    const colLetter = String.fromCharCode(65 + (col % 26));
    this.cellInfo.set(`${colLetter}${row + 1}`);
  }

  private loadCellProps(row: number, col: number): void {
    const meta = this.cellMetadata.get(`${row},${col}`);
    if (meta) {
      this.propCellRole = meta.role;
      this.propReadOnly = meta.readOnly;
      this.propFormula = meta.formula || '';
    } else {
      this.propCellRole = row < this.fixedRows ? 'header' : 'data';
      this.propReadOnly = false;
      this.propFormula = '';
    }

    // Get column width
    const colWidth = this.hot?.getColWidth(col);
    this.propColWidth = typeof colWidth === 'number' ? colWidth : 100;
  }

  togglePropsPanel(): void {
    this.showPropsPanel.set(!this.showPropsPanel());
  }

  applyCellProps(): void {
    const sel = this.selectedCell();
    if (!sel) return;

    const range = this.selectedRange();
    const r1 = range?.r1 ?? sel.row;
    const c1 = range?.c1 ?? sel.col;
    const r2 = range?.r2 ?? sel.row;
    const c2 = range?.c2 ?? sel.col;

    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        this.cellMetadata.set(`${r},${c}`, {
          role: this.propCellRole,
          readOnly: this.propReadOnly,
          formula: this.propFormula || undefined,
        });
      }
    }

    this.hot?.render();
    this.notify('Đã áp dụng thuộc tính ô', 'success');
  }

  applyColWidth(): void {
    const sel = this.selectedCell();
    if (!sel) return;

    const plugin = this.hot?.getPlugin('manualColumnResize');
    if (plugin) {
      plugin.setManualSize(sel.col, this.propColWidth);
      this.hot?.render();
    }
  }

  // Quick role buttons for marking cell types
  markAs(role: CellRole): void {
    const range = this.selectedRange();
    if (!range) return;

    for (let r = Math.min(range.r1, range.r2); r <= Math.max(range.r1, range.r2); r++) {
      for (let c = Math.min(range.c1, range.c2); c <= Math.max(range.c1, range.c2); c++) {
        const existing = this.cellMetadata.get(`${r},${c}`);
        this.cellMetadata.set(`${r},${c}`, {
          role,
          readOnly: role === 'header' || role === 'text' || role === 'formula',
          formula: existing?.formula,
        });
      }
    }

    this.hot?.render();
  }

  // === Save / Export ===

  saveTemplate(): void {
    if (!this.hot) return;
    this.dangLuu.set(true);

    const exported = this.exportToJson();
    console.log('[FormDesigner] Exported Template JSON:', exported);
    console.log('[FormDesigner] JSON string:', JSON.stringify(exported, null, 2));

    // Mock save
    setTimeout(() => {
      this.dangLuu.set(false);
      this.notify('Đã lưu biểu mẫu thành công!', 'success');
    }, 800);
  }

  private exportToJson(): ExportedTemplate {
    const data = this.hot!.getData();
    const colCount = this.hot!.countCols();

    // Build columns info
    const columns: DesignerColumn[] = [];
    for (let c = 0; c < colCount; c++) {
      const headerValue = data[0]?.[c] || `Col_${c}`;
      const width = this.hot!.getColWidth(c) || 100;
      const meta = this.cellMetadata.get(`${this.fixedRows},${c}`);

      columns.push({
        key: String.fromCharCode(65 + c),
        title: String(headerValue),
        width: typeof width === 'number' ? width : 100,
        role: meta?.role || (c < this.fixedCols ? 'text' : 'data'),
      });
    }

    // Build rows info
    const rows: DesignerRow[] = [];
    for (let r = this.fixedRows; r < data.length; r++) {
      const firstDataMeta = this.cellMetadata.get(`${r},${this.fixedCols}`);
      rows.push({
        key: `R${r - this.fixedRows + 1}`,
        role: firstDataMeta?.role === 'formula' ? 'formula' : 'data',
        formula: firstDataMeta?.formula,
      });
    }

    // Build cellMeta
    const cellMeta: Record<string, { role: CellRole; readOnly: boolean; formula?: string; dimKey?: string }> = {};
    this.cellMetadata.forEach((value, key) => {
      cellMeta[key] = value;
    });

    // Get nested headers (first N rows = fixedRows)
    const nestedHeaders: any[][] = [];
    for (let r = 0; r < this.fixedRows; r++) {
      nestedHeaders.push(data[r] || []);
    }

    // Get merged cells from plugin
    const mergePlugin = this.hot!.getPlugin('mergeCells');
    const mergedCells: any[] = [];
    if (mergePlugin && (mergePlugin as any).mergedCellsCollection) {
      const collection = (mergePlugin as any).mergedCellsCollection;
      if (collection.mergedCells) {
        for (const mc of collection.mergedCells) {
          mergedCells.push({
            row: mc.row,
            col: mc.col,
            rowspan: mc.rowspan,
            colspan: mc.colspan,
          });
        }
      }
    }

    return {
      templateId: this.templateInfo.templateId || this.formId || 'NEW_TEMPLATE',
      templateName: this.templateInfo.templateName || 'Biểu mẫu mới',
      version: this.templateInfo.version,
      description: this.templateInfo.description,
      gridData: data,
      nestedHeaders,
      columns,
      rows,
      mergeCells: mergedCells.length > 0 ? mergedCells : this.mergedCells,
      fixedColumnsStart: this.fixedCols,
      fixedRowsTop: this.fixedRows,
      cellMeta,
    };
  }

  exportJsonToClipboard(): void {
    const json = this.exportToJson();
    const text = JSON.stringify(json, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      this.notify('Đã copy JSON vào clipboard!', 'success');
    });
  }

  // === Template Info Dialog ===

  saveTemplateInfo(): void {
    this.showInfoDialog.set(false);
  }

  // === Navigation ===

  quayLai(): void {
    this.router.navigate(['/app/form-designer/templates']);
  }

  // === Helpers ===

  private notify(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }
}
