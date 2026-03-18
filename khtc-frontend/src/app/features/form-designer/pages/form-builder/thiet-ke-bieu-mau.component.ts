import {
  Component, inject, signal, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Handsontable from 'handsontable';
import { BieuMauService } from '../../services/bieu-mau.service';
import { FormTemplate } from '../../../../core/models/form-template.model';

// === Cell type in designer context ===
type CellRole = 'text' | 'data' | 'formula' | 'header';

interface DesignerCell {
  role: CellRole;
  value: any;
  readOnly: boolean;
  formula?: string;
}

interface DesignerColumn {
  key: string;
  title: string;
  width: number;
  role: CellRole;
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
  entValues: string[];
  sceValues: string[];
  yeaValues: string[];
  gridData: any[][];
  nestedHeaders: any[][];
  columns: DesignerColumn[];
  rows: DesignerRow[];
  mergeCells: { row: number; col: number; rowspan: number; colspan: number }[];
  fixedColumnsStart: number;
  fixedRowsTop: number;
  cellMeta: Record<string, { role: CellRole; readOnly: boolean; formula?: string }>;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thiet-ke-bieu-mau.component.html',
  styleUrl: './thiet-ke-bieu-mau.component.scss',
})
export class ThietKeBieuMauComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('hotDesigner') hotDesignerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('formulaInput') formulaInputRef?: ElementRef<HTMLInputElement>;

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

  // === Excel-like features ===
  formulaValue = signal('');
  zoomLevel = signal(100);
  dangChonThamChieuCongThuc = signal(false);
  private formulaTargetCell: { row: number; col: number } | null = null;
  private formulaTargetRange: { r1: number; c1: number; r2: number; c2: number } | null = null;
  private formulaCaretStart = 0;
  private formulaCaretEnd = 0;
  private dangKhoiPhucLuaChonCongThuc = false;

  // === Template info dialog ===
  showInfoDialog = signal(false);
  templateInfo = {
    templateId: '',
    templateName: '',
    version: '2026',
  };

  // === Dimensions (fixed by nghiệp vụ) ===
  entValues: string[] = ['EVN', 'EVNHCMC', 'EVNHANOI'];
  sceValues: string[] = ['KH', 'TH'];
  yeaValues: string[] = ['2025', '2026'];

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

  @HostListener('window:resize')
  onResize(): void {
    this.refreshGridViewport();
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
    const gridHeight = this.calculateGridHeight();

    this.hot = new Handsontable(this.hotDesignerRef.nativeElement, {
      data: defaultData,
      colHeaders: true,
      rowHeaders: true,
      width: '100%',
      height: gridHeight,
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
        if (this.dangKhoiPhucLuaChonCongThuc) {
          this.dangKhoiPhucLuaChonCongThuc = false;
          return;
        }

        if (this.dangChonThamChieuCongThuc() && this.formulaTargetCell && this.formulaTargetRange) {
          const ref = this.buildRangeReference(r, c, r2, c2);
          this.chenThamChieuCongThuc(ref);
          this.dangChonThamChieuCongThuc.set(false);
          this.khoiPhucLuaChonOCongThuc();
          return;
        }

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

    setTimeout(() => this.refreshGridViewport(), 0);
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
    this.cellInfo.set(this.toCellAddress(row, col));
  }

  private loadCellProps(row: number, col: number): void {
    const meta = this.cellMetadata.get(`${row},${col}`);
    const cellValue = this.hot?.getDataAtCell(row, col);
    const formulaFromCell = typeof cellValue === 'string' && cellValue.startsWith('=')
      ? cellValue
      : '';

    if (meta) {
      this.propCellRole = meta.role;
      this.propReadOnly = meta.readOnly;
      this.propFormula = meta.formula || formulaFromCell || '';
    } else {
      // Default to 'data' for all cells (including headers initially)
      this.propCellRole = 'data';
      this.propReadOnly = false;
      this.propFormula = formulaFromCell || '';
    }

    // Get column width (keep for internal use)
    const colWidth = this.hot?.getColWidth(col);
    this.propColWidth = typeof colWidth === 'number' ? colWidth : 100;
  }

  togglePropsPanel(): void {
    this.showPropsPanel.set(!this.showPropsPanel());
    setTimeout(() => this.refreshGridViewport(), 0);
  }

  applyCellProps(): void {
    const sel = this.selectedCell();
    if (!sel) return;

    const range = this.selectedRange();
    const r1 = range?.r1 ?? sel.row;
    const c1 = range?.c1 ?? sel.col;
    const r2 = range?.r2 ?? sel.row;
    const c2 = range?.c2 ?? sel.col;
    const formulaValue = this.propCellRole === 'formula'
      ? this.normalizeFormula(this.propFormula)
      : undefined;

    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        this.cellMetadata.set(`${r},${c}`, {
          role: this.propCellRole,
          readOnly: this.propReadOnly,
          formula: formulaValue,
        });

        if (formulaValue) {
          this.hot?.setDataAtCell(r, c, formulaValue, 'apply-formula');
        }
      }
    }

    this.dangChonThamChieuCongThuc.set(false);
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

  toggleChonThamChieuCongThuc(): void {
    if (this.dangChonThamChieuCongThuc()) {
      this.dangChonThamChieuCongThuc.set(false);
      this.focusFormulaInput();
      return;
    }

    const cell = this.selectedCell();
    const range = this.selectedRange();
    if (!cell || !range) {
      this.notify('Hãy chọn ô công thức trước khi chèn tham chiếu', 'error');
      return;
    }

    this.propCellRole = 'formula';
    this.propReadOnly = true;
    this.formulaTargetCell = { ...cell };
    this.formulaTargetRange = { ...range };

    if (!this.propFormula.trim()) {
      this.propFormula = '=';
      this.formulaCaretStart = 1;
      this.formulaCaretEnd = 1;
    } else {
      this.captureFormulaCaret();
    }

    this.dangChonThamChieuCongThuc.set(true);
    this.focusFormulaInput();
  }

  chenHamCongThuc(tenHam: 'SUM' | 'AVERAGE' | 'MIN' | 'MAX'): void {
    this.propCellRole = 'formula';
    this.propReadOnly = true;

    const prefix = this.propFormula.trim().length === 0 ? '=' : '';
    const text = `${prefix}${tenHam}()`;
    const cursorOffset = prefix.length + tenHam.length + 1;
    this.insertTextVaoCongThuc(text, cursorOffset);
  }

  capNhatConTroCongThuc(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    this.formulaCaretStart = input.selectionStart ?? input.value.length;
    this.formulaCaretEnd = input.selectionEnd ?? input.value.length;
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
      entValues: this.entValues.map(v => v.trim()).filter(Boolean),
      sceValues: this.sceValues.map(v => v.trim()).filter(Boolean),
      yeaValues: this.yeaValues.map(v => v.trim()).filter(Boolean),
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

  private chenThamChieuCongThuc(ref: string): void {
    if (this.propFormula.trim().length === 0) {
      this.propFormula = '=';
      this.formulaCaretStart = 1;
      this.formulaCaretEnd = 1;
    }

    this.insertTextVaoCongThuc(ref);
  }

  private insertTextVaoCongThuc(text: string, cursorOffset = text.length): void {
    const current = this.propFormula || '';
    const start = Math.min(this.formulaCaretStart, current.length);
    const end = Math.min(this.formulaCaretEnd, current.length);

    this.propFormula = current.slice(0, start) + text + current.slice(end);
    const nextPos = start + cursorOffset;
    this.formulaCaretStart = nextPos;
    this.formulaCaretEnd = nextPos;
    this.focusFormulaInput(nextPos);
  }

  private focusFormulaInput(caretPosition?: number): void {
    setTimeout(() => {
      const input = this.formulaInputRef?.nativeElement;
      if (!input) return;

      input.focus();
      const pos = caretPosition ?? this.formulaCaretEnd ?? input.value.length;
      input.setSelectionRange(pos, pos);
    }, 0);
  }

  private captureFormulaCaret(): void {
    const input = this.formulaInputRef?.nativeElement;
    if (!input) return;

    this.formulaCaretStart = input.selectionStart ?? input.value.length;
    this.formulaCaretEnd = input.selectionEnd ?? input.value.length;
  }

  private khoiPhucLuaChonOCongThuc(): void {
    if (!this.hot || !this.formulaTargetRange) return;

    const { r1, c1, r2, c2 } = this.formulaTargetRange;
    this.dangKhoiPhucLuaChonCongThuc = true;
    this.hot.selectCell(r1, c1, r2, c2);
    this.focusFormulaInput();
  }

  private buildRangeReference(r1: number, c1: number, r2: number, c2: number): string {
    const start = this.toCellAddress(Math.min(r1, r2), Math.min(c1, c2));
    const end = this.toCellAddress(Math.max(r1, r2), Math.max(c1, c2));
    return start === end ? start : `${start}:${end}`;
  }

  private toCellAddress(row: number, col: number): string {
    let column = '';
    let current = col;

    while (current >= 0) {
      column = String.fromCharCode((current % 26) + 65) + column;
      current = Math.floor(current / 26) - 1;
    }

    return `${column}${row + 1}`;
  }

  private normalizeFormula(formula: string): string | undefined {
    const value = formula.trim();
    if (!value) return undefined;
    return value.startsWith('=') ? value : `=${value}`;
  }

  private calculateGridHeight(): number {
    const canvas = this.hotDesignerRef?.nativeElement?.parentElement;
    if (!canvas) return 620;

    const rect = canvas.getBoundingClientRect();
    return Math.max(420, Math.floor(rect.height));
  }

  private refreshGridViewport(): void {
    const hot = this.hot;
    if (!hot) return;

    hot.updateSettings({ height: this.calculateGridHeight() });
    hot.render();
  }

  private notify(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }

  // === Properties Panel Handlers ===
  
  onCellRoleChange(): void {
    // Auto-apply when role changes
    this.applyCellProps();
  }

  onReadOnlyChange(): void {
    // Auto-apply when read-only changes
    this.applyCellProps();
  }

  // === Excel-style Formula Bar Methods ===
  
  onFormulaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyFormulaValue();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelFormulaEdit();
    }
  }

  onFormulaFocus(): void {
    // When formula bar is focused, show current cell value
    const sel = this.selectedCell();
    if (sel && this.hot) {
      const cellValue = this.hot.getDataAtCell(sel.row, sel.col);
      this.formulaValue.set(cellValue || '');
    }
  }

  applyFormulaValue(): void {
    const sel = this.selectedCell();
    if (!sel || !this.hot) return;

    const value = this.formulaValue();
    this.hot.setDataAtCell(sel.row, sel.col, value);
    
    // If it's a formula, mark the cell as formula type
    if (value && value.toString().startsWith('=')) {
      this.cellMetadata.set(`${sel.row},${sel.col}`, {
        role: 'formula',
        readOnly: false,
        formula: value.toString(),
      });
      this.propCellRole = 'formula';
      this.hot.render();
    }
    
    // Focus back to grid
    this.hot.selectCell(sel.row, sel.col);
  }

  cancelFormulaEdit(): void {
    // Restore original cell value
    const sel = this.selectedCell();
    if (sel && this.hot) {
      const cellValue = this.hot.getDataAtCell(sel.row, sel.col);
      this.formulaValue.set(cellValue || '');
    }
  }

  // === Dimension values management (ENT/SCE/YEA) ===
  addEntValue(): void { this.entValues.push(''); }
  removeEntValue(index: number): void {
    if (this.entValues.length <= 1) return;
    this.entValues.splice(index, 1);
  }

  addSceValue(): void { this.sceValues.push(''); }
  removeSceValue(index: number): void {
    if (this.sceValues.length <= 1) return;
    this.sceValues.splice(index, 1);
  }

  addYeaValue(): void { this.yeaValues.push(''); }
  removeYeaValue(index: number): void {
    if (this.yeaValues.length <= 1) return;
    this.yeaValues.splice(index, 1);
  }
}
