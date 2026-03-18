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
  { name: 'SUM', syntax: 'SUM(giá_trị1; [giá_trị2; ...])', description: 'Tổng các giá trị' },
  { name: 'AVERAGE', syntax: 'AVERAGE(giá_trị1; [giá_trị2; ...])', description: 'Trung bình cộng' },
  { name: 'MIN', syntax: 'MIN(giá_trị1; [giá_trị2; ...])', description: 'Giá trị nhỏ nhất' },
  { name: 'MAX', syntax: 'MAX(giá_trị1; [giá_trị2; ...])', description: 'Giá trị lớn nhất' },
  { name: 'COUNT', syntax: 'COUNT(giá_trị1; [giá_trị2; ...])', description: 'Đếm số ô có số' },
  { name: 'COUNTA', syntax: 'COUNTA(giá_trị1; [giá_trị2; ...])', description: 'Đếm ô không trống' },
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
  gridRows = 20;
  gridCols = 10;
  fixedCols = 2;
  fixedRows = 2;

  cellMetadata: Map<string, { role: CellRole; readOnly: boolean; formula?: string }> = new Map();
  mergedCells: { row: number; col: number; rowspan: number; colspan: number }[] = [];

  // === Properties panel ===
  showPropsPanel = signal(false);
  propCellRole: CellRole = 'data';
  propReadOnly = false;
  propFormula = '';
  propColWidth = 100;

  // === Formula Mode State ===
  isFormulaMode = signal(false);
  formulaBarValue = '';
  formulaBarFocused = signal(false);
  private editingCell: { row: number; col: number } | null = null;
  private activeTextarea: HTMLTextAreaElement | null = null;
  private editorInputHandler: (() => void) | null = null;
  private formulaSource: 'cell' | 'bar' = 'bar';

  // Visual feedback
  formulaReferences = signal<{ ref: string; color: string; cells: { row: number; col: number }[] }[]>([]);
  private highlightOverlays: HTMLElement[] = [];

  // Formula tooltip
  showFormulaTooltip = signal(false);
  matchedHints = signal<FormulaHint[]>([]);
  tooltipPosition = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  // === Excel features ===
  zoomLevel = signal(100);

  // === Template info dialog ===
  showInfoDialog = signal(false);
  templateInfo = {
    templateId: '',
    templateName: '',
    version: '2026',
  };

  // === Dimensions ===
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

  // ==========================================
  // HANDSONTABLE INITIALIZATION
  // ==========================================
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

      // AC1: Intercept cell mouse clicks when in formula mode
      beforeOnCellMouseDown: (event: MouseEvent, coords: { row: number; col: number }, _td: HTMLElement) => {
        if (!this.isFormulaMode()) return;
        if (coords.row < 0 || coords.col < 0) return;

        // Block Handsontable from closing editor / changing selection
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

      // AC1: Detect when user starts editing a cell — hook into the TEXTAREA
      afterBeginEditing: (row: number, col: number) => {
        this.editingCell = { row, col };
        this.selectedCell.set({ row, col });
        this.updateCellInfo(row, col);
        this.attachEditorListener();
      },

      afterChange: (changes: any, source: string) => {
        if (source === 'loadData') return;
        if (changes && !this.isFormulaMode()) {
          for (const [row, prop, , newVal] of changes) {
            if (typeof newVal === 'string' && newVal.startsWith('=')) {
              const colIdx = typeof prop === 'number' ? prop : this.selectedCell()?.col ?? 0;
              this.cellMetadata.set(`${row},${colIdx}`, {
                role: 'formula',
                readOnly: false,
                formula: newVal,
              });
            }
          }
        }
      },

      // When editor closes, exit formula mode
      afterGetCellMeta: () => {},

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
  // CORE: Hook into Handsontable's TEXTAREA editor
  // ==========================================

  private attachEditorListener(): void {
    this.detachEditorListener();

    if (!this.hot) return;
    const editor = this.hot.getActiveEditor() as any;
    if (!editor) return;

    const textarea: HTMLTextAreaElement | undefined = editor.TEXTAREA;
    if (!textarea) return;

    this.activeTextarea = textarea;

    this.editorInputHandler = () => {
      const value = textarea.value;

      // Sync formula bar
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

    textarea.addEventListener('input', this.editorInputHandler);

    // Also listen for keydown to handle Enter/Escape and Tab for autocomplete
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isFormulaMode()) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.commitFormula();
      } else if (e.key === 'Escape') {
        this.cleanupFormulaMode();
        // Let Handsontable handle Escape to close editor
      } else if (e.key === 'Tab' && this.showFormulaTooltip() && this.matchedHints().length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.autocompleteHintInEditor(this.matchedHints()[0]);
      }
    });

    // If the cell already has a formula value, check it
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
    if (this.activeTextarea && this.editorInputHandler) {
      this.activeTextarea.removeEventListener('input', this.editorInputHandler);
    }
    this.activeTextarea = null;
    this.editorInputHandler = null;
  }

  // ==========================================
  // Get/Set active formula value (cell or bar)
  // ==========================================

  private getActiveFormulaValue(): string {
    if (this.formulaSource === 'cell' && this.activeTextarea) {
      return this.activeTextarea.value;
    }
    return this.formulaBarValue;
  }

  private setActiveFormulaValue(value: string): void {
    if (this.formulaSource === 'cell' && this.activeTextarea) {
      this.activeTextarea.value = value;
      this.activeTextarea.dispatchEvent(new Event('input'));
    }
    this.formulaBarValue = value;
  }

  private getActiveElement(): HTMLTextAreaElement | HTMLInputElement | null {
    if (this.formulaSource === 'cell' && this.activeTextarea) {
      return this.activeTextarea;
    }
    return this.formulaBarInputRef?.nativeElement ?? null;
  }

  // ==========================================
  // Insert cell reference at cursor position
  // ==========================================

  private insertRefAtCursor(ref: string): void {
    const el = this.getActiveElement();
    if (!el) return;

    const value = el.value;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    // Determine if we should just append or replace partial text
    const charBefore = start > 0 ? value[start - 1] : '';
    const shouldAppendDirectly =
      charBefore === '' ||
      charBefore === '(' ||
      charBefore === ',' ||
      charBefore === ';' ||
      this.isOperatorChar(charBefore);

    let newValue: string;
    let newCursorPos: number;

    if (shouldAppendDirectly) {
      newValue = value.slice(0, start) + ref + value.slice(end);
      newCursorPos = start + ref.length;
    } else {
      // Find start of current token to replace
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

    this.setActiveFormulaValue(newValue);

    // Restore focus and cursor
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

    const value = this.getActiveFormulaValue();

    // Close editor first so Handsontable doesn't fight us
    const editor = this.hot.getActiveEditor() as any;
    if (editor) {
      editor.finishEditing(false, false);
    }

    this.hot.setDataAtCell(cell.row, cell.col, value);

    if (value.startsWith('=')) {
      this.cellMetadata.set(`${cell.row},${cell.col}`, {
        role: 'formula',
        readOnly: false,
        formula: value,
      });
      this.propCellRole = 'formula';
    }

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
      // Discard changes
      if (this.editingCell && this.hot) {
        const editor = this.hot.getActiveEditor() as any;
        if (editor) {
          editor.finishEditing(true, false);
        }
        const cellValue = this.hot.getDataAtCell(this.editingCell.row, this.editingCell.col);
        this.formulaBarValue = cellValue != null ? String(cellValue) : '';
      }
      this.cleanupFormulaMode();
    }
  }

  // ==========================================
  // Formula Bar handlers (typing in the top bar)
  // ==========================================

  onFormulaBarInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    this.formulaBarValue = value;

    if (value.startsWith('=') && !this.isFormulaMode()) {
      this.isFormulaMode.set(true);
      this.formulaSource = 'bar';
      this.editingCell = this.selectedCell() ? { ...this.selectedCell()! } : null;
    } else if (!value.startsWith('=') && this.isFormulaMode() && this.formulaSource === 'bar') {
      this.cleanupFormulaMode();
    }

    if (this.isFormulaMode()) {
      this.updateTooltipFromElement(value, input);
      this.parseAndHighlightReferences(value);
    }
  }

  onFormulaBarKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.isFormulaMode()) {
        this.commitFormula();
      } else {
        // Just apply value to the selected cell
        const sel = this.selectedCell();
        if (sel && this.hot) {
          this.hot.setDataAtCell(sel.row, sel.col, this.formulaBarValue);
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
      const cellValue = this.hot.getDataAtCell(sel.row, sel.col);
      const strVal = cellValue != null ? String(cellValue) : '';
      this.formulaBarValue = strVal;

      if (strVal.startsWith('=')) {
        this.isFormulaMode.set(true);
        this.formulaSource = 'bar';
        this.editingCell = { ...sel };
        this.parseAndHighlightReferences(strVal);
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
  // AC4: Visual Feedback — Highlight referenced cells
  // ==========================================

  private parseAndHighlightReferences(formula: string): void {
    this.clearHighlightOverlays();
    const refs = this.extractReferences(formula);
    const coloredRefs: { ref: string; color: string; cells: { row: number; col: number }[] }[] = [];

    refs.forEach((ref, idx) => {
      const color = REF_COLORS[idx % REF_COLORS.length];
      const cells = this.resolveReference(ref);
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

  private resolveReference(ref: string): { row: number; col: number }[] {
    const cells: { row: number; col: number }[] = [];
    const parts = ref.split(':');
    if (parts.length === 2) {
      const start = this.fromCellAddress(parts[0]);
      const end = this.fromCellAddress(parts[1]);
      if (!start || !end) return cells;
      for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
        for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
          cells.push({ row: r, col: c });
        }
      }
    } else {
      const cell = this.fromCellAddress(parts[0]);
      if (cell) cells.push(cell);
    }
    return cells;
  }

  private fromCellAddress(addr: string): { row: number; col: number } | null {
    const match = addr.match(/^([A-Z]{1,3})(\d+)$/);
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
    overlay.className = 'formula-ref-highlight';
    overlay.style.cssText = `
      position: absolute;
      top: ${tlRect.top - holderRect.top + wtHolder.scrollTop}px;
      left: ${tlRect.left - holderRect.left + wtHolder.scrollLeft}px;
      width: ${brRect.right - tlRect.left}px;
      height: ${brRect.bottom - tlRect.top}px;
      border: 2px dashed ${color};
      background: ${color}15;
      pointer-events: none;
      z-index: 50;
      border-radius: 2px;
      box-sizing: border-box;
    `;

    wtHolder.style.position = 'relative';
    wtHolder.appendChild(overlay);
    this.highlightOverlays.push(overlay);
  }

  private clearHighlightOverlays(): void {
    for (const overlay of this.highlightOverlays) {
      overlay.remove();
    }
    this.highlightOverlays = [];
  }

  // ==========================================
  // AC5: Formula Tooltip
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
    // Called from tooltip click in template (for formula bar)
    this.autocompleteHintInBar(hint);
  }

  private autocompleteHintInBar(hint: FormulaHint): void {
    const input = this.formulaBarInputRef?.nativeElement;
    if (!input) return;

    const current = input.value;
    const cursorPos = input.selectionStart ?? current.length;
    const textBeforeCursor = current.slice(0, cursorPos);
    const funcMatch = textBeforeCursor.match(/([A-Z]+)\(?$/i);
    if (!funcMatch) return;

    const replaceStart = cursorPos - funcMatch[0].length;
    const replacement = hint.name + '(';
    const newValue = current.slice(0, replaceStart) + replacement + current.slice(cursorPos);
    const newPos = replaceStart + replacement.length;

    this.formulaBarValue = newValue;
    this.showFormulaTooltip.set(false);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newPos, newPos);
    }, 0);
  }

  private autocompleteHintInEditor(hint: FormulaHint): void {
    const ta = this.activeTextarea;
    if (!ta) return;

    const current = ta.value;
    const cursorPos = ta.selectionStart ?? current.length;
    const textBeforeCursor = current.slice(0, cursorPos);
    const funcMatch = textBeforeCursor.match(/([A-Z]+)\(?$/i);
    if (!funcMatch) return;

    const replaceStart = cursorPos - funcMatch[0].length;
    const replacement = hint.name + '(';
    const newValue = current.slice(0, replaceStart) + replacement + current.slice(cursorPos);
    const newPos = replaceStart + replacement.length;

    ta.value = newValue;
    this.formulaBarValue = newValue;
    this.showFormulaTooltip.set(false);

    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  }

  // ==========================================
  // Formula Bar sync
  // ==========================================

  private syncFormulaBar(row: number, col: number): void {
    if (this.isFormulaMode()) return;
    const cellValue = this.hot?.getDataAtCell(row, col);
    this.formulaBarValue = cellValue != null ? String(cellValue) : '';
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
      ? cellValue : '';

    if (meta) {
      this.propCellRole = meta.role;
      this.propReadOnly = meta.readOnly;
      this.propFormula = meta.formula || formulaFromCell || '';
    } else {
      this.propCellRole = 'data';
      this.propReadOnly = false;
      this.propFormula = formulaFromCell || '';
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
    console.log('[FormDesigner] Exported:', JSON.stringify(exported, null, 2));
    setTimeout(() => {
      this.dangLuu.set(false);
      this.notify('Đã lưu biểu mẫu thành công!', 'success');
    }, 800);
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
        key: String.fromCharCode(65 + c),
        title: String(headerValue),
        width: typeof width === 'number' ? width : 100,
        role: meta?.role || (c < this.fixedCols ? 'text' : 'data'),
      });
    }

    const rows: DesignerRow[] = [];
    for (let r = this.fixedRows; r < data.length; r++) {
      const firstDataMeta = this.cellMetadata.get(`${r},${this.fixedCols}`);
      rows.push({
        key: `R${r - this.fixedRows + 1}`,
        role: firstDataMeta?.role === 'formula' ? 'formula' : 'data',
        formula: firstDataMeta?.formula,
      });
    }

    const cellMeta: Record<string, { role: CellRole; readOnly: boolean; formula?: string }> = {};
    this.cellMetadata.forEach((value, key) => { cellMeta[key] = value; });

    const nestedHeaders: any[][] = [];
    for (let r = 0; r < this.fixedRows; r++) { nestedHeaders.push(data[r] || []); }

    const mergePlugin = this.hot!.getPlugin('mergeCells');
    const mergedCells: any[] = [];
    if (mergePlugin && (mergePlugin as any).mergedCellsCollection) {
      const collection = (mergePlugin as any).mergedCellsCollection;
      if (collection.mergedCells) {
        for (const mc of collection.mergedCells) {
          mergedCells.push({ row: mc.row, col: mc.col, rowspan: mc.rowspan, colspan: mc.colspan });
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
      nestedHeaders, columns, rows,
      mergeCells: mergedCells.length > 0 ? mergedCells : this.mergedCells,
      fixedColumnsStart: this.fixedCols,
      fixedRowsTop: this.fixedRows,
      cellMeta,
    };
  }

  exportJsonToClipboard(): void {
    const json = this.exportToJson();
    navigator.clipboard.writeText(JSON.stringify(json, null, 2)).then(() => {
      this.notify('Đã copy JSON vào clipboard!', 'success');
    });
  }

  // === Template Info Dialog ===
  saveTemplateInfo(): void { this.showInfoDialog.set(false); }

  // === Navigation ===
  quayLai(): void { this.router.navigate(['/app/form-designer/templates']); }

  // === Address conversion ===
  toCellAddress(row: number, col: number): string {
    let column = '';
    let current = col;
    while (current >= 0) {
      column = String.fromCharCode((current % 26) + 65) + column;
      current = Math.floor(current / 26) - 1;
    }
    return `${column}${row + 1}`;
  }

  private buildRangeReference(r1: number, c1: number, r2: number, c2: number): string {
    const start = this.toCellAddress(Math.min(r1, r2), Math.min(c1, c2));
    const end = this.toCellAddress(Math.max(r1, r2), Math.max(c1, c2));
    return start === end ? start : `${start}:${end}`;
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
    if (!this.hot) return;
    this.hot.updateSettings({ height: this.calculateGridHeight() });
    this.hot.render();
  }

  private notify(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }

  // === Dimension values management ===
  addEntValue(): void { this.entValues.push(''); }
  removeEntValue(i: number): void { if (this.entValues.length > 1) this.entValues.splice(i, 1); }
  addSceValue(): void { this.sceValues.push(''); }
  removeSceValue(i: number): void { if (this.sceValues.length > 1) this.sceValues.splice(i, 1); }
  addYeaValue(): void { this.yeaValues.push(''); }
  removeYeaValue(i: number): void { if (this.yeaValues.length > 1) this.yeaValues.splice(i, 1); }
}
