import {
  Component, inject, signal, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Handsontable from 'handsontable';
import { HyperFormula } from 'hyperformula';
import { BieuMauService } from '../../services/bieu-mau.service';
import { FormTemplate } from '../../../../core/models/form-template.model';

import {
  FormLayoutConfig, ColumnConfig, HeaderRow, HeaderCell, MergeCell,
} from '../../../../core/models/form-template.model';

// === Types ===
type CellRole = 'text' | 'data' | 'formula' | 'header';

/** JSON chuẩn gửi xuống Backend — khớp SYS_FORM_TEMPLATE + SYS_FORM_VERSION + SYS_FORM_MAPPING */
interface ExportedTemplate {
  formId: string;
  formName: string;
  orgList: string[];
  isDynamicRow: boolean;
  layoutConfig: { type: string; allowDynamicRows: boolean; freezeColumns: number };
  version: {
    year: number;
    layoutJSON: FormLayoutConfig;
  };
  mappings: FormMappingExport[];
}

interface FormMappingExport {
  rowKey: string;
  colKey: string;
  accountCode: string;
  cellRole: CellRole;
  formula?: string;
  isReadOnly: boolean;
}

interface FormulaHint {
  name: string;
  syntax: string;
  description: string;
}

const FORMULA_HINTS: FormulaHint[] = [
  { name: 'SUM', syntax: 'SUM(giá_trị1; giá_trị2; ...)', description: 'Tổng các giá trị' },
  { name: 'AVERAGE', syntax: 'AVERAGE(giá_trị1; giá_trị2; ...)', description: 'Trung bình cộng' },
  { name: 'MIN', syntax: 'MIN(giá_trị1; giá_trị2; ...)', description: 'Giá trị nhỏ nhất' },
  { name: 'MAX', syntax: 'MAX(giá_trị1; giá_trị2; ...)', description: 'Giá trị lớn nhất' },
  { name: 'COUNT', syntax: 'COUNT(giá_trị1; giá_trị2; ...)', description: 'Đếm số ô có số' },
  { name: 'COUNTA', syntax: 'COUNTA(giá_trị1; giá_trị2; ...)', description: 'Đếm ô không trống' },
  { name: 'IF', syntax: 'IF(điều_kiện; giá_trị_đúng; giá_trị_sai)', description: 'Điều kiện' },
  { name: 'ROUND', syntax: 'ROUND(số; số_chữ_số)', description: 'Làm tròn' },
  { name: 'ABS', syntax: 'ABS(số)', description: 'Giá trị tuyệt đối' },
  { name: 'SUMIF', syntax: 'SUMIF(vùng_kiểm; tiêu_chí; [vùng_tổng])', description: 'Tổng có điều kiện' },
  { name: 'VLOOKUP', syntax: 'VLOOKUP(giá_trị; bảng; cột; [kiểu])', description: 'Tìm kiếm dọc' },
  { name: 'CONCATENATE', syntax: 'CONCATENATE(chuỗi1; chuỗi2; ...)', description: 'Nối chuỗi' },
];

const REF_COLORS = [
  '#4285f4', '#ea4335', '#34a853', '#ff6d01',
  '#46bdc6', '#7b1fa2', '#c2185b', '#0097a7',
];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thiet-ke-bieu-mau.component.html',
  styleUrl: './thiet-ke-bieu-mau.component.scss',
})
export class ThietKeBieuMauComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('hotDesigner') hotDesignerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('formulaBarInput') formulaBarInputRef?: ElementRef<HTMLInputElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bieuMauService = inject(BieuMauService);

  bieuMau = signal<FormTemplate | null>(null);
  dangTai = signal(false);
  dangLuu = signal(false);
  thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

  hot: Handsontable | null = null;
  formId = '';
  selectedCell = signal<{ row: number; col: number } | null>(null);
  selectedRange = signal<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  cellInfo = signal('');
  gridRows = 20;
  gridCols = 10;
  fixedCols = 0;
  fixedRows = 0;

  cellMetadata: Map<string, { role: CellRole; readOnly: boolean; formula?: string }> = new Map();
  mergedCells: { row: number; col: number; rowspan: number; colspan: number }[] = [];

  showPropsPanel = signal(false);
  propCellRole: CellRole = 'data';
  propReadOnly = false;
  propFormula = '';
  propColWidth = 100;

  // === Formula Mode ===
  isFormulaMode = signal(false);
  formulaBarValue = '';
  formulaBarFocused = signal(false);
  private editingCell: { row: number; col: number } | null = null;
  private activeTextarea: HTMLTextAreaElement | null = null;
  private editorInputHandler: (() => void) | null = null;
  private editorKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private formulaSource: 'cell' | 'bar' = 'bar';
  private suppressEditorOpen = false;

  formulaReferences = signal<{ ref: string; color: string; cells: { row: number; col: number }[] }[]>([]);
  private highlightOverlays: HTMLElement[] = [];

  showFormulaTooltip = signal(false);
  matchedHints = signal<FormulaHint[]>([]);
  tooltipPosition = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  zoomLevel = signal(100);

  showInfoDialog = signal(false);
  templateInfo = { templateId: '', templateName: '', version: '2026' };

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
    this.detachEditorListener();
    this.clearHighlightOverlays();
    this.hot?.destroy();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.refreshGridViewport();
  }

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

  // ==========================================
  // HANDSONTABLE INITIALIZATION
  // ==========================================
  private initDesigner(): void {
    if (!this.hotDesignerRef?.nativeElement) return;

    const hfInstance = HyperFormula.buildEmpty({
      licenseKey: 'internal-use-in-handsontable',
      functionArgSeparator: ';',
      decimalSeparator: '.',
      thousandSeparator: ',',
      smartRounding: true,
    });

    this.hot = new Handsontable(this.hotDesignerRef.nativeElement, {
      data: this.createDefaultGrid(),
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
      formulas: { engine: hfInstance },

      // Intercept clicks in formula mode
      beforeOnCellMouseDown: (event: MouseEvent, coords: { row: number; col: number }) => {
        if (!this.isFormulaMode()) return;
        if (coords.row < 0 || coords.col < 0) return;

        event.stopImmediatePropagation();
        event.preventDefault();

        const ref = this.toCellAddress(coords.row, coords.col);
        this.insertRefAtCursor(ref);
        this.parseAndHighlightReferences(this.getActiveFormulaValue());
      },

      afterSelection: (r: number, c: number, r2: number, c2: number) => {
        if (this.isFormulaMode()) return;

        this.selectedCell.set({ row: r, col: c });
        this.selectedRange.set({ r1: r, c1: c, r2, c2 });
        this.updateCellInfo(r, c);
        this.loadCellProps(r, c);
        this.syncFormulaBar(r, c);
      },

      afterBeginEditing: (row: number, col: number) => {
        if (this.suppressEditorOpen) return;

        this.editingCell = { row, col };
        this.selectedCell.set({ row, col });
        this.updateCellInfo(row, col);

        // HyperFormula automatically puts the formula into the editor textarea
        // Just sync the formula bar
        const sourceValue = this.hot?.getSourceDataAtCell(row, col);
        if (this.isFormula(sourceValue)) {
          this.formulaBarValue = String(sourceValue);
        }

        this.attachEditorListener();
      },

      afterChange: (changes: any, source: string) => {
        if (source === 'loadData' || source === 'formula-commit' || !changes) return;

        for (const [row, prop, , newVal] of changes) {
          const colIdx = typeof prop === 'number' ? prop : parseInt(prop, 10);
          if (isNaN(colIdx)) continue;

          if (this.isFormula(newVal)) {
            this.cellMetadata.set(`${row},${colIdx}`, {
              role: 'formula', readOnly: false, formula: String(newVal),
            });
          }
        }
      },

      afterMergeCells: (_cellRange: any, mergeParent: any, auto: boolean) => {
        if (!auto) {
          const existing = this.mergedCells.find(
            m => m.row === mergeParent.row && m.col === mergeParent.col
          );
          if (!existing) {
            this.mergedCells.push({
              row: mergeParent.row, col: mergeParent.col,
              rowspan: mergeParent.rowspan, colspan: mergeParent.colspan,
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
          if (meta.role === 'header') cellProps.className = 'cell-designer-header';
          else if (meta.role === 'text') cellProps.className = 'cell-designer-text';
          else if (meta.role === 'data') cellProps.className = 'cell-designer-data';
          else if (meta.role === 'formula') cellProps.className = 'cell-designer-formula';
        }
        if (row < this.fixedRows) {
          cellProps.className = (cellProps.className || '') + ' cell-designer-header';
          cellProps.readOnly = false;
        }
        return cellProps;
      },
    });

    setTimeout(() => this.refreshGridViewport(), 0);
  }

  // ==========================================
  // Formula helpers (HyperFormula handles all evaluation)
  // ==========================================

  private isFormula(value: any): boolean {
    return typeof value === 'string' && value.startsWith('=');
  }

  private getSourceFormula(row: number, col: number): string | null {
    if (!this.hot) return null;
    // Try HyperFormula engine first (most reliable for formulas)
    const hfFormula = this.getHyperFormulaCellFormula(row, col);
    if (hfFormula) return hfFormula;
    // Fallback to source data
    const src = this.hot.getSourceDataAtCell(row, col);
    return this.isFormula(src) ? String(src) : null;
  }

  /** Read formula directly from HyperFormula engine — guaranteed correct */
  private getHyperFormulaCellFormula(row: number, col: number): string | null {
    try {
      const plugin = this.hot?.getPlugin('formulas') as any;
      const engine = plugin?.engine;
      if (!engine) return null;
      const sheetName = engine.getSheetName(0);
      if (sheetName === undefined) return null;
      const sheetId = engine.getSheetId(sheetName);
      if (sheetId === undefined) return null;
      const formula = engine.getCellFormula({ sheet: sheetId, row, col });
      return typeof formula === 'string' ? formula : null;
    } catch {
      return null;
    }
  }

  // Used by visual highlight to resolve a range like "A1:B5" into cell coordinates
  private resolveRangeCells(rangeStr: string): { row: number; col: number }[] {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return [];
    const start = this.fromCellAddress(parts[0].trim());
    const end = this.fromCellAddress(parts[1].trim());
    if (!start || !end) return [];

    const cells: { row: number; col: number }[] = [];
    for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
      for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
        cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  // ==========================================
  // Hook into Handsontable TEXTAREA editor
  // ==========================================

  private attachEditorListener(): void {
    this.detachEditorListener();
    if (!this.hot) return;
    const editor = this.hot.getActiveEditor() as any;
    if (!editor?.TEXTAREA) return;

    const textarea: HTMLTextAreaElement = editor.TEXTAREA;
    this.activeTextarea = textarea;

    this.editorInputHandler = () => {
      const value = textarea.value;
      this.formulaBarValue = value;

      if (value.startsWith('=')) {
        if (!this.isFormulaMode()) {
          this.isFormulaMode.set(true);
          this.formulaSource = 'cell';
        }
        this.updateTooltipFromElement(value, textarea);
        this.parseAndHighlightReferences(value);
      } else {
        if (this.isFormulaMode() && this.formulaSource === 'cell') {
          this.cleanupFormulaMode();
        }
      }
    };

    this.editorKeydownHandler = (e: KeyboardEvent) => {
      if (!this.isFormulaMode()) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.commitFormula();
      } else if (e.key === 'Escape') {
        this.cleanupFormulaMode();
      } else if (e.key === 'Tab' && this.showFormulaTooltip() && this.matchedHints().length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.autocompleteHintInEditor(this.matchedHints()[0]);
      }
    };

    textarea.addEventListener('input', this.editorInputHandler);
    textarea.addEventListener('keydown', this.editorKeydownHandler, true);

    // If cell already has a formula, enter formula mode
    setTimeout(() => {
      if (textarea.value.startsWith('=')) {
        this.isFormulaMode.set(true);
        this.formulaSource = 'cell';
        this.formulaBarValue = textarea.value;
        this.updateTooltipFromElement(textarea.value, textarea);
        this.parseAndHighlightReferences(textarea.value);
      }
    }, 0);
  }

  private detachEditorListener(): void {
    if (this.activeTextarea) {
      if (this.editorInputHandler) {
        this.activeTextarea.removeEventListener('input', this.editorInputHandler);
      }
      if (this.editorKeydownHandler) {
        this.activeTextarea.removeEventListener('keydown', this.editorKeydownHandler, true);
      }
    }
    this.activeTextarea = null;
    this.editorInputHandler = null;
    this.editorKeydownHandler = null;
  }

  // ==========================================
  // Formula value getters/setters
  // ==========================================

  private getActiveFormulaValue(): string {
    if (this.formulaSource === 'cell' && this.activeTextarea) return this.activeTextarea.value;
    return this.formulaBarValue;
  }

  private getActiveElement(): HTMLTextAreaElement | HTMLInputElement | null {
    if (this.formulaSource === 'cell' && this.activeTextarea) return this.activeTextarea;
    return this.formulaBarInputRef?.nativeElement ?? null;
  }

  // ==========================================
  // Insert cell reference at cursor
  // ==========================================

  private insertRefAtCursor(ref: string): void {
    const el = this.getActiveElement();
    if (!el) return;

    const value = el.value;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    const charBefore = start > 0 ? value[start - 1] : '';
    const shouldAppendDirectly =
      charBefore === '' || charBefore === '(' || charBefore === ',' ||
      charBefore === ';' || this.isOperatorChar(charBefore);

    let newValue: string;
    let newCursorPos: number;

    if (shouldAppendDirectly) {
      newValue = value.slice(0, start) + ref + value.slice(end);
      newCursorPos = start + ref.length;
    } else {
      let tokenStart = start;
      while (tokenStart > 0 &&
        !this.isOperatorChar(value[tokenStart - 1]) &&
        value[tokenStart - 1] !== '(' &&
        value[tokenStart - 1] !== ',' &&
        value[tokenStart - 1] !== ';') {
        tokenStart--;
      }
      newValue = value.slice(0, tokenStart) + ref + value.slice(end);
      newCursorPos = tokenStart + ref.length;
    }

    el.value = newValue;
    this.formulaBarValue = newValue;

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  private isOperatorChar(ch: string): boolean {
    return ['+', '-', '*', '/', '^', '=', '>', '<', '&'].includes(ch);
  }

  // ==========================================
  // Commit / cleanup formula mode
  // ==========================================

  private commitFormula(): void {
    const cell = this.editingCell ?? this.selectedCell();
    if (!cell || !this.hot) return;

    const formula = this.getActiveFormulaValue();

    const editor = this.hot.getActiveEditor() as any;
    if (editor) {
      editor.finishEditing(true, false);
    }

    // HyperFormula handles evaluation: just set the formula string as cell value
    this.suppressEditorOpen = true;
    this.hot.setDataAtCell(cell.row, cell.col, formula, 'formula-commit');
    this.suppressEditorOpen = false;

    if (this.isFormula(formula)) {
      this.cellMetadata.set(`${cell.row},${cell.col}`, {
        role: 'formula', readOnly: false, formula,
      });
      this.propCellRole = 'formula';
    }

    this.formulaBarValue = formula;
    this.cleanupFormulaMode();
    this.hot.selectCell(cell.row, cell.col);
    this.hot.render();
  }

  private cleanupFormulaMode(): void {
    this.isFormulaMode.set(false);
    this.formulaBarFocused.set(false);
    this.showFormulaTooltip.set(false);
    this.clearHighlightOverlays();
    this.formulaReferences.set([]);
  }

  exitFormulaMode(commit: boolean): void {
    if (commit) {
      this.commitFormula();
    } else {
      const editor = this.hot?.getActiveEditor() as any;
      if (editor) editor.finishEditing(true, false);

      if (this.editingCell && this.hot) {
        const sourceFormula = this.getSourceFormula(this.editingCell.row, this.editingCell.col);
        if (sourceFormula) {
          this.formulaBarValue = sourceFormula;
        } else {
          const cellValue = this.hot.getDataAtCell(this.editingCell.row, this.editingCell.col);
          this.formulaBarValue = cellValue != null ? String(cellValue) : '';
        }
      }
      this.cleanupFormulaMode();
    }
  }

  // ==========================================
  // Formula Bar handlers
  // ==========================================

  onFormulaBarInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formulaBarValue = input.value;

    if (input.value.startsWith('=') && !this.isFormulaMode()) {
      this.isFormulaMode.set(true);
      this.formulaSource = 'bar';
      this.editingCell = this.selectedCell() ? { ...this.selectedCell()! } : null;
    } else if (!input.value.startsWith('=') && this.isFormulaMode() && this.formulaSource === 'bar') {
      this.cleanupFormulaMode();
    }

    if (this.isFormulaMode()) {
      this.updateTooltipFromElement(input.value, input);
      this.parseAndHighlightReferences(input.value);
    }
  }

  onFormulaBarKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.isFormulaMode()) {
        this.commitFormula();
      } else {
        const sel = this.selectedCell();
        if (sel && this.hot) {
          const value = this.formulaBarValue;
          // HyperFormula evaluates formulas: just set the value
          this.hot.setDataAtCell(sel.row, sel.col, value);
          if (this.isFormula(value)) {
            this.cellMetadata.set(`${sel.row},${sel.col}`, {
              role: 'formula', readOnly: false, formula: value,
            });
          }
          this.hot.selectCell(sel.row, sel.col);
        }
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.exitFormulaMode(false);
    } else if (event.key === 'Tab' && this.showFormulaTooltip() && this.matchedHints().length > 0) {
      event.preventDefault();
      this.autocompleteHintInBar(this.matchedHints()[0]);
    }
  }

  onFormulaBarFocus(): void {
    this.formulaBarFocused.set(true);
    const sel = this.selectedCell();
    if (sel && this.hot) {
      const sourceFormula = this.getSourceFormula(sel.row, sel.col);
      if (sourceFormula) {
        this.formulaBarValue = sourceFormula;
        this.isFormulaMode.set(true);
        this.formulaSource = 'bar';
        this.editingCell = { ...sel };
        this.parseAndHighlightReferences(sourceFormula);
      } else {
        const cellValue = this.hot.getDataAtCell(sel.row, sel.col);
        this.formulaBarValue = cellValue != null ? String(cellValue) : '';
      }
    }
  }

  onFormulaBarBlur(): void {
    setTimeout(() => {
      if (!this.isFormulaMode()) {
        this.formulaBarFocused.set(false);
        this.showFormulaTooltip.set(false);
      }
    }, 200);
  }

  // ==========================================
  // Sync formula bar with grid (KEY: show formula not result)
  // ==========================================

  private syncFormulaBar(row: number, col: number): void {
    if (this.isFormulaMode()) return;

    // With HyperFormula: getSourceDataAtCell returns the formula, getDataAtCell returns the result
    const sourceValue = this.hot?.getSourceDataAtCell(row, col);
    if (this.isFormula(sourceValue)) {
      this.formulaBarValue = String(sourceValue);
    } else {
      const cellValue = this.hot?.getDataAtCell(row, col);
      this.formulaBarValue = cellValue != null ? String(cellValue) : '';
    }
  }

  // ==========================================
  // Visual Feedback — Highlight referenced cells
  // ==========================================

  private parseAndHighlightReferences(formula: string): void {
    this.clearHighlightOverlays();
    const refs = this.extractReferences(formula);
    const coloredRefs: { ref: string; color: string; cells: { row: number; col: number }[] }[] = [];
    refs.forEach((ref, idx) => {
      const color = REF_COLORS[idx % REF_COLORS.length];
      const cells = this.resolveRangeCells(ref.includes(':') ? ref : `${ref}:${ref}`);
      if (!ref.includes(':')) {
        const single = this.fromCellAddress(ref);
        if (single) {
          coloredRefs.push({ ref, color, cells: [single] });
          this.renderHighlight([single], color);
          return;
        }
      }
      coloredRefs.push({ ref, color, cells });
      this.renderHighlight(cells, color);
    });
    this.formulaReferences.set(coloredRefs);
  }

  private extractReferences(formula: string): string[] {
    const regex = /\b([A-Z]{1,3}\d{1,5}(?::[A-Z]{1,3}\d{1,5})?)\b/g;
    const refs: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(formula)) !== null) {
      refs.push(match[1]);
    }
    return refs;
  }

  private fromCellAddress(addr: string): { row: number; col: number } | null {
    const match = addr.trim().match(/^([A-Z]{1,3})(\d+)$/);
    if (!match) return null;
    const letters = match[1];
    const rowNum = parseInt(match[2], 10) - 1;
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    return { row: rowNum, col: col - 1 };
  }

  private renderHighlight(cells: { row: number; col: number }[], color: string): void {
    if (!this.hot || cells.length === 0) return;
    const wtHolder = this.hotDesignerRef?.nativeElement?.querySelector('.wtHolder') as HTMLElement;
    if (!wtHolder) return;

    const minRow = Math.min(...cells.map(c => c.row));
    const maxRow = Math.max(...cells.map(c => c.row));
    const minCol = Math.min(...cells.map(c => c.col));
    const maxCol = Math.max(...cells.map(c => c.col));

    const topLeftTd = this.hot.getCell(minRow, minCol);
    const bottomRightTd = this.hot.getCell(maxRow, maxCol);
    if (!topLeftTd || !bottomRightTd) return;

    const holderRect = wtHolder.getBoundingClientRect();
    const tlRect = topLeftTd.getBoundingClientRect();
    const brRect = bottomRightTd.getBoundingClientRect();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;
      top:${tlRect.top - holderRect.top + wtHolder.scrollTop}px;
      left:${tlRect.left - holderRect.left + wtHolder.scrollLeft}px;
      width:${brRect.right - tlRect.left}px;
      height:${brRect.bottom - tlRect.top}px;
      border:2px dashed ${color};
      background:${color}15;
      pointer-events:none;
      z-index:50;
      border-radius:2px;
      box-sizing:border-box;
    `;
    wtHolder.style.position = 'relative';
    wtHolder.appendChild(overlay);
    this.highlightOverlays.push(overlay);
  }

  private clearHighlightOverlays(): void {
    for (const overlay of this.highlightOverlays) overlay.remove();
    this.highlightOverlays = [];
  }

  // ==========================================
  // Formula Tooltip
  // ==========================================

  private updateTooltipFromElement(value: string, el: HTMLElement): void {
    const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    const cursorPos = isInput ? (el.selectionStart ?? value.length) : value.length;
    const textBeforeCursor = value.slice(0, cursorPos);

    const funcMatch = textBeforeCursor.match(/([A-Z]+)\(?$/i);
    if (funcMatch) {
      const partial = funcMatch[1].toUpperCase();
      const matches = FORMULA_HINTS.filter(h => h.name.startsWith(partial));
      if (matches.length > 0) {
        this.matchedHints.set(matches);
        this.showFormulaTooltip.set(true);
        const rect = el.getBoundingClientRect();
        this.tooltipPosition.set({ top: rect.bottom + 4, left: rect.left });
        return;
      }
    }
    this.showFormulaTooltip.set(false);
    this.matchedHints.set([]);
  }

  autocompleteHint(hint: FormulaHint): void {
    if (this.formulaSource === 'cell') {
      this.autocompleteHintInEditor(hint);
    } else {
      this.autocompleteHintInBar(hint);
    }
  }

  private autocompleteHintInBar(hint: FormulaHint): void {
    const input = this.formulaBarInputRef?.nativeElement;
    if (!input) return;
    const current = input.value;
    const cursorPos = input.selectionStart ?? current.length;
    const funcMatch = current.slice(0, cursorPos).match(/([A-Z]+)\(?$/i);
    if (!funcMatch) return;
    const replaceStart = cursorPos - funcMatch[0].length;
    const replacement = hint.name + '(';
    const newValue = current.slice(0, replaceStart) + replacement + current.slice(cursorPos);
    const newPos = replaceStart + replacement.length;
    this.formulaBarValue = newValue;
    this.showFormulaTooltip.set(false);
    setTimeout(() => { input.focus(); input.setSelectionRange(newPos, newPos); }, 0);
  }

  private autocompleteHintInEditor(hint: FormulaHint): void {
    const ta = this.activeTextarea;
    if (!ta) return;
    const current = ta.value;
    const cursorPos = ta.selectionStart ?? current.length;
    const funcMatch = current.slice(0, cursorPos).match(/([A-Z]+)\(?$/i);
    if (!funcMatch) return;
    const replaceStart = cursorPos - funcMatch[0].length;
    const replacement = hint.name + '(';
    const newValue = current.slice(0, replaceStart) + replacement + current.slice(cursorPos);
    const newPos = replaceStart + replacement.length;
    ta.value = newValue;
    this.formulaBarValue = newValue;
    this.showFormulaTooltip.set(false);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(newPos, newPos); }, 0);
  }

  // ==========================================
  // Grid helpers
  // ==========================================

  private createDefaultGrid(): any[][] {
    const data: any[][] = [];
    for (let r = 0; r < this.gridRows; r++) {
      const row: any[] = [];
      for (let c = 0; c < this.gridCols; c++) {
        if (r === 0) {
          if (c === 0) row.push('STT');
          else if (c === 1) row.push('Chỉ tiêu');
          else if (c === 2) row.push('Đơn vị tính');
          else row.push(`Cột ${c - 2}`);
        } else if (r === 1) {
          row.push('');
        } else {
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

  addRow(): void { this.hot?.alter('insert_row_below', this.hot.countRows() - 1, 1); this.gridRows++; }
  addCol(): void { this.hot?.alter('insert_col_end', this.hot.countCols() - 1, 1); this.gridCols++; }
  removeRow(): void {
    const sel = this.selectedCell();
    if (!sel || this.hot!.countRows() <= 3) return;
    this.hot?.alter('remove_row', sel.row, 1); this.gridRows--;
  }
  removeCol(): void {
    const sel = this.selectedCell();
    if (!sel || this.hot!.countCols() <= 3) return;
    this.hot?.alter('remove_col', sel.col, 1); this.gridCols--;
  }

  mergeCellsAction(): void {
    const range = this.selectedRange();
    if (!range) return;
    this.hot?.getPlugin('mergeCells')?.merge(range.r1, range.c1, range.r2, range.c2);
    this.hot?.render();
  }

  unmergeCellsAction(): void {
    const range = this.selectedRange();
    if (!range) return;
    this.hot?.getPlugin('mergeCells')?.unmerge(range.r1, range.c1, range.r2, range.c2);
    this.hot?.render();
  }

  setFixedCols(val: number): void { this.fixedCols = val; this.hot?.updateSettings({ fixedColumnsStart: val }); }
  setFixedRows(val: number): void { this.fixedRows = val; this.hot?.updateSettings({ fixedRowsTop: val }); this.hot?.render(); }

  private updateCellInfo(row: number, col: number): void { this.cellInfo.set(this.toCellAddress(row, col)); }

  private loadCellProps(row: number, col: number): void {
    const meta = this.cellMetadata.get(`${row},${col}`);
    const sourceFormula = this.getSourceFormula(row, col);

    if (meta) {
      this.propCellRole = meta.role;
      this.propReadOnly = meta.readOnly;
      this.propFormula = sourceFormula || meta.formula || '';
    } else {
      this.propCellRole = sourceFormula ? 'formula' : 'data';
      this.propReadOnly = false;
      this.propFormula = sourceFormula || '';
    }
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
    const formulaValue = this.propCellRole === 'formula' ? this.normalizeFormula(this.propFormula) : undefined;

    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        this.cellMetadata.set(`${r},${c}`, { role: this.propCellRole, readOnly: this.propReadOnly, formula: formulaValue });
        if (formulaValue) {
          // HyperFormula evaluates: just set the formula string
          this.hot?.setDataAtCell(r, c, formulaValue, 'formula-commit');
        }
      }
    }
    this.hot?.render();
    this.notify('Đã áp dụng thuộc tính ô', 'success');
  }

  onCellRoleChange(): void { this.applyCellProps(); }
  onReadOnlyChange(): void { this.applyCellProps(); }

  markAs(role: CellRole): void {
    const range = this.selectedRange();
    if (!range) return;
    for (let r = Math.min(range.r1, range.r2); r <= Math.max(range.r1, range.r2); r++) {
      for (let c = Math.min(range.c1, range.c2); c <= Math.max(range.c1, range.c2); c++) {
        const existing = this.cellMetadata.get(`${r},${c}`);
        this.cellMetadata.set(`${r},${c}`, {
          role, readOnly: role === 'header' || role === 'text' || role === 'formula',
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
    console.log('[FormDesigner] Exported:', JSON.stringify(exported, null, 2));
    setTimeout(() => { this.dangLuu.set(false); this.notify('Đã lưu biểu mẫu thành công!', 'success'); }, 800);
  }

  private exportToJson(): ExportedTemplate {
    const sourceData = this.hot!.getSourceData() as any[][];
    const colCount = this.hot!.countCols();
    const rowCount = sourceData.length;

    // --- 1. Detect header rows (rows where ALL cells are text/header, no real data) ---
    const headerRowCount = this.detectHeaderRowCount(sourceData, colCount);

    // --- 2. Build columns (from header row labels + widths + types) ---
    const columns: ColumnConfig[] = [];
    for (let c = 0; c < colCount; c++) {
      const rawWidth = this.hot!.getColWidth(c);
      const width = typeof rawWidth === 'number' ? rawWidth : 100;
      const colKey = this.colIndexToKey(c);
      const title = this.resolveColumnTitle(sourceData, c, headerRowCount);
      const colType = this.inferColumnType(sourceData, c, headerRowCount, rowCount);
      columns.push({ key: colKey, title, width, type: colType });
    }

    // --- 3. Build headerRows (label + rowspan/colspan from merge info) ---
    const mergeCells = this.collectMergeCells();
    const headerRows = this.buildHeaderRows(sourceData, headerRowCount, colCount, mergeCells);

    // --- 4. Build mappings — only cells with formula or explicit role ---
    // Read formula directly from HyperFormula engine for accuracy
    const mappings: FormMappingExport[] = [];
    for (let r = headerRowCount; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const meta = this.cellMetadata.get(`${r},${c}`);
        const hfFormula = this.getHyperFormulaCellFormula(r, c);
        const formula = hfFormula || meta?.formula || null;

        if (formula || (meta && (meta.role === 'formula' || meta.readOnly))) {
          const rowKey = `R${r + 1}`;
          const colKey = this.colIndexToKey(c);
          const rowLabel = this.getRowLabel(sourceData, r, colCount);
          const accountCode = rowLabel
            ? `${this.sanitizeCode(rowLabel)}_${colKey}`
            : `${rowKey}_${colKey}`;

          mappings.push({
            rowKey,
            colKey,
            accountCode,
            cellRole: meta?.role || (formula ? 'formula' : 'data'),
            formula: formula || undefined,
            isReadOnly: meta?.readOnly ?? !!formula,
          });
        }
      }
    }

    // --- 5. Assemble the final structure ---
    const layoutJSON: FormLayoutConfig = {
      columns,
      headerRows,
      mergeCells: mergeCells.length > 0 ? mergeCells : undefined,
      fixedRowsTop: headerRowCount > 0 ? headerRowCount : undefined,
      fixedColumnsLeft: this.fixedCols > 0 ? this.fixedCols : undefined,
    };

    return {
      formId: this.templateInfo.templateId || this.formId || 'NEW_TEMPLATE',
      formName: this.templateInfo.templateName || 'Biểu mẫu mới',
      orgList: this.entValues.map(v => v.trim()).filter(Boolean),
      isDynamicRow: false,
      layoutConfig: {
        type: 'custom',
        allowDynamicRows: false,
        freezeColumns: this.fixedCols,
      },
      version: {
        year: parseInt(this.templateInfo.version, 10) || new Date().getFullYear(),
        layoutJSON,
      },
      mappings,
    };
  }

  // --- Export helpers ---

  private colIndexToKey(col: number): string {
    let key = '';
    let current = col;
    while (current >= 0) {
      key = String.fromCharCode((current % 26) + 65) + key;
      current = Math.floor(current / 26) - 1;
    }
    return key;
  }

  private detectHeaderRowCount(data: any[][], colCount: number): number {
    // Rows where all non-empty cells are strings (labels) = header rows
    // Stop at first row that contains a numeric value or formula in a data column
    let headerRows = 0;
    for (let r = 0; r < data.length; r++) {
      let isHeaderRow = true;
      for (let c = 0; c < colCount; c++) {
        const val = data[r]?.[c];
        if (val === null || val === undefined || val === '') continue;
        if (typeof val === 'number') { isHeaderRow = false; break; }
        if (typeof val === 'string' && val.startsWith('=')) { isHeaderRow = false; break; }
      }
      if (isHeaderRow) {
        headerRows = r + 1;
      } else {
        break;
      }
    }
    return headerRows;
  }

  private resolveColumnTitle(data: any[][], col: number, headerRowCount: number): string {
    // Use the first non-empty value in header rows, or fallback
    for (let r = 0; r < headerRowCount; r++) {
      const val = data[r]?.[col];
      if (val !== null && val !== undefined && val !== '') return String(val);
    }
    return `Col_${col}`;
  }

  private inferColumnType(data: any[][], col: number, startRow: number, rowCount: number): 'text' | 'numeric' {
    // Check data rows to infer type
    for (let r = startRow; r < Math.min(rowCount, startRow + 20); r++) {
      const val = data[r]?.[col];
      if (val === null || val === undefined || val === '') continue;
      if (typeof val === 'number') return 'numeric';
      if (typeof val === 'string') {
        if (val.startsWith('=')) return 'numeric';
        const stripped = val.replace(/,/g, '');
        if (!isNaN(parseFloat(stripped)) && isFinite(Number(stripped))) return 'numeric';
      }
    }
    return 'text';
  }

  private collectMergeCells(): MergeCell[] {
    const mergePlugin = this.hot!.getPlugin('mergeCells');
    const result: MergeCell[] = [];
    if (mergePlugin && (mergePlugin as any).mergedCellsCollection?.mergedCells) {
      for (const mc of (mergePlugin as any).mergedCellsCollection.mergedCells) {
        result.push({ row: mc.row, col: mc.col, rowspan: mc.rowspan, colspan: mc.colspan });
      }
    }
    if (result.length === 0 && this.mergedCells.length > 0) {
      return [...this.mergedCells];
    }
    return result;
  }

  private getRowLabel(data: any[][], row: number, colCount: number): string {
    // Find the first non-empty text value in this row (typically column A or B = row label)
    for (let c = 0; c < Math.min(colCount, 3); c++) {
      const val = data[row]?.[c];
      if (val !== null && val !== undefined && val !== '' && typeof val === 'string' && !val.startsWith('=')) {
        return val.trim();
      }
    }
    return '';
  }

  private sanitizeCode(label: string): string {
    return label
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
      .replace(/[đĐ]/g, 'D')
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '')
      .toUpperCase()
      .substring(0, 30);
  }

  private buildHeaderRows(data: any[][], headerRowCount: number, colCount: number, mergeCells: MergeCell[]): HeaderRow[] {
    const rows: HeaderRow[] = [];

    // Track which cells are "owned" by a merge (non-top-left cells should be skipped)
    const mergeOwner = new Map<string, MergeCell>();
    for (const mc of mergeCells) {
      for (let r = mc.row; r < mc.row + mc.rowspan; r++) {
        for (let c = mc.col; c < mc.col + mc.colspan; c++) {
          mergeOwner.set(`${r},${c}`, mc);
        }
      }
    }

    for (let r = 0; r < headerRowCount; r++) {
      const cells: HeaderCell[] = [];
      for (let c = 0; c < colCount; c++) {
        const key = `${r},${c}`;
        const mc = mergeOwner.get(key);

        if (mc && (mc.row !== r || mc.col !== c)) {
          // This cell is part of a merge but not the top-left → skip
          continue;
        }

        const label = data[r]?.[c] != null ? String(data[r][c]) : '';
        const cell: HeaderCell = { label };

        if (mc) {
          if (mc.rowspan > 1) cell.rowspan = mc.rowspan;
          if (mc.colspan > 1) cell.colspan = mc.colspan;
        }

        cells.push(cell);
      }
      rows.push({ cells });
    }

    return rows;
  }

  exportJsonToClipboard(): void {
    navigator.clipboard.writeText(JSON.stringify(this.exportToJson(), null, 2)).then(() => {
      this.notify('Đã copy JSON vào clipboard!', 'success');
    });
  }

  saveTemplateInfo(): void { this.showInfoDialog.set(false); }
  quayLai(): void { this.router.navigate(['/app/form-designer/templates']); }

  toCellAddress(row: number, col: number): string {
    return `${this.colIndexToKey(col)}${row + 1}`;
  }

  private normalizeFormula(formula: string): string | undefined {
    const value = formula.trim();
    if (!value) return undefined;
    return value.startsWith('=') ? value : `=${value}`;
  }


  private refreshGridViewport(): void {
    if (!this.hot) return;
    this.hot.updateSettings({ height: '100%' });
    this.hot.render();
  }

  private notify(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }

  addEntValue(): void { this.entValues.push(''); }
  removeEntValue(i: number): void { if (this.entValues.length > 1) this.entValues.splice(i, 1); }
  addSceValue(): void { this.sceValues.push(''); }
  removeSceValue(i: number): void { if (this.sceValues.length > 1) this.sceValues.splice(i, 1); }
  addYeaValue(): void { this.yeaValues.push(''); }
  removeYeaValue(i: number): void { if (this.yeaValues.length > 1) this.yeaValues.splice(i, 1); }
}
