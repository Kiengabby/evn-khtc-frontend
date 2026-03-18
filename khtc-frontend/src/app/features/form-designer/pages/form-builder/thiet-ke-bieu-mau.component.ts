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

// === Types ===
type CellRole = 'text' | 'data' | 'formula' | 'header';

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
  fixedCols = 2;
  fixedRows = 2;

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

    this.hot = new Handsontable(this.hotDesignerRef.nativeElement, {
      data: this.createDefaultGrid(),
      colHeaders: true,
      rowHeaders: true,
      width: '100%',
      height: this.calculateGridHeight(),
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

      // When editing starts, hook into the TEXTAREA
      afterBeginEditing: (row: number, col: number) => {
        if (this.suppressEditorOpen) return;

        this.editingCell = { row, col };
        this.selectedCell.set({ row, col });
        this.updateCellInfo(row, col);

        // If this cell has a stored formula, put the formula into the editor
        const meta = this.cellMetadata.get(`${row},${col}`);
        if (meta?.formula) {
          const editor = this.hot?.getActiveEditor() as any;
          if (editor?.TEXTAREA) {
            editor.TEXTAREA.value = meta.formula;
            this.formulaBarValue = meta.formula;
          }
        }

        this.attachEditorListener();
      },

      afterChange: (changes: any, source: string) => {
        if (source === 'loadData') return;
        if (!changes) return;

        // If the change came from our own recalculation, don't recurse
        if (source === 'formula-commit') {
          return;
        }

        let hasNewFormula = false;

        for (const [row, prop, , newVal] of changes) {
          const colIdx = typeof prop === 'number' ? prop : parseInt(prop, 10);
          if (isNaN(colIdx)) continue;

          if (typeof newVal === 'string' && newVal.startsWith('=')) {
            const result = this.evaluateFormula(newVal, row, colIdx);
            this.cellMetadata.set(`${row},${colIdx}`, {
              role: 'formula', readOnly: false, formula: newVal,
            });
            this.suppressEditorOpen = true;
            this.hot?.setDataAtCell(row, colIdx, result, 'formula-commit');
            this.suppressEditorOpen = false;
            hasNewFormula = true;
          }
        }

        // Recalculate ALL existing formula cells whenever any cell value changes
        if (!hasNewFormula) {
          this.recalculateAllFormulas();
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
  // FORMULA EVALUATOR
  // ==========================================

  private evaluateFormula(formula: string, sourceRow: number, sourceCol: number): any {
    if (!formula.startsWith('=') || !this.hot) return formula;

    try {
      const expr = formula.substring(1).trim();
      return this.evalExpression(expr, sourceRow, sourceCol);
    } catch (e) {
      console.warn('[FormulaEval] Error:', e);
      return '#ERROR!';
    }
  }

  private evalExpression(expr: string, srcRow: number, srcCol: number): any {
    // Try to match a function call: FUNCNAME(args)
    const funcMatch = expr.match(/^([A-Z]+)\((.+)\)$/i);
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const argsStr = funcMatch[2];
      return this.evalFunction(funcName, argsStr, srcRow, srcCol);
    }

    // Try arithmetic: split by + - * /
    // Handle simple binary operations
    const arithmeticResult = this.evalArithmetic(expr, srcRow, srcCol);
    if (arithmeticResult !== null) return arithmeticResult;

    // Single cell reference
    const cellRef = this.fromCellAddress(expr.trim());
    if (cellRef) {
      return this.getCellNumericValue(cellRef.row, cellRef.col);
    }

    // Literal number
    const num = parseFloat(expr);
    if (!isNaN(num)) return num;

    return '#ERROR!';
  }

  private evalFunction(funcName: string, argsStr: string, srcRow: number, srcCol: number): any {
    // Collect all numeric values from arguments (supports ranges, refs, and literals)
    const values = this.resolveArgValues(argsStr, srcRow, srcCol);

    switch (funcName) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0);
      case 'AVERAGE': {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
      }
      case 'MIN':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'MAX':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'COUNT':
        return values.length;
      case 'ABS':
        return values.length > 0 ? Math.abs(values[0]) : 0;
      case 'ROUND': {
        const args = this.splitArgs(argsStr);
        const num = this.resolveArgValues(args[0] || '0', srcRow, srcCol)[0] ?? 0;
        const decimals = this.resolveArgValues(args[1] || '0', srcRow, srcCol)[0] ?? 0;
        return parseFloat(num.toFixed(decimals));
      }
      case 'IF': {
        const args = this.splitArgs(argsStr);
        const condition = this.resolveArgValues(args[0] || '0', srcRow, srcCol)[0] ?? 0;
        if (condition) {
          return this.resolveArgValues(args[1] || '0', srcRow, srcCol)[0] ?? 0;
        }
        return this.resolveArgValues(args[2] || '0', srcRow, srcCol)[0] ?? 0;
      }
      case 'COUNTA': {
        // Count non-empty values
        const allArgs = this.splitArgs(argsStr);
        let count = 0;
        for (const arg of allArgs) {
          const trimmed = arg.trim();
          if (trimmed.includes(':')) {
            const cells = this.resolveRangeCells(trimmed);
            for (const c of cells) {
              const v = this.hot?.getDataAtCell(c.row, c.col);
              if (v !== null && v !== undefined && v !== '') count++;
            }
          } else {
            const ref = this.fromCellAddress(trimmed);
            if (ref) {
              const v = this.hot?.getDataAtCell(ref.row, ref.col);
              if (v !== null && v !== undefined && v !== '') count++;
            }
          }
        }
        return count;
      }
      default:
        return '#NAME?';
    }
  }

  private resolveArgValues(argsStr: string, _srcRow: number, _srcCol: number): number[] {
    const args = this.splitArgs(argsStr);
    const values: number[] = [];

    for (const arg of args) {
      const trimmed = arg.trim();

      // Range reference: A1:B5
      if (trimmed.includes(':')) {
        const cells = this.resolveRangeCells(trimmed);
        for (const c of cells) {
          const v = this.getCellNumericValue(c.row, c.col);
          if (typeof v === 'number' && !isNaN(v)) values.push(v);
        }
        continue;
      }

      // Single cell reference
      const cellRef = this.fromCellAddress(trimmed);
      if (cellRef) {
        const v = this.getCellNumericValue(cellRef.row, cellRef.col);
        if (typeof v === 'number' && !isNaN(v)) values.push(v);
        continue;
      }

      // Literal number
      const num = parseFloat(trimmed);
      if (!isNaN(num)) {
        values.push(num);
      }
    }

    return values;
  }

  private splitArgs(argsStr: string): string[] {
    // Split by ; or , respecting parentheses depth
    const args: string[] = [];
    let depth = 0;
    let current = '';

    for (const ch of argsStr) {
      if (ch === '(') {
        depth++;
        current += ch;
      } else if (ch === ')') {
        depth--;
        current += ch;
      } else if ((ch === ';' || ch === ',') && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) args.push(current.trim());
    return args;
  }

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

  private getCellNumericValue(row: number, col: number): number {
    if (!this.hot) return 0;
    const raw = this.hot.getDataAtCell(row, col);
    if (raw === null || raw === undefined || raw === '') return 0;
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return isNaN(num) ? 0 : num;
  }

  private evalArithmetic(expr: string, _srcRow: number, _srcCol: number): number | null {
    // Simple arithmetic: only handles A1+B1, A1-B1, A1*B1, A1/B1
    const opMatch = expr.match(/^(.+?)\s*([+\-*/])\s*(.+)$/);
    if (!opMatch) return null;

    const leftStr = opMatch[1].trim();
    const op = opMatch[2];
    const rightStr = opMatch[3].trim();

    const left = this.resolveScalar(leftStr);
    const right = this.resolveScalar(rightStr);

    if (left === null || right === null) return null;

    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return right !== 0 ? left / right : '#DIV/0!' as any;
      default: return null;
    }
  }

  private resolveScalar(token: string): number | null {
    const num = parseFloat(token);
    if (!isNaN(num)) return num;

    const ref = this.fromCellAddress(token);
    if (ref) return this.getCellNumericValue(ref.row, ref.col);

    return null;
  }

  // ==========================================
  // Recalculate all formula cells
  // ==========================================

  private recalculateAllFormulas(): void {
    if (!this.hot) return;

    const updates: [number, number, any][] = [];

    this.cellMetadata.forEach((meta, key) => {
      if (!meta.formula) return;

      const [rowStr, colStr] = key.split(',');
      const row = parseInt(rowStr, 10);
      const col = parseInt(colStr, 10);
      const newResult = this.evaluateFormula(meta.formula, row, col);
      const currentValue = this.hot!.getDataAtCell(row, col);

      // Only update if result actually changed to avoid infinite loops
      if (currentValue !== newResult) {
        updates.push([row, col, newResult]);
      }
    });

    if (updates.length > 0) {
      this.suppressEditorOpen = true;
      for (const [row, col, value] of updates) {
        this.hot!.setDataAtCell(row, col, value, 'formula-commit');
      }
      this.suppressEditorOpen = false;
    }
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

    // Close editor without saving (we'll write the result ourselves)
    const editor = this.hot.getActiveEditor() as any;
    if (editor) {
      editor.finishEditing(true, false);
    }

    if (formula.startsWith('=')) {
      // Evaluate and display result, store formula in metadata
      const result = this.evaluateFormula(formula, cell.row, cell.col);

      this.cellMetadata.set(`${cell.row},${cell.col}`, {
        role: 'formula', readOnly: false, formula: formula,
      });

      this.suppressEditorOpen = true;
      this.hot.setDataAtCell(cell.row, cell.col, result, 'formula-commit');
      this.suppressEditorOpen = false;

      this.propCellRole = 'formula';
      this.formulaBarValue = formula;
    } else {
      this.hot.setDataAtCell(cell.row, cell.col, formula, 'formula-commit');
      this.formulaBarValue = formula;
    }

    this.cleanupFormulaMode();
    this.hot.selectCell(cell.row, cell.col);

    // Recalc other formulas that might depend on this cell
    this.recalculateAllFormulas();
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
        const meta = this.cellMetadata.get(`${this.editingCell.row},${this.editingCell.col}`);
        if (meta?.formula) {
          this.formulaBarValue = meta.formula;
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
          if (value.startsWith('=')) {
            const result = this.evaluateFormula(value, sel.row, sel.col);
            this.cellMetadata.set(`${sel.row},${sel.col}`, {
              role: 'formula', readOnly: false, formula: value,
            });
            this.hot.setDataAtCell(sel.row, sel.col, result, 'formula-commit');
          } else {
            this.hot.setDataAtCell(sel.row, sel.col, value);
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
      // Show formula if cell has one, otherwise show display value
      const meta = this.cellMetadata.get(`${sel.row},${sel.col}`);
      if (meta?.formula) {
        this.formulaBarValue = meta.formula;
        this.isFormulaMode.set(true);
        this.formulaSource = 'bar';
        this.editingCell = { ...sel };
        this.parseAndHighlightReferences(meta.formula);
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

    const meta = this.cellMetadata.get(`${row},${col}`);
    if (meta?.formula) {
      // Cell has a formula → show formula in bar
      this.formulaBarValue = meta.formula;
    } else {
      // Normal cell → show display value
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
    const cellValue = this.hot?.getDataAtCell(row, col);
    const formulaFromMeta = meta?.formula || '';

    if (meta) {
      this.propCellRole = meta.role;
      this.propReadOnly = meta.readOnly;
      this.propFormula = formulaFromMeta;
    } else {
      this.propCellRole = 'data';
      this.propReadOnly = false;
      this.propFormula = (typeof cellValue === 'string' && cellValue.startsWith('=')) ? cellValue : '';
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
          const result = this.evaluateFormula(formulaValue, r, c);
          this.hot?.setDataAtCell(r, c, result, 'formula-commit');
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
    const data = this.hot!.getData();
    const colCount = this.hot!.countCols();

    const columns: DesignerColumn[] = [];
    for (let c = 0; c < colCount; c++) {
      const headerValue = data[0]?.[c] || `Col_${c}`;
      const width = this.hot!.getColWidth(c) || 100;
      const meta = this.cellMetadata.get(`${this.fixedRows},${c}`);
      columns.push({
        key: String.fromCharCode(65 + c), title: String(headerValue),
        width: typeof width === 'number' ? width : 100,
        role: meta?.role || (c < this.fixedCols ? 'text' : 'data'),
      });
    }

    const rows: DesignerRow[] = [];
    for (let r = this.fixedRows; r < data.length; r++) {
      const firstDataMeta = this.cellMetadata.get(`${r},${this.fixedCols}`);
      rows.push({ key: `R${r - this.fixedRows + 1}`, role: firstDataMeta?.role === 'formula' ? 'formula' : 'data', formula: firstDataMeta?.formula });
    }

    const cellMeta: Record<string, { role: CellRole; readOnly: boolean; formula?: string }> = {};
    this.cellMetadata.forEach((value, key) => { cellMeta[key] = value; });

    const nestedHeaders: any[][] = [];
    for (let r = 0; r < this.fixedRows; r++) nestedHeaders.push(data[r] || []);

    const mergePlugin = this.hot!.getPlugin('mergeCells');
    const mergedCells: any[] = [];
    if (mergePlugin && (mergePlugin as any).mergedCellsCollection?.mergedCells) {
      for (const mc of (mergePlugin as any).mergedCellsCollection.mergedCells) {
        mergedCells.push({ row: mc.row, col: mc.col, rowspan: mc.rowspan, colspan: mc.colspan });
      }
    }

    return {
      templateId: this.templateInfo.templateId || this.formId || 'NEW_TEMPLATE',
      templateName: this.templateInfo.templateName || 'Biểu mẫu mới',
      version: this.templateInfo.version,
      entValues: this.entValues.map(v => v.trim()).filter(Boolean),
      sceValues: this.sceValues.map(v => v.trim()).filter(Boolean),
      yeaValues: this.yeaValues.map(v => v.trim()).filter(Boolean),
      gridData: data, nestedHeaders, columns, rows,
      mergeCells: mergedCells.length > 0 ? mergedCells : this.mergedCells,
      fixedColumnsStart: this.fixedCols, fixedRowsTop: this.fixedRows, cellMeta,
    };
  }

  exportJsonToClipboard(): void {
    navigator.clipboard.writeText(JSON.stringify(this.exportToJson(), null, 2)).then(() => {
      this.notify('Đã copy JSON vào clipboard!', 'success');
    });
  }

  saveTemplateInfo(): void { this.showInfoDialog.set(false); }
  quayLai(): void { this.router.navigate(['/app/form-designer/templates']); }

  toCellAddress(row: number, col: number): string {
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
    return Math.max(420, Math.floor(canvas.getBoundingClientRect().height));
  }

  private refreshGridViewport(): void {
    if (!this.hot) return;
    this.hot.updateSettings({ height: this.calculateGridHeight() });
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
