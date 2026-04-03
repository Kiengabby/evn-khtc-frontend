import {
  Component, inject, signal, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Handsontable from 'handsontable';
import { HyperFormula } from 'hyperformula';
import { firstValueFrom } from 'rxjs';
import { BieuMauService } from '../../services/bieu-mau.service';
import { FormConfigApiService } from '../../services/form-config-api.service';
import { DimAccountApiService } from '../../services/dim-account-api.service';
import { FormTemplate } from '../../../../core/models/form-template.model';

import {
  FormLayoutConfig, ColumnConfig, HeaderRow, HeaderCell, MergeCell,
} from '../../../../core/models/form-template.model';

// === Types ===
type CellRole = 'text' | 'data' | 'formula' | 'header';

interface IndicatorItem {
  code: string;
  name: string;
  type?: string; // 'system' for fixed columns
  level?: number; // 0=parent, 1=child, 2=sub-child
  isGroupHeader?: boolean; // true = column group header (creates colspan, no colCode)
}

interface IndicatorGroup {
  group: string;
  items: IndicatorItem[];
}

interface PreviewGroup {
  parent: IndicatorItem;
  children: IndicatorItem[];
}

/**
 * JSON chuẩn gửi xuống Backend.
 * Khớp với: SYS_FORM_TEMPLATE + SYS_FORM_VERSION.
 * mappings nằm bên trong version.layoutJSON.mappings (khớp LayoutJSON interface).
 */
interface ExportedTemplate {
  formId: string;
  formName: string;
  isActive: boolean;
  orgList: string[];
  isDynamicRow: boolean;
  layoutConfig: {
    type: string;
    allowDynamicRows: boolean;
    freezeColumns: number;
    hiddenColumns?: { columns: number[]; indicators: boolean };
  };
  version: {
    year: number;
    layoutJSON: ExportedLayoutJSON;
  };
}

/** Khớp LayoutJSON (layout-template.model.ts) */
interface ExportedLayoutJSON {
  columns: ColumnConfig[];
  headerRows: HeaderRow[];
  rows: any[];
  mergeCells?: MergeCell[];
  fixedRowsTop: number;
  freezeColumns: number;
  mappings?: FormMappingExport[];
}

/** Khớp LayoutCellMapping (layout-template.model.ts) — dùng rowCode×colCode làm key duy nhất */
interface FormMappingExport {
  rowKey: string;
  colKey: string;
  rowCode: string;
  colCode: string;
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
  private formConfigApi = inject(FormConfigApiService);
  private dimAccountApi = inject(DimAccountApiService);

  bieuMau = signal<FormTemplate | null>(null);
  dangTai = signal(false);
  dangLuu = signal(false);
  thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

  /** UUID của biểu mẫu trên BE — dùng để UPDATE thay vì CREATE khi lưu lại */
  existingFormUUID: string | null = null;

  /**
   * Promise coordination: resolve khi HOT đã được khởi tạo.
   * loadTemplate() ở đây sau khi lấy xong data. Nếu HOT chưa xong → chờ.
   * Nếu HOT đã xong trước → rebuildFromExportedTemplate chạy ngay lập tức.
   * → Loại bỏ hoàn toàn setTimeout nhân tạo (100ms + 200ms).
   */
  private _hotReady!: Promise<void>;
  private _hotReadyResolve!: () => void;

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
  templateInfo = { templateId: '', templateName: '', version: '2026', isActive: true };

  // Danh sách đơn vị áp dụng — khớp với BE appliedEntities
  entValues: string[] = ['EVN', 'EVNHCMC', 'EVNHANOI'];

  // === Indicator Code (Mã chỉ tiêu) ===
  colIndicators = signal<IndicatorGroup[]>([]);
  rowIndicators = signal<IndicatorGroup[]>([]);
  columnCodeMap = new Map<number, string>();   // colIndex → assigned code
  rowCodeMap = new Map<number, string>();       // rowIndex → assigned code
  columnCodeNameMap = new Map<number, string>(); // colIndex → indicator name
  rowCodeNameMap = new Map<number, string>();     // rowIndex → indicator name

  // === Indicator Selection Dialog ===
  showRowIndicatorDialog = signal(false);
  showColIndicatorDialog = signal(false);
  selectedRowIndicators: IndicatorItem[] = [];
  selectedColIndicators: IndicatorItem[] = [];
  tempRowSelection = new Set<string>();  // codes selected in dialog (for fast lookup)
  tempRowOrderedList: IndicatorItem[] = []; // ordered list for preview (user can reorder)
  tempColSelection = new Set<string>();
  tempColOrderedList: IndicatorItem[] = [];
  indicatorSearchTerm = '';

  dragGroupIndex: number | null = null;
  dragOverGroupIndex: number | null = null;
  dragColGroupIndex: number | null = null;
  dragOverColGroupIndex: number | null = null;

  // === Lifecycle ===

  ngOnInit(): void {
    // Tạo hotReady Promise NGAY đầu (trước cả API call)
    this._hotReady = new Promise<void>(resolve => (this._hotReadyResolve = resolve));

    this.formId = this.route.snapshot.paramMap.get('id') || '';
    if (this.formId) {
      // KHAI HỊA: KHÔNG await → chạy song song với ngAfterViewInit/initDesigner
      // loadTemplate() sẽ tự đợi this._hotReady trước khi rebuildFromExportedTemplate
      this.loadTemplate();
    } else {
      this.showInfoDialog.set(true);
    }
    // Load indicator codes (parallel, không block bất kỳ thứ gì)
    this.loadIndicatorCodes();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initDesigner();
      this._hotReadyResolve();
    }, 0);
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
      const result = await firstValueFrom(
        this.formConfigApi.loadFormForDesigner(this.formId)
      );

      if (result && result.layoutJSON) {
        console.log('[FormDesigner] ✅ API data ready:', result.formCode, 'UUID:', result.formUUID);
        this.templateInfo.templateId = result.formCode;
        this.templateInfo.templateName = result.formName;
        this.templateInfo.version = String(result.year);

        if (result.formUUID) {
          this.existingFormUUID = result.formUUID;
        }

        const exported: any = {
          formId: result.formCode,
          formName: result.formName,
          version: { year: result.year, layoutJSON: result.layoutJSON },
        };

        await this._hotReady;
        this.rebuildFromExportedTemplate(exported);
        this.dangTai.set(false);
        return;
      }

      console.warn('[FormDesigner] ⚠️ API không trả layout, thử mock store...');
    } catch (apiErr: any) {
      console.warn('[FormDesigner] ⚠️ API error, fallback to mock store:', apiErr?.message || apiErr);
    }

    try {
      const layoutRes = await this.bieuMauService.layTemplateLayout(this.formId);
      if (layoutRes.trangThai && layoutRes.duLieu) {
        console.log('[FormDesigner] 📥 Load layout từ mock store:', layoutRes.duLieu.formId);
        this.templateInfo.templateId = layoutRes.duLieu.formId;
        this.templateInfo.templateName = layoutRes.duLieu.formName;
        if (layoutRes.duLieu.version?.year) this.templateInfo.version = String(layoutRes.duLieu.version.year);
        if (layoutRes.duLieu.orgList) this.entValues = [...layoutRes.duLieu.orgList];

        await this._hotReady;
        this.rebuildFromExportedTemplate(layoutRes.duLieu);
        this.dangTai.set(false);
        return;
      }

      const kq = await this.bieuMauService.layTheoId(this.formId);
      if (kq.trangThai && kq.duLieu) {
        this.bieuMau.set(kq.duLieu);
        this.templateInfo.templateId = kq.duLieu.formId;
        this.templateInfo.templateName = kq.duLieu.formName;
      } else {
        this.notify('Biểu mẫu chưa có layout — bắt đầu thiết kế mới', 'success');
      }
    } catch {
      this.notify('Không tải được biểu mẫu', 'error');
    }
    this.dangTai.set(false);
  }

  // ==========================================
  // HANDSONTABLE INITIALIZATION
  // ==========================================

  /**
   * Khởi tạo Handsontable với lưới trống.
   * Data sẽ được apply qua rebuildFromExportedTemplate() khi _hotReady resolve.
   */
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
        const sourceValue = this.hot?.getSourceDataAtCell(row, col);
        if (this.isFormula(sourceValue)) this.formulaBarValue = String(sourceValue);
        this.attachEditorListener();
      },

      afterChange: (changes: any, source: string) => {
        if (source === 'loadData' || source === 'formula-commit' || !changes) return;
        for (const [row, prop, , newVal] of changes) {
          const colIdx = typeof prop === 'number' ? prop : parseInt(prop, 10);
          if (isNaN(colIdx)) continue;
          if (this.isFormula(newVal)) {
            this.cellMetadata.set(`${row},${colIdx}`, { role: 'formula', readOnly: true, formula: String(newVal) });
          }
        }
      },

      afterMergeCells: (_cellRange: any, mergeParent: any, auto: boolean) => {
        if (!auto) {
          const existing = this.mergedCells.find(m => m.row === mergeParent.row && m.col === mergeParent.col);
          if (!existing) {
            this.mergedCells.push({ row: mergeParent.row, col: mergeParent.col, rowspan: mergeParent.rowspan, colspan: mergeParent.colspan });
          }
          this.autoUpdateFixedRows();
        }
      },

      afterUnmergeCells: (cellRange: any, auto: boolean) => {
        if (!auto) {
          this.mergedCells = this.mergedCells.filter(m => !(m.row === cellRange.from.row && m.col === cellRange.from.col));
          this.autoUpdateFixedRows();
        }
      },

      afterCreateRow: (index: number, amount: number) => { this.reindexRowInsert(index, amount); },
      afterRemoveRow: (index: number, amount: number) => { this.reindexRowRemove(index, amount); },
      afterCreateCol: (index: number, amount: number) => { this.reindexColInsert(index, amount); },
      afterRemoveCol: (index: number, amount: number) => { this.reindexColRemove(index, amount); },

      cells: (row: number, col: number) => {
        const meta = this.cellMetadata.get(`${row},${col}`);
        const cellProps: any = {};
        let baseClass = '';
        if (meta) {
          cellProps.readOnly = meta.readOnly;
          if (meta.role === 'header') baseClass = 'cell-designer-header';
          else if (meta.role === 'text') baseClass = 'cell-designer-text';
          else if (meta.role === 'data') baseClass = 'cell-designer-data';
          else if (meta.role === 'formula') baseClass = 'cell-designer-formula';
        }
        const headerRowCount = this.fixedRows || 0;
        if (headerRowCount > 0 && row < headerRowCount) {
          if (!baseClass.includes('cell-designer-header')) baseClass = (baseClass ? baseClass + ' ' : '') + 'cell-designer-header';
          baseClass = (baseClass ? baseClass + ' ' : '') + 'htCenter htMiddle';
        }
        const isMergeParent = this.mergedCells.some(m => m.row === row && m.col === col);
        if (isMergeParent) {
          if (!baseClass.includes('htCenter')) baseClass = (baseClass ? baseClass + ' ' : '') + 'htCenter htMiddle';
          baseClass = (baseClass ? baseClass + ' ' : '') + 'merged-cell-parent';
        }
        if (baseClass) cellProps.className = baseClass;
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
        role: 'formula', readOnly: true, formula,
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

  setFixedCols(val: any): void { 
    this.fixedCols = Number(val) || 0; 
    this.hot?.updateSettings({ fixedColumnsStart: this.fixedCols }); 
  }
  setFixedRows(val: any): void { 
    this.fixedRows = Number(val) || 0; 
    this.hot?.updateSettings({ fixedRowsTop: this.fixedRows }); 
    this.hot?.render(); 
  }

  autoUpdateFixedRows(): void {
    if (!this.hot) return;
    const data = this.hot.getSourceData() as any[][];
    const colCount = this.hot.countCols();
    const rows = this.detectHeaderRowCount(data, colCount);
    this.setFixedRows(rows);
  }

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

  async saveTemplate(): Promise<void> {
    if (!this.hot) return;
    this.dangLuu.set(true);
    const exported = this.exportToJson();

    // ★ Gắn UUID hiện tại vào exported để saveTemplateAndConfig gửi lên BE dưới dạng UPDATE
    // Nếu existingFormUUID = null → BE sẽ tạo mới (form chưa có trên server)
    (exported as any).existingFormUUID = this.existingFormUUID;
    console.log('[FormDesigner] 📤 JSON gửi lên BE (formUUID:', this.existingFormUUID, '):', JSON.stringify(exported, null, 2));

    // ── 1. Lưu vào mock store (giữ hoạt động offline) ──
    try {
      const res = await this.bieuMauService.luuTemplate(exported);
      if (res.trangThai) {
        console.log('[FormDesigner] ✅ Mock store: lưu thành công');
      }
    } catch (err) {
      console.warn('[FormDesigner] ⚠️ Mock store lỗi:', err);
    }

    // ── 2. Gọi API thật: Step 1 (save-form) → Step 2 (save-form-config) ──
    this.formConfigApi.saveTemplateAndConfig(exported).subscribe({
      next: (response) => {
        this.dangLuu.set(false);
        if (response.succeeded) {
          console.log('[FormDesigner] ✅ API thật: lưu thành công', response);

          // ★ FIX: Lưu UUID từ response để lần lưu tiếp theo sẽ UPDATE thay vì INSERT mới
          if (response.data && typeof response.data === 'string' && !this.existingFormUUID) {
            this.existingFormUUID = response.data;
            console.log('[FormDesigner] 🔑 UUID mới được lưu:', this.existingFormUUID);
          }

          this.notify(response.message || 'Đã lưu biểu mẫu lên server thành công!', 'success');
        } else {
          console.error('[FormDesigner] ❌ API thật: lỗi', response);
          const errMsg = response.errors?.join(', ') || response.message || 'Lưu thất bại';
          this.notify(`Lỗi từ server: ${errMsg}`, 'error');
        }
      },
      error: (err) => {
        this.dangLuu.set(false);
        console.error('[FormDesigner] ❌ API thật: HTTP error', err);
        // Handle both PascalCase (.NET) and camelCase error bodies
        const errBody = err.error;
        const serverErrors = errBody?.Errors?.join(', ') || errBody?.errors?.join(', ') || '';
        const serverMsg = errBody?.Message || errBody?.message || '';
        const detail = serverErrors || serverMsg || err.message || 'Lỗi không xác định';
        this.notify(`Lỗi kết nối server: ${detail}`, 'error');
      },
    });
  }

  private exportToJson(): ExportedTemplate {
    const sourceData = this.hot!.getSourceData() as any[][];
    // Add +1 config if we are going to inject METADATA_ROW at index 0.
    // Handsontable colCount is the visible columns, so our raw data has `colCount` columns.
    const colCount = this.hot!.countCols();
    const rowCount = sourceData.length;

    // --- 1. Collect merge cells first (needed for header detection) ---
    const rawMergeCells = this.collectMergeCells();

    // --- 2. Detect header rows based on merge cells ---
    const headerRowCount = this.detectHeaderRowCount(sourceData, colCount, rawMergeCells);

    // --- 3. Build columns (from header row labels + widths + types) ---
    // We will inject the hidden METADATA_ROW at index 0!
    const columns: ColumnConfig[] = [];
    
    // Inject METADATA_ROW
    columns.push({
      key: 'ID',
      colCode: 'METADATA_ROW',
      title: 'RowCode',
      width: 0,
      type: 'text',
      readOnly: true,
    });

    for (let c = 0; c < colCount; c++) {
      const rawWidth = this.hot!.getColWidth(c);
      const width = typeof rawWidth === 'number' ? rawWidth : 100;
      const colKey = this.colIndexToKey(c);
      
      const title = this.resolveColumnTitle(sourceData, c, headerRowCount);
      const fullTitle = this.getFullColumnTitle(sourceData, c, headerRowCount, rawMergeCells);
      
      let colType = this.inferColumnType(sourceData, c, headerRowCount, rowCount);
      
      const colCode = this.columnCodeMap.get(c) || this.generateColCode(fullTitle, c);

      // Explicitly adjust type/readOnly based on known columns
      let isReadOnly = false;
      if (c < this.fixedCols || colCode === 'STT' || colCode === 'CHITIEU_NAME' || colCode === 'UNIT') {
        isReadOnly = true;
      }
      if (colCode === 'NOTE') {
        colType = 'text';
      }

      columns.push({ 
        key: colKey, 
        colCode, 
        title, 
        width, 
        type: colType,
        readOnly: isReadOnly,
      });
    }

    // --- 4. Build headerRows (label + rowspan/colspan from merge info) ---
    // shiftedMergeCells accounts for the METADATA_ROW at index 0.
    const shiftedMergeCells = rawMergeCells.map(mc => ({
      ...mc,
      col: mc.col + 1
    }));
    
    // QA Requirement: Metadata ID column needs to be explicitly defined in mergeCells if used for rendering
    if (headerRowCount > 1) {
      shiftedMergeCells.unshift({ row: 0, col: 0, rowspan: headerRowCount, colspan: 1 });
    }
    
    const { headerRows, autoMerges } = this.buildHeaderRows(sourceData, headerRowCount, colCount, shiftedMergeCells);
    
    // Add any dynamically inferred merge cells (like Ghi chú spanning 2 rows because it's empty below)
    if (autoMerges && autoMerges.length > 0) {
      shiftedMergeCells.push(...autoMerges);
    }

    // --- 5. Build LayoutRows (the list of grid rows) ---
    const rows = this.buildLayoutRows(sourceData, headerRowCount, rowCount, colCount);

    // --- 6. Build mappings — khớp LayoutCellMapping (layout-template.model.ts) ---
    // Mỗi mapping = 1 ô body: rowCode×colCode là key duy nhất cho BE lưu xuống DB.
    // Không chứa accountCode hay cellValue — BE tự derive từ rowCode+colCode.
    const mappings: FormMappingExport[] = [];
    for (let r = headerRowCount; r < rowCount; r++) {
      const rowKey = `R${r + 1}`;
      const rowDef = rows[r - headerRowCount];
      const rowCode = rowDef?.rowCode || `ROW_${r}`;

      for (let c = 0; c < colCount; c++) {
        const colKey = this.colIndexToKey(c);
        const colCode = columns[c + 1].colCode || `COL_${c + 1}`; // +1 vì columns[0] = METADATA_ROW

        const meta = this.cellMetadata.get(`${r},${c}`);
        const hfFormula = this.getHyperFormulaCellFormula(r, c);
        const formula = hfFormula || meta?.formula || null;

        // Xác định role: ưu tiên meta > formula > vị trí cột > default 'data'
        let cellRole: CellRole;
        if (meta?.role && meta.role !== 'data') {
          cellRole = meta.role;
        } else if (formula) {
          cellRole = 'formula';
        } else if (c < this.fixedCols) {
          cellRole = 'header';
        } else {
          cellRole = 'data';
        }

        // isReadOnly: forced true cho formula/header/text, hoặc column readOnly, hoặc user set
        const isColumnReadOnly = columns[c + 1].readOnly;
        const isReadOnly = cellRole === 'formula'
          || cellRole === 'header'
          || cellRole === 'text'
          || (isColumnReadOnly ?? false)
          || (meta?.readOnly ?? false);

        const exportedFormula = formula ? formula.replace(/;/g, ',') : undefined;

        const entry: FormMappingExport = {
          rowKey,
          colKey,
          rowCode,
          colCode,
          cellRole,
          isReadOnly,
        };
        if (exportedFormula) entry.formula = exportedFormula;
        mappings.push(entry);
      }
    }

    // --- 7. Assemble — layoutJSON khớp LayoutJSON interface (layout-template.model.ts) ---
    const freezeColumns = (this.fixedCols > 0 ? this.fixedCols : 0) + 1;
    const fixedRowsTop = this.fixedRows > 0 ? this.fixedRows : (headerRowCount > 0 ? headerRowCount : 1);

    const layoutJSON: ExportedLayoutJSON = {
      columns,
      headerRows,
      rows,
      mergeCells: shiftedMergeCells.length > 0 ? shiftedMergeCells : undefined,
      fixedRowsTop,
      freezeColumns,
      mappings,  // ← nằm BÊN TRONG layoutJSON, không phải top-level
    };

    return {
      formId: this.templateInfo.templateId || this.formId || 'NEW_TEMPLATE',
      formName: this.templateInfo.templateName || 'Biểu mẫu mới',
      isActive: this.templateInfo.isActive ?? true,
      orgList: this.entValues.map(v => v.trim()).filter(Boolean),
      isDynamicRow: false,
      layoutConfig: {
        type: 'custom',
        allowDynamicRows: false,
        freezeColumns,
        hiddenColumns: {
          columns: [0], // Ẩn cột METADATA_ROW
          indicators: false,
        },
      },
      version: {
        year: parseInt(this.templateInfo.version, 10) || new Date().getFullYear(),
        layoutJSON,
      },
    };
  }

  // --- Export helpers ---

  private getFullColumnTitle(data: any[][], col: number, headerRowCount: number, mergeCells: MergeCell[]): string {
    let full = '';
    for (let r = 0; r < headerRowCount; r++) {
      let val = data[r]?.[col];
      
      // If empty, check if covered by a parent merged cell to inherit its text
      if (!val) {
        for (const mc of mergeCells) {
          if (r >= mc.row && r < mc.row + mc.rowspan && col >= mc.col && col < mc.col + mc.colspan) {
            val = data[mc.row]?.[mc.col];
            break;
          }
        }
      }
      
      if (val) full += ' ' + String(val);
    }
    return full.trim();
  }

  private generateColCode(fullTitle: string, index: number): string {
    const t = fullTitle.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
    
    let baseCode = '';
    
    // ---- Nhận diện cột đặc biệt ----
    if (index === 0 && (t.includes('stt') || t === '' || /so\s+thu\s+tu/.test(t) || /thu\s+tu/.test(t))) baseCode = 'STT';
    else if (index === 1 && (t.includes('chi tieu') || t.includes('ten chi tieu') || t.includes('noi dung'))) baseCode = 'CHITIEU_NAME';
    else if (t.includes('don vi') || t.includes('dvt')) baseCode = 'UNIT';
    else if (t.includes('ghi chu') || t.includes('note')) baseCode = 'NOTE';
    else {
      // ---- Auto infer dựa trên từ khóa phổ biến ----
      let prefix = 'COL';
      if (t.includes('thuc hien')) prefix = 'ACTUAL';
      else if (t.includes('ke hoach') || t.includes('kh')) prefix = 'PLAN';
      else if (t.includes('uoc') || t.includes('uoc thuc hien')) prefix = 'ESTIMATE';
      
      let suffix = '';
      if (t.match(/n-2|n - 2/)) suffix = '_N2';
      else if (t.match(/n-1|n - 1/)) suffix = '_N1';
      else if (t.match(/\bn\b/) || t.includes('nam n')) suffix = '_N';
      
      if (prefix !== 'COL' || suffix !== '') {
        baseCode = suffix ? `${prefix}${suffix}` : `${prefix}_${index}`;
      } else {
        baseCode = `COL_${index + 1}`;
      }
    }
    
    // ---- Ensure uniqueness: append _2, _3, ... if code already used by another column ----
    return this.ensureUniqueColCode(baseCode, index);
  }

  /** Ensure a colCode is unique across all columns (skip the column at `selfIndex`) */
  private ensureUniqueColCode(baseCode: string, selfIndex: number): string {
    const usedCodes = new Set<string>();
    for (const [colIdx, code] of this.columnCodeMap.entries()) {
      if (colIdx !== selfIndex) usedCodes.add(code);
    }
    if (!usedCodes.has(baseCode)) return baseCode;
    
    let counter = 2;
    while (usedCodes.has(`${baseCode}_${counter}`)) counter++;
    return `${baseCode}_${counter}`;
  }

  private buildLayoutRows(data: any[][], startRow: number, rowCount: number, colCount: number): any[] {
    const rows = [];
    let chitieuCounter = 1;

    for (let r = startRow; r < rowCount; r++) {
      const rowKey = `R${r + 1}`;
      
      // Determine level by counting spaces/tabs at the beginning of the CHITIEU_NAME column (assumed index 1, or 0)
      const chitieuCol = colCount > 1 ? 1 : 0;
      const rawTitle = data[r]?.[chitieuCol] ?? '';
      const textTitle = String(rawTitle);
      const title = textTitle.trim();
      
      const leadingSpacesMatch = textTitle.match(/^(\s+)/);
      const level = leadingSpacesMatch ? Math.floor(leadingSpacesMatch[1].length / 2) : 0;
      
      // Determine rowCode — prioritize user-assigned code from rowCodeMap
      let rowCode = '';
      const assignedRowCode = this.rowCodeMap.get(r);
      if (assignedRowCode) {
        rowCode = assignedRowCode;
        chitieuCounter++;
      } else if (title.toUpperCase().startsWith('TỔNG') || title.toUpperCase().startsWith('TONG')) {
        rowCode = `TONG_CONG_${chitieuCounter++}`;
      } else if (title) {
        rowCode = `CHITIEU_${String(chitieuCounter++).padStart(2, '0')}`;
      } else {
        rowCode = `ROW_${r}`;
      }

      // Check if it's mostly empty or only has headers (read only)
      let isReadOnly = false;
      const sttVal = data[r]?.[0];
      // Often, rows with Roman numerals or just text at col 0/1 are headers
      if (typeof sttVal === 'string' && sttVal.match(/^[IVX]+\.$|^[A-Z]\.$/)) {
        isReadOnly = true;
      }

      rows.push({
        rowKey,
        rowCode,
        title,
        level,
        isReadOnly
      });
    }

    return rows;
  }

  colIndexToKey(col: number): string {
    let key = '';
    let current = col;
    while (current >= 0) {
      key = String.fromCharCode((current % 26) + 65) + key;
      current = Math.floor(current / 26) - 1;
    }
    return key;
  }

  private detectHeaderRowCount(_data: any[][], _colCount: number, mergeCells?: MergeCell[]): number {
    // Primary: use merge cells that span multiple rows — header rows always have merges
    const merges = mergeCells ?? this.collectMergeCells();
    let maxMergeEnd = 0;
    for (const mc of merges) {
      if (mc.rowspan > 1) {
        maxMergeEnd = Math.max(maxMergeEnd, mc.row + mc.rowspan);
      }
    }
    if (maxMergeEnd > 0) return maxMergeEnd;

    // Fallback: if no multi-row merges, check for single-row header merges (colspan only)
    let maxMergeRow = -1;
    for (const mc of merges) {
      if (mc.colspan > 1) {
        maxMergeRow = Math.max(maxMergeRow, mc.row);
      }
    }
    if (maxMergeRow >= 0) return maxMergeRow + 1;

    // No merges at all → default 1 header row
    return 1;
  }

  private resolveColumnTitle(data: any[][], col: number, headerRowCount: number): string {
    // Lấy từ dòng cuối header (bottom-most) — tiêu đề con cụ thể hơn
    for (let r = headerRowCount - 1; r >= 0; r--) {
      const val = data[r]?.[col];
      if (val !== null && val !== undefined && val !== '') return String(val);
    }
    return `Col_${col}`;
  }

  private inferColumnType(data: any[][], col: number, startRow: number, rowCount: number): 'text' | 'numeric' {
    // Cột cố định (STT, Chỉ tiêu) → luôn là text
    if (col < this.fixedCols) return 'text';

    // Kiểm tra giá trị thực tế trong các dòng data
    let hasText = false;
    let hasNumeric = false;
    for (let r = startRow; r < Math.min(rowCount, startRow + 20); r++) {
      const val = data[r]?.[col];
      if (val === null || val === undefined || val === '') continue;

      // Formula → cột chứa kết quả tính toán → numeric
      if (typeof val === 'string' && val.startsWith('=')) { hasNumeric = true; continue; }

      if (typeof val === 'number') { hasNumeric = true; continue; }

      if (typeof val === 'string') {
        const stripped = val.replace(/,/g, '');
        if (!isNaN(parseFloat(stripped)) && isFinite(Number(stripped))) {
          hasNumeric = true;
        } else {
          hasText = true;
        }
      }
    }

    // Nếu có giá trị text thực sự (không phải số) → cột text
    if (hasText && !hasNumeric) return 'text';
    // Có giá trị numeric → cột numeric
    if (hasNumeric) return 'numeric';

    // Không có data → cột sau fixedCols thường là numeric (ô nhập số liệu)
    if (this.fixedCols > 0 && col >= this.fixedCols) return 'numeric';

    return 'text';
  }

  private collectMergeCells(): MergeCell[] {
    const seen = new Set<string>();
    const result: MergeCell[] = [];

    const add = (row: number, col: number, rowspan: number, colspan: number) => {
      const key = `${row},${col}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ row, col, rowspan, colspan });
    };

    // Nguồn 1: MergeCells plugin (mergedCellsCollection.mergedCells)
    const mergePlugin = this.hot!.getPlugin('mergeCells') as any;
    const pluginMerges = mergePlugin?.mergedCellsCollection?.mergedCells ?? mergePlugin?.mergedCells ?? [];
    for (const mc of pluginMerges) {
      const r = mc.row;
      const c = mc.col;
      if (typeof r === 'number' && typeof c === 'number') {
        add(r, c, mc.rowspan ?? 1, mc.colspan ?? 1);
      }
    }

    // Nguồn 2: mergedCells nội bộ (sync từ afterMergeCells / load template)
    for (const m of this.mergedCells) {
      add(m.row, m.col, m.rowspan, m.colspan);
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

  private buildHeaderRows(data: any[][], headerRowCount: number, colCount: number, shiftedMergeCells: MergeCell[]): { headerRows: HeaderRow[], autoMerges: MergeCell[] } {
    const rows: HeaderRow[] = [];
    const autoMerges: MergeCell[] = [];

    // Track which cells are "owned" by a merge (non-top-left cells should be skipped)
    const mergeOwner = new Map<string, MergeCell>();
    for (const mc of shiftedMergeCells) {
      for (let r = mc.row; r < mc.row + mc.rowspan; r++) {
        for (let c = mc.col; c < mc.col + mc.colspan; c++) {
          mergeOwner.set(`${r},${c}`, mc);
        }
      }
    }

    for (let r = 0; r < headerRowCount; r++) {
      const cells: HeaderCell[] = [];

      // We inject an empty header cell for METADATA_ROW at index 0.
      // QA Requirement: Only inject at row 0 with rowspan, stop repeating in row 1+
      if (r === 0) {
        cells.push({ label: '', colKey: 'ID', rowspan: headerRowCount > 1 ? headerRowCount : 1 });
      }

      for (let c = 0; c < colCount; c++) {
        // Shift column reference to match shiftedMergeCells
        const shiftedCol = c + 1;
        const key = `${r},${shiftedCol}`;
        const mc = mergeOwner.get(key);

        if (mc && (mc.row !== r || mc.col !== shiftedCol)) {
          // This cell is part of a merge but not the top-left → skip
          continue;
        }

        const label = data[r]?.[c] != null ? String(data[r][c]) : '';
        // Use colIndexToKey(c) because we want actual 'A', 'B', etc. for normal columns
        const cell: HeaderCell = { label, colKey: this.colIndexToKey(c) };

        let rowspan = mc ? mc.rowspan : 1;
        let colspan = mc ? mc.colspan : 1;

        if (!mc && headerRowCount > 1 && r === 0) {
          // If a top header label is present but the one below it is empty, make it rowspan dynamically
          const labelBelow = data[r+1]?.[c];
          if (label && (!labelBelow || String(labelBelow).trim() === '') && !mergeOwner.has(`${r+1},${shiftedCol}`)) {
            rowspan = headerRowCount;
            autoMerges.push({ row: r, col: shiftedCol, rowspan, colspan });
            // Mark ownership so we don't render it in the next row
            for(let scanR = r+1; scanR < headerRowCount; scanR++) {
               mergeOwner.set(`${scanR},${shiftedCol}`, { row: r, col: shiftedCol, rowspan, colspan });
            }
          }
        }

        if (rowspan > 1) cell.rowspan = rowspan;
        if (colspan > 1) cell.colspan = colspan;

        cells.push(cell);
      }
      rows.push({ cells });
    }

    return { headerRows: rows, autoMerges };
  }

  exportJsonToClipboard(): void {
    navigator.clipboard.writeText(JSON.stringify(this.exportToJson(), null, 2)).then(() => {
      this.notify('Đã copy JSON vào clipboard!', 'success');
    });
  }

  // ==========================================
  // Rebuild grid from saved ExportedTemplate JSON
  // ==========================================

  private rebuildFromExportedTemplate(exported: ExportedTemplate): void {
    if (!this.hot || !exported.version?.layoutJSON) return;
    const layout = exported.version.layoutJSON;

    // --- 1. Determine grid dimensions (skip METADATA_ROW column at index 0) ---
    const visibleCols = layout.columns.filter(c => c.colCode !== 'METADATA_ROW');
    const headerRowCount = layout.fixedRowsTop || layout.headerRows?.length || 1;
    const bodyRows = layout.rows || [];
    const totalRows = headerRowCount + bodyRows.length;
    const totalCols = visibleCols.length;

    // --- 2. Build data matrix ---
    const data: any[][] = [];

    // 2a. Header rows from headerRows definition
    for (let hr = 0; hr < headerRowCount; hr++) {
      const row: any[] = new Array(totalCols).fill('');
      const headerRow = layout.headerRows?.[hr];
      if (headerRow) {
        for (const cell of headerRow.cells) {
          if (!cell.colKey || cell.colKey === 'ID') continue;
          // Find the visible column index for this colKey
          const colIdx = visibleCols.findIndex(vc => vc.key === cell.colKey);
          if (colIdx >= 0) {
            row[colIdx] = cell.label;
          }
        }
      }
      data.push(row);
    }

    // 2b. Body rows from rows definition
    for (const rowDef of bodyRows) {
      const row: any[] = new Array(totalCols).fill(null);

      // Find STT column
      const sttIdx = visibleCols.findIndex(vc => vc.colCode === 'STT');
      if (sttIdx >= 0) {
        // Generate STT based on level
        if (rowDef.level === 0) {
          row[sttIdx] = '';
        }
      }

      // Find CHITIEU_NAME column
      const chitieuIdx = visibleCols.findIndex(vc => vc.colCode === 'CHITIEU_NAME');
      if (chitieuIdx >= 0) {
        const indent = rowDef.level > 0 ? '  '.repeat(rowDef.level) : '';
        const prefix = rowDef.level >= 2 ? '- ' : '';
        row[chitieuIdx] = indent + prefix + rowDef.title;
      }

      data.push(row);
    }

    // Ensure minimum rows for usability
    while (data.length < 5) {
      data.push(new Array(totalCols).fill(null));
    }

    // --- 3. Build column widths ---
    const colWidths = visibleCols.map(vc => vc.width || 120);

    // --- 4. Build merge cells (shift col by -1 to skip METADATA_ROW) ---
    const mergeCells: { row: number; col: number; rowspan: number; colspan: number }[] = [];
    if (layout.mergeCells) {
      for (const mc of layout.mergeCells) {
        // Shift col index: exported has METADATA_ROW at col=0, so visible col = mc.col - 1
        const visCol = mc.col - 1;
        if (visCol >= 0 && visCol < totalCols) {
          mergeCells.push({ row: mc.row, col: visCol, rowspan: mc.rowspan, colspan: mc.colspan });
        }
      }
    }

    // --- 5. Update grid ---
    this.gridRows = data.length;
    this.gridCols = totalCols;
    this.fixedRows = headerRowCount;
    this.fixedCols = Math.max(0, (layout.freezeColumns || 1) - 1); // -1 for METADATA_ROW

    this.hot.updateSettings({
      data,
      colWidths,
      fixedColumnsStart: this.fixedCols,
      fixedRowsTop: this.fixedRows,
      mergeCells: mergeCells.length > 0 ? mergeCells : false,
    });

    // --- 6. Rebuild internal metadata ---
    this.cellMetadata.clear();
    this.mergedCells = [...mergeCells];
    this.rowCodeMap.clear();
    this.rowCodeNameMap.clear();
    this.columnCodeMap.clear();
    this.columnCodeNameMap.clear();

    // 6a. Column code maps
    for (let c = 0; c < visibleCols.length; c++) {
      const vc = visibleCols[c];
      if (vc.colCode) {
        this.columnCodeMap.set(c, vc.colCode);
        this.columnCodeNameMap.set(c, vc.title);
      }

      // Mark header cells
      for (let hr = 0; hr < headerRowCount; hr++) {
        this.cellMetadata.set(`${hr},${c}`, { role: 'header', readOnly: true });
      }
    }

    // 6b. Row code maps + cell roles from mappings
    for (let i = 0; i < bodyRows.length; i++) {
      const rowIdx = headerRowCount + i;
      const rowDef = bodyRows[i];
      this.rowCodeMap.set(rowIdx, rowDef.rowCode);
      this.rowCodeNameMap.set(rowIdx, rowDef.title);

      // Mark STT and CHITIEU columns as text/readOnly
      const sttIdx = visibleCols.findIndex(vc => vc.colCode === 'STT');
      if (sttIdx >= 0) {
        this.cellMetadata.set(`${rowIdx},${sttIdx}`, { role: 'text', readOnly: true });
      }
      const chitieuIdx = visibleCols.findIndex(vc => vc.colCode === 'CHITIEU_NAME');
      if (chitieuIdx >= 0) {
        this.cellMetadata.set(`${rowIdx},${chitieuIdx}`, { role: 'text', readOnly: true });
      }
    }

    // 6c. Apply mappings for formulas and cell roles
    if (layout.mappings) {
      for (const mapping of layout.mappings) {
        const rowIdx = bodyRows.findIndex(r => r.rowCode === mapping.rowCode);
        const colIdx = visibleCols.findIndex(c => c.colCode === mapping.colCode);
        if (rowIdx < 0 || colIdx < 0) continue;

        const gridRow = headerRowCount + rowIdx;
        const cellRole = mapping.cellRole as CellRole || 'data';
        this.cellMetadata.set(`${gridRow},${colIdx}`, {
          role: cellRole,
          readOnly: mapping.isReadOnly,
          formula: mapping.formula,
        });

        // Apply formula value to the grid
        if (mapping.formula) {
          // Convert commas back to semicolons for HyperFormula
          const hfFormula = mapping.formula.replace(/,/g, ';');
          this.hot.setDataAtCell(gridRow, colIdx, hfFormula, 'loadData');
        }
      }
    }

    // 6d. Rebuild selectedRowIndicators/selectedColIndicators lists from code maps
    this.selectedRowIndicators = [];
    this.selectedColIndicators = [];

    this.hot.render();
    console.log('[FormDesigner] ✅ Grid rebuilt from ExportedTemplate:', {
      rows: data.length, cols: totalCols, merges: mergeCells.length,
      headerRows: headerRowCount, bodyRows: bodyRows.length,
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

  // ==========================================
  // Row/Col Re-indexing Helpers
  // ==========================================
  // When Handsontable inserts/removes rows/cols, all Maps using
  // numeric indices as keys must be shifted to stay correct.

  private reindexRowInsert(index: number, amount: number): void {
    // 1) Shift rowCodeMap / rowCodeNameMap
    this.rowCodeMap = this.shiftMapKeys(this.rowCodeMap, index, amount);
    this.rowCodeNameMap = this.shiftMapKeys(this.rowCodeNameMap, index, amount);

    // 2) Shift cellMetadata (row part of "row,col" keys)
    this.cellMetadata = this.shiftCellMetadataRows(this.cellMetadata, index, amount);

    // 3) Shift mergedCells
    for (const mc of this.mergedCells) {
      if (mc.row >= index) mc.row += amount;
    }
  }

  private reindexRowRemove(index: number, amount: number): void {
    // 1) Remove entries in deleted range, then shift down
    for (let i = index; i < index + amount; i++) {
      this.rowCodeMap.delete(i);
      this.rowCodeNameMap.delete(i);
    }
    this.rowCodeMap = this.shiftMapKeys(this.rowCodeMap, index + amount, -amount);
    this.rowCodeNameMap = this.shiftMapKeys(this.rowCodeNameMap, index + amount, -amount);

    // 2) Shift cellMetadata
    const newMeta = new Map<string, { role: CellRole; readOnly: boolean; formula?: string }>();
    for (const [key, val] of this.cellMetadata) {
      const [r, c] = key.split(',').map(Number);
      if (r >= index && r < index + amount) continue; // skip deleted
      const newRow = r >= index + amount ? r - amount : r;
      newMeta.set(`${newRow},${c}`, val);
    }
    this.cellMetadata = newMeta;

    // 3) Shift mergedCells — remove ones inside deleted range, shift others
    this.mergedCells = this.mergedCells
      .filter(mc => !(mc.row >= index && mc.row < index + amount))
      .map(mc => ({
        ...mc,
        row: mc.row >= index + amount ? mc.row - amount : mc.row,
      }));
  }

  private reindexColInsert(index: number, amount: number): void {
    this.columnCodeMap = this.shiftMapKeys(this.columnCodeMap, index, amount);
    this.columnCodeNameMap = this.shiftMapKeys(this.columnCodeNameMap, index, amount);
    this.cellMetadata = this.shiftCellMetadataCols(this.cellMetadata, index, amount);
    for (const mc of this.mergedCells) {
      if (mc.col >= index) mc.col += amount;
    }
  }

  private reindexColRemove(index: number, amount: number): void {
    for (let i = index; i < index + amount; i++) {
      this.columnCodeMap.delete(i);
      this.columnCodeNameMap.delete(i);
    }
    this.columnCodeMap = this.shiftMapKeys(this.columnCodeMap, index + amount, -amount);
    this.columnCodeNameMap = this.shiftMapKeys(this.columnCodeNameMap, index + amount, -amount);

    const newMeta = new Map<string, { role: CellRole; readOnly: boolean; formula?: string }>();
    for (const [key, val] of this.cellMetadata) {
      const [r, c] = key.split(',').map(Number);
      if (c >= index && c < index + amount) continue;
      const newCol = c >= index + amount ? c - amount : c;
      newMeta.set(`${r},${newCol}`, val);
    }
    this.cellMetadata = newMeta;

    this.mergedCells = this.mergedCells
      .filter(mc => !(mc.col >= index && mc.col < index + amount))
      .map(mc => ({
        ...mc,
        col: mc.col >= index + amount ? mc.col - amount : mc.col,
      }));
  }

  /** Generic: shift numeric keys in a Map by `delta` for all keys >= `fromKey` */
  private shiftMapKeys<T>(map: Map<number, T>, fromKey: number, delta: number): Map<number, T> {
    const newMap = new Map<number, T>();
    for (const [key, val] of map) {
      if (key >= fromKey) {
        newMap.set(key + delta, val);
      } else {
        newMap.set(key, val);
      }
    }
    return newMap;
  }

  /** Shift row indices inside cellMetadata keys ("row,col") */
  private shiftCellMetadataRows(
    meta: Map<string, { role: CellRole; readOnly: boolean; formula?: string }>,
    fromRow: number, delta: number,
  ): Map<string, { role: CellRole; readOnly: boolean; formula?: string }> {
    const newMeta = new Map<string, { role: CellRole; readOnly: boolean; formula?: string }>();
    for (const [key, val] of meta) {
      const [r, c] = key.split(',').map(Number);
      const newRow = r >= fromRow ? r + delta : r;
      newMeta.set(`${newRow},${c}`, val);
    }
    return newMeta;
  }

  /** Shift col indices inside cellMetadata keys ("row,col") */
  private shiftCellMetadataCols(
    meta: Map<string, { role: CellRole; readOnly: boolean; formula?: string }>,
    fromCol: number, delta: number,
  ): Map<string, { role: CellRole; readOnly: boolean; formula?: string }> {
    const newMeta = new Map<string, { role: CellRole; readOnly: boolean; formula?: string }>();
    for (const [key, val] of meta) {
      const [r, c] = key.split(',').map(Number);
      const newCol = c >= fromCol ? c + delta : c;
      newMeta.set(`${r},${newCol}`, val);
    }
    return newMeta;
  }

  addEntValue(): void { this.entValues.push(''); }
  removeEntValue(i: number): void { if (this.entValues.length > 1) this.entValues.splice(i, 1); }

  // ==========================================
  // Indicator Code (Mã chỉ tiêu) Management
  // ==========================================

  private async loadIndicatorCodes(): Promise<void> {
    // === Row Indicators: gọi API thật DimAccount/get-tree ===
    this.dimAccountApi.loadAccountTree().subscribe({
      next: (groups) => {
        if (groups.length > 0) {
          this.rowIndicators.set(groups);
          console.log('[FormDesigner] ✅ Row indicators loaded from API:', groups.length, 'groups');
        } else {
          console.warn('[FormDesigner] ⚠️ API trả 0 groups, fallback mock');
          this.loadRowIndicatorsFromMock();
        }
      },
      error: () => {
        console.warn('[FormDesigner] ❌ API DimAccount failed, fallback mock');
        this.loadRowIndicatorsFromMock();
      },
    });

    // === Column Indicators: vẫn dùng mock (cột thời gian, kỳ báo cáo) ===
    try {
      const res = await this.bieuMauService.layDanhMucMaChiTieu();
      if (res.trangThai && res.duLieu?.columnIndicators) {
        this.colIndicators.set(res.duLieu.columnIndicators);
        console.log('[FormDesigner] ✅ Column indicators loaded from mock');
      }
    } catch {
      console.warn('[FormDesigner] ⚠️ Không load được column indicators mock');
    }
  }

  /** Fallback: load row indicators từ mock JSON nếu API fail */
  private async loadRowIndicatorsFromMock(): Promise<void> {
    try {
      const res = await this.bieuMauService.layDanhMucMaChiTieu();
      if (res.trangThai && res.duLieu?.rowIndicators) {
        this.rowIndicators.set(res.duLieu.rowIndicators);
      }
    } catch {
      console.warn('[FormDesigner] ⚠️ Cả API và mock đều fail');
    }
  }

  // --- Cell info helpers (for properties panel) ---
  getAssignedColCode(): string | null {
    const sel = this.selectedCell();
    if (!sel) return null;
    return this.columnCodeMap.get(sel.col) || null;
  }

  getAssignedColName(): string | null {
    const sel = this.selectedCell();
    if (!sel) return null;
    return this.columnCodeNameMap.get(sel.col) || null;
  }

  getAssignedRowCode(): string | null {
    const sel = this.selectedCell();
    if (!sel) return null;
    return this.rowCodeMap.get(sel.row) || null;
  }

  getAssignedRowName(): string | null {
    const sel = this.selectedCell();
    if (!sel) return null;
    return this.rowCodeNameMap.get(sel.row) || null;
  }

  getCurrentRowTitle(): string {
    const sel = this.selectedCell();
    if (!sel || !this.hot) return '';
    const colCount = this.hot.countCols();
    const titleCol = colCount > 1 ? 1 : 0;
    const val = this.hot.getDataAtCell(sel.row, titleCol);
    return val ? String(val).trim() : `Dòng ${sel.row + 1}`;
  }

  // ==========================================
  // Indicator Selection Dialog — ROW
  // ==========================================

  openRowIndicatorDialog(): void {
    this.tempRowSelection.clear();
    this.tempRowOrderedList = [];
    // Restore from previously applied selection (preserve user's order)
    for (const item of this.selectedRowIndicators) {
      this.tempRowSelection.add(item.code);
      this.tempRowOrderedList.push({ ...item });
    }
    this.indicatorSearchTerm = '';
    this.dragGroupIndex = null;
    this.dragOverGroupIndex = null;
    this.showRowIndicatorDialog.set(true);
  }

  toggleTempRowIndicator(item: IndicatorItem): void {
    if (this.tempRowSelection.has(item.code)) {
      // Uncheck → remove from selection and ordered list
      this.tempRowSelection.delete(item.code);
      this.tempRowOrderedList = this.tempRowOrderedList.filter(i => i.code !== item.code);
    } else {
      // Check → insert at the correct hierarchical position
      this.tempRowSelection.add(item.code);
      const level = item.level || 0;

      if (level === 0) {
        // Parent item: add at end
        this.tempRowOrderedList.push({ ...item });
        // Also pull any orphaned children that belong under this parent
        this.regroupOrphanedChildren(item);
      } else {
        // Child item: find its parent and insert after parent's children group
        const parentCode = this.findParentCode(item.code);
        if (parentCode) {
          const parentIdx = this.tempRowOrderedList.findIndex(i => i.code === parentCode);
          if (parentIdx >= 0) {
            // Find end of parent's children block
            let insertIdx = parentIdx + 1;
            const parentLevel = this.tempRowOrderedList[parentIdx].level || 0;
            while (insertIdx < this.tempRowOrderedList.length &&
                   (this.tempRowOrderedList[insertIdx].level || 0) > parentLevel) {
              insertIdx++;
            }
            this.tempRowOrderedList.splice(insertIdx, 0, { ...item });
            return;
          }
        }
        // Parent not in list → add as standalone
        this.tempRowOrderedList.push({ ...item });
      }
    }
  }

  /** Re-group orphaned children into their newly-added parent */
  private regroupOrphanedChildren(parentItem: IndicatorItem): void {
    const parentLevel = parentItem.level || 0;
    const childCodes = this.getChildCodesFromCatalog(parentItem.code, parentLevel);

    // Find any orphaned children in the list that should be under this parent
    const orphans: IndicatorItem[] = [];
    this.tempRowOrderedList = this.tempRowOrderedList.filter(i => {
      if (childCodes.has(i.code) && i.code !== parentItem.code) {
        orphans.push(i);
        return false; // remove from current position
      }
      return true;
    });

    if (orphans.length > 0) {
      // Re-insert orphans right after the parent, in catalog order
      const parentIdx = this.tempRowOrderedList.findIndex(i => i.code === parentItem.code);
      if (parentIdx >= 0) {
        const catalogOrder = this.getCatalogChildOrder(parentItem.code);
        orphans.sort((a, b) => {
          const aIdx = catalogOrder.indexOf(a.code);
          const bIdx = catalogOrder.indexOf(b.code);
          return aIdx - bIdx;
        });
        this.tempRowOrderedList.splice(parentIdx + 1, 0, ...orphans);
      }
    }
  }

  /** Get all descendant codes of a parent from catalog */
  private getChildCodesFromCatalog(parentCode: string, parentLevel: number): Set<string> {
    const codes = new Set<string>();
    for (const group of this.rowIndicators()) {
      let found = false;
      for (const item of group.items) {
        if (item.code === parentCode) { found = true; continue; }
        if (found) {
          if ((item.level || 0) > parentLevel) {
            codes.add(item.code);
          } else {
            break; // reached next sibling or parent
          }
        }
      }
    }
    return codes;
  }

  /** Get child codes in catalog order */
  private getCatalogChildOrder(parentCode: string): string[] {
    const codes: string[] = [];
    for (const group of this.rowIndicators()) {
      let found = false;
      let parentLevel = 0;
      for (const item of group.items) {
        if (item.code === parentCode) {
          found = true;
          parentLevel = item.level || 0;
          continue;
        }
        if (found) {
          if ((item.level || 0) > parentLevel) {
            codes.push(item.code);
          } else {
            break;
          }
        }
      }
    }
    return codes;
  }

  /** Find parent code from catalog hierarchy */
  findParentCode(childCode: string): string | null {
    for (const group of this.rowIndicators()) {
      for (let i = 0; i < group.items.length; i++) {
        if (group.items[i].code === childCode) {
          const childLevel = group.items[i].level || 0;
          if (childLevel === 0) return null;
          for (let j = i - 1; j >= 0; j--) {
            if ((group.items[j].level || 0) < childLevel) {
              return group.items[j].code;
            }
          }
          return null;
        }
      }
    }
    return null;
  }

  isTempRowSelected(code: string): boolean {
    return this.tempRowSelection.has(code);
  }

  selectAllRowIndicators(): void {
    // Add all items in catalog order — maintains correct hierarchy
    this.tempRowSelection.clear();
    this.tempRowOrderedList = [];
    for (const group of this.rowIndicators()) {
      for (const item of group.items) {
        this.tempRowSelection.add(item.code);
        this.tempRowOrderedList.push({ ...item });
      }
    }
  }

  deselectAllRowIndicators(): void {
    this.tempRowSelection.clear();
    this.tempRowOrderedList = [];
  }

  getTempRowSelectionCount(): number {
    return this.tempRowOrderedList.length;
  }

  // --- Group-based preview ---

  /** Build preview groups: parent + nested children */
  getPreviewGroups(): PreviewGroup[] {
    const groups: PreviewGroup[] = [];
    const list = this.tempRowOrderedList;
    let i = 0;
    while (i < list.length) {
      const item = list[i];
      const level = item.level || 0;
      const group: PreviewGroup = { parent: item, children: [] };
      i++;
      // Collect all consecutive items with higher level as children
      while (i < list.length && (list[i].level || 0) > level) {
        group.children.push(list[i]);
        i++;
      }
      groups.push(group);
    }
    return groups;
  }

  /** Rebuild flat list from groups (after reorder) */
  private rebuildFromGroups(groups: PreviewGroup[]): void {
    this.tempRowOrderedList = groups.flatMap(g => [g.parent, ...g.children]);
  }

  // --- Group reorder: Move Up / Down ---
  moveGroupUp(groupIdx: number): void {
    if (groupIdx <= 0) return;
    const groups = this.getPreviewGroups();
    [groups[groupIdx - 1], groups[groupIdx]] = [groups[groupIdx], groups[groupIdx - 1]];
    this.rebuildFromGroups(groups);
  }

  moveGroupDown(groupIdx: number): void {
    const groups = this.getPreviewGroups();
    if (groupIdx >= groups.length - 1) return;
    [groups[groupIdx], groups[groupIdx + 1]] = [groups[groupIdx + 1], groups[groupIdx]];
    this.rebuildFromGroups(groups);
  }

  /** Remove entire group (parent + all children) */
  removeGroup(groupIdx: number): void {
    const groups = this.getPreviewGroups();
    if (groupIdx < 0 || groupIdx >= groups.length) return;
    const group = groups[groupIdx];
    this.tempRowSelection.delete(group.parent.code);
    for (const child of group.children) {
      this.tempRowSelection.delete(child.code);
    }
    groups.splice(groupIdx, 1);
    this.rebuildFromGroups(groups);
  }

  /** Remove single child from a group */
  removeChildFromGroup(childCode: string): void {
    this.tempRowSelection.delete(childCode);
    this.tempRowOrderedList = this.tempRowOrderedList.filter(i => i.code !== childCode);
  }

  /** Move a child (any level) up among its siblings. Sub-children follow. */
  moveChildUp(childCode: string): void {
    const list = this.tempRowOrderedList;
    const flatIdx = list.findIndex(i => i.code === childCode);
    if (flatIdx <= 0) return;

    const itemLevel = list[flatIdx].level || 0;

    // Find end of this item's sub-group (itself + deeper children)
    let groupEnd = flatIdx;
    while (groupEnd + 1 < list.length && (list[groupEnd + 1].level || 0) > itemLevel) {
      groupEnd++;
    }

    // Find previous sibling at same level (walk backwards)
    let prevStart = -1;
    for (let i = flatIdx - 1; i >= 0; i--) {
      const l = list[i].level || 0;
      if (l === itemLevel) { prevStart = i; break; }
      if (l < itemLevel) return; // hit parent boundary
    }
    if (prevStart < 0) return;

    // Extract current sub-group and insert before previous sibling
    const group = list.splice(flatIdx, groupEnd - flatIdx + 1);
    list.splice(prevStart, 0, ...group);
  }

  /** Move a child (any level) down among its siblings. Sub-children follow. */
  moveChildDown(childCode: string): void {
    const list = this.tempRowOrderedList;
    const flatIdx = list.findIndex(i => i.code === childCode);
    if (flatIdx < 0) return;

    const itemLevel = list[flatIdx].level || 0;

    // Find end of this item's sub-group
    let groupEnd = flatIdx;
    while (groupEnd + 1 < list.length && (list[groupEnd + 1].level || 0) > itemLevel) {
      groupEnd++;
    }

    // Find next sibling at same level
    let nextStart = -1;
    for (let i = groupEnd + 1; i < list.length; i++) {
      const l = list[i].level || 0;
      if (l === itemLevel) { nextStart = i; break; }
      if (l < itemLevel) return; // hit parent boundary
    }
    if (nextStart < 0) return;

    // Find end of next sibling's sub-group
    let nextEnd = nextStart;
    while (nextEnd + 1 < list.length && (list[nextEnd + 1].level || 0) > itemLevel) {
      nextEnd++;
    }

    // Extract next sibling's sub-group and insert before current item
    const nextGroup = list.splice(nextStart, nextEnd - nextStart + 1);
    list.splice(flatIdx, 0, ...nextGroup);
  }

  /** Check if a child can move up (has a previous sibling within same parent) */
  canChildMoveUp(childCode: string): boolean {
    const list = this.tempRowOrderedList;
    const idx = list.findIndex(i => i.code === childCode);
    if (idx <= 0) return false;
    const level = list[idx].level || 0;
    for (let i = idx - 1; i >= 0; i--) {
      const l = list[i].level || 0;
      if (l === level) return true;
      if (l < level) return false;
    }
    return false;
  }

  /** Check if a child can move down (has a next sibling within same parent) */
  canChildMoveDown(childCode: string): boolean {
    const list = this.tempRowOrderedList;
    const idx = list.findIndex(i => i.code === childCode);
    if (idx < 0) return false;
    const level = list[idx].level || 0;
    // Skip past sub-group
    let end = idx;
    while (end + 1 < list.length && (list[end + 1].level || 0) > level) { end++; }
    // Check forward for sibling
    for (let i = end + 1; i < list.length; i++) {
      const l = list[i].level || 0;
      if (l === level) return true;
      if (l < level) return false;
    }
    return false;
  }

  // --- HTML5 Drag & Drop for GROUP reorder ---
  onGroupDragStart(event: DragEvent, groupIdx: number): void {
    this.dragGroupIndex = groupIdx;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(groupIdx));
    }
  }

  onGroupDragOver(event: DragEvent, groupIdx: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverGroupIndex = groupIdx;
  }

  onGroupDragLeave(): void {
    this.dragOverGroupIndex = null;
  }

  onGroupDrop(event: DragEvent, targetGroupIdx: number): void {
    event.preventDefault();
    if (this.dragGroupIndex === null || this.dragGroupIndex === targetGroupIdx) {
      this.dragGroupIndex = null;
      this.dragOverGroupIndex = null;
      return;
    }
    const groups = this.getPreviewGroups();
    const [movedGroup] = groups.splice(this.dragGroupIndex, 1);
    const adjustedTarget = this.dragGroupIndex < targetGroupIdx ? targetGroupIdx - 1 : targetGroupIdx;
    groups.splice(adjustedTarget, 0, movedGroup);
    this.rebuildFromGroups(groups);
    this.dragGroupIndex = null;
    this.dragOverGroupIndex = null;
  }

  onGroupDragEnd(): void {
    this.dragGroupIndex = null;
    this.dragOverGroupIndex = null;
  }

  applyRowIndicators(): void {
    if (!this.hot) return;

    // Use the user-ordered list (not catalog order)
    const selected = [...this.tempRowOrderedList];
    this.selectedRowIndicators = selected;

    this.writeRowIndicatorData(selected);
    this.hot.render();

    this.showRowIndicatorDialog.set(false);
    this.notify(`Đã áp dụng ${selected.length} chỉ tiêu dòng lên lưới`, 'success');
  }

  /** Write row indicator body data to the grid at the correct offset below headers.
   *  Shared by applyRowIndicators() and applyColIndicators() to keep body rows in sync. */
  private writeRowIndicatorData(selected: IndicatorItem[]): void {
    if (!this.hot || selected.length === 0) return;

    // Determine how many header rows exist (read from grid settings as primary source)
    const gridFixedRows = this.hot?.getSettings().fixedRowsTop;
    const headerRowCount = (typeof gridFixedRows === 'number' && gridFixedRows > 0)
      ? gridFixedRows
      : (this.fixedRows || 1);
    const colCount = this.hot.countCols();
    const currentRowCount = this.hot.countRows();
    const requiredBodyRows = selected.length;
    const requiredTotalRows = headerRowCount + requiredBodyRows;

    // Adjust row count
    if (requiredTotalRows > currentRowCount) {
      this.hot.alter('insert_row_below', currentRowCount - 1, requiredTotalRows - currentRowCount);
    } else if (requiredTotalRows < currentRowCount) {
      this.hot.alter('remove_row', requiredTotalRows, currentRowCount - requiredTotalRows);
    }
    this.gridRows = requiredTotalRows;

    // Clear old code maps for body rows
    this.rowCodeMap.clear();
    this.rowCodeNameMap.clear();

    // Populate rows — in user's chosen order
    const changes: [number, number, any][] = [];
    let parentCounter = 0;
    for (let i = 0; i < selected.length; i++) {
      const rowIdx = headerRowCount + i;
      const item = selected[i];

      // Col 0 = STT
      const level = item.level || 0;
      if (level === 0) parentCounter++;
      const sttLabel = level === 0 ? String(parentCounter) : '';
      changes.push([rowIdx, 0, sttLabel]);

      // Col 1 = Tên chỉ tiêu (with indent)
      const indent = level > 0 ? '  '.repeat(level) : '';
      const prefix = level >= 2 ? '- ' : '';
      changes.push([rowIdx, 1, indent + prefix + item.name]);

      // Clear data columns
      for (let c = 2; c < colCount; c++) {
        changes.push([rowIdx, c, null]);
      }

      // Store code mapping
      this.rowCodeMap.set(rowIdx, item.code);
      this.rowCodeNameMap.set(rowIdx, item.name);

      // Mark STT + Chỉ tiêu columns as read-only
      this.cellMetadata.set(`${rowIdx},0`, { role: 'text', readOnly: true });
      this.cellMetadata.set(`${rowIdx},1`, { role: 'text', readOnly: true });
    }

    this.hot.setDataAtCell(changes, 'loadData');
  }

  // ==========================================
  // Indicator Selection Dialog — COLUMN
  // ==========================================

  openColIndicatorDialog(): void {
    this.tempColSelection.clear();
    this.tempColOrderedList = [];

    // Restore from previously saved state
    for (const item of this.selectedColIndicators) {
      this.tempColSelection.add(item.code);
      this.tempColOrderedList.push({ ...item });
    }

    // Re-group orphan children under their group headers (fixes Issue #1)
    const groupHeaders = this.tempColOrderedList.filter(i => i.isGroupHeader);
    for (const gh of groupHeaders) {
      this.regroupColOrphans(gh);
    }

    this.indicatorSearchTerm = '';
    this.dragColGroupIndex = null;
    this.dragOverColGroupIndex = null;
    this.showColIndicatorDialog.set(true);
  }

  toggleTempColIndicator(item: IndicatorItem): void {
    if (item.type === 'system') return;
    if (this.tempColSelection.has(item.code)) {
      // --- Deselect ---
      this.tempColSelection.delete(item.code);
      // If group header, also remove its children
      if (item.isGroupHeader) {
        const childCodes = this.getColGroupChildCodes(item.code);
        for (const cc of childCodes) this.tempColSelection.delete(cc);
        this.tempColOrderedList = this.tempColOrderedList.filter(
          i => i.code !== item.code && !childCodes.has(i.code)
        );
      } else {
        this.tempColOrderedList = this.tempColOrderedList.filter(i => i.code !== item.code);
      }
    } else {
      // --- Select ---
      this.tempColSelection.add(item.code);
      const level = item.level || 0;
      if (level === 0) {
        this.tempColOrderedList.push({ ...item });
        if (item.isGroupHeader) {
          // Auto-select all children (Issue #3: notification)
          const childCount = this.autoSelectColChildren(item);
          this.regroupColOrphans(item);
          if (childCount > 0) {
            this.notify(`Đã thêm "${item.name}" + ${childCount} cột con`, 'success');
          }
        }
      } else {
        // Child: insert under parent
        const parentCode = this.findColParentCode(item.code);
        if (parentCode) {
          const parentIdx = this.tempColOrderedList.findIndex(i => i.code === parentCode);
          if (parentIdx >= 0) {
            let insertIdx = parentIdx + 1;
            const parentLevel = this.tempColOrderedList[parentIdx].level || 0;
            while (insertIdx < this.tempColOrderedList.length &&
                   (this.tempColOrderedList[insertIdx].level || 0) > parentLevel) {
              insertIdx++;
            }
            this.tempColOrderedList.splice(insertIdx, 0, { ...item });
            return;
          }
        }
        this.tempColOrderedList.push({ ...item });
      }
    }
  }

  /** Auto-select all children of a group header. Returns count of children added. */
  private autoSelectColChildren(parentItem: IndicatorItem): number {
    let count = 0;
    const parentLevel = parentItem.level || 0;
    for (const group of this.colIndicators()) {
      let found = false;
      for (const item of group.items) {
        if (item.code === parentItem.code) { found = true; continue; }
        if (found) {
          if ((item.level || 0) > parentLevel) {
            if (!this.tempColSelection.has(item.code)) {
              this.tempColSelection.add(item.code);
              this.tempColOrderedList.push({ ...item });
              count++;
            }
          } else {
            break;
          }
        }
      }
    }
    return count;
  }

  /** Get all child codes belonging to a group header */
  private getColGroupChildCodes(parentCode: string): Set<string> {
    const codes = new Set<string>();
    for (const group of this.colIndicators()) {
      let found = false;
      let parentLevel = 0;
      for (const item of group.items) {
        if (item.code === parentCode) { found = true; parentLevel = item.level || 0; continue; }
        if (found) {
          if ((item.level || 0) > parentLevel) codes.add(item.code);
          else break;
        }
      }
    }
    return codes;
  }

  private regroupColOrphans(parentItem: IndicatorItem): void {
    const parentLevel = parentItem.level || 0;
    const childCodes = new Set<string>();
    for (const group of this.colIndicators()) {
      let found = false;
      for (const item of group.items) {
        if (item.code === parentItem.code) { found = true; continue; }
        if (found) {
          if ((item.level || 0) > parentLevel) childCodes.add(item.code);
          else break;
        }
      }
    }
    const orphans: IndicatorItem[] = [];
    this.tempColOrderedList = this.tempColOrderedList.filter(i => {
      if (childCodes.has(i.code) && i.code !== parentItem.code) { orphans.push(i); return false; }
      return true;
    });
    if (orphans.length > 0) {
      const parentIdx = this.tempColOrderedList.findIndex(i => i.code === parentItem.code);
      if (parentIdx >= 0) {
        this.tempColOrderedList.splice(parentIdx + 1, 0, ...orphans);
      }
    }
  }

  findColParentCode(childCode: string): string | null {
    for (const group of this.colIndicators()) {
      for (let i = 0; i < group.items.length; i++) {
        if (group.items[i].code === childCode) {
          const childLevel = group.items[i].level || 0;
          if (childLevel === 0) return null;
          for (let j = i - 1; j >= 0; j--) {
            if ((group.items[j].level || 0) < childLevel) return group.items[j].code;
          }
          return null;
        }
      }
    }
    return null;
  }

  isTempColSelected(code: string): boolean {
    return this.tempColSelection.has(code);
  }

  selectAllColIndicators(): void {
    this.tempColSelection.clear();
    this.tempColOrderedList = [];
    for (const group of this.colIndicators()) {
      for (const item of group.items) {
        if (item.type !== 'system') {
          this.tempColSelection.add(item.code);
          this.tempColOrderedList.push({ ...item });
        }
      }
    }
  }

  deselectAllColIndicators(): void {
    this.tempColSelection.clear();
    this.tempColOrderedList = [];
  }

  getTempColSelectionCount(): number {
    return this.tempColOrderedList.filter(i => !i.isGroupHeader).length;
  }

  // --- Column group preview ---
  getColPreviewGroups(): PreviewGroup[] {
    const groups: PreviewGroup[] = [];
    const list = this.tempColOrderedList;
    let i = 0;
    while (i < list.length) {
      const item = list[i];
      const level = item.level || 0;
      const group: PreviewGroup = { parent: item, children: [] };
      i++;
      while (i < list.length && (list[i].level || 0) > level) {
        group.children.push(list[i]);
        i++;
      }
      groups.push(group);
    }
    return groups;
  }

  /** Count leaf columns (actual data columns, not group headers) */
  getColLeafCount(): number {
    return this.tempColOrderedList.filter(i => !i.isGroupHeader).length;
  }

  // --- Column group reorder ---
  moveColGroupUp(groupIdx: number): void {
    if (groupIdx <= 0) return;
    const groups = this.getColPreviewGroups();
    [groups[groupIdx - 1], groups[groupIdx]] = [groups[groupIdx], groups[groupIdx - 1]];
    this.tempColOrderedList = groups.flatMap(g => [g.parent, ...g.children]);
  }

  moveColGroupDown(groupIdx: number): void {
    const groups = this.getColPreviewGroups();
    if (groupIdx >= groups.length - 1) return;
    [groups[groupIdx], groups[groupIdx + 1]] = [groups[groupIdx + 1], groups[groupIdx]];
    this.tempColOrderedList = groups.flatMap(g => [g.parent, ...g.children]);
  }

  removeColGroup(groupIdx: number): void {
    const groups = this.getColPreviewGroups();
    if (groupIdx < 0 || groupIdx >= groups.length) return;
    const group = groups[groupIdx];
    this.tempColSelection.delete(group.parent.code);
    for (const child of group.children) this.tempColSelection.delete(child.code);
    groups.splice(groupIdx, 1);
    this.tempColOrderedList = groups.flatMap(g => [g.parent, ...g.children]);
  }

  removeColChild(childCode: string): void {
    this.tempColSelection.delete(childCode);
    this.tempColOrderedList = this.tempColOrderedList.filter(i => i.code !== childCode);
  }

  // Column child movement (reuse same pattern as rows)
  moveColChildUp(childCode: string): void {
    const list = this.tempColOrderedList;
    const flatIdx = list.findIndex(i => i.code === childCode);
    if (flatIdx <= 0) return;
    const itemLevel = list[flatIdx].level || 0;
    let groupEnd = flatIdx;
    while (groupEnd + 1 < list.length && (list[groupEnd + 1].level || 0) > itemLevel) groupEnd++;
    let prevStart = -1;
    for (let i = flatIdx - 1; i >= 0; i--) {
      const l = list[i].level || 0;
      if (l === itemLevel) { prevStart = i; break; }
      if (l < itemLevel) return;
    }
    if (prevStart < 0) return;
    const group = list.splice(flatIdx, groupEnd - flatIdx + 1);
    list.splice(prevStart, 0, ...group);
  }

  moveColChildDown(childCode: string): void {
    const list = this.tempColOrderedList;
    const flatIdx = list.findIndex(i => i.code === childCode);
    if (flatIdx < 0) return;
    const itemLevel = list[flatIdx].level || 0;
    let groupEnd = flatIdx;
    while (groupEnd + 1 < list.length && (list[groupEnd + 1].level || 0) > itemLevel) groupEnd++;
    let nextStart = -1;
    for (let i = groupEnd + 1; i < list.length; i++) {
      const l = list[i].level || 0;
      if (l === itemLevel) { nextStart = i; break; }
      if (l < itemLevel) return;
    }
    if (nextStart < 0) return;
    let nextEnd = nextStart;
    while (nextEnd + 1 < list.length && (list[nextEnd + 1].level || 0) > itemLevel) nextEnd++;
    const nextGroup = list.splice(nextStart, nextEnd - nextStart + 1);
    list.splice(flatIdx, 0, ...nextGroup);
  }

  canColChildMoveUp(childCode: string): boolean {
    const list = this.tempColOrderedList;
    const idx = list.findIndex(i => i.code === childCode);
    if (idx <= 0) return false;
    const level = list[idx].level || 0;
    for (let i = idx - 1; i >= 0; i--) {
      const l = list[i].level || 0;
      if (l === level) return true;
      if (l < level) return false;
    }
    return false;
  }

  canColChildMoveDown(childCode: string): boolean {
    const list = this.tempColOrderedList;
    const idx = list.findIndex(i => i.code === childCode);
    if (idx < 0) return false;
    const level = list[idx].level || 0;
    let end = idx;
    while (end + 1 < list.length && (list[end + 1].level || 0) > level) end++;
    for (let i = end + 1; i < list.length; i++) {
      const l = list[i].level || 0;
      if (l === level) return true;
      if (l < level) return false;
    }
    return false;
  }

  // --- Column group D&D ---
  onColGroupDragStart(event: DragEvent, groupIdx: number): void {
    this.dragColGroupIndex = groupIdx;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(groupIdx));
    }
  }
  onColGroupDragOver(event: DragEvent, groupIdx: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverColGroupIndex = groupIdx;
  }
  onColGroupDragLeave(): void { this.dragOverColGroupIndex = null; }
  onColGroupDrop(event: DragEvent, targetGroupIdx: number): void {
    event.preventDefault();
    if (this.dragColGroupIndex === null || this.dragColGroupIndex === targetGroupIdx) {
      this.dragColGroupIndex = null; this.dragOverColGroupIndex = null; return;
    }
    const groups = this.getColPreviewGroups();
    const [movedGroup] = groups.splice(this.dragColGroupIndex, 1);
    const adj = this.dragColGroupIndex < targetGroupIdx ? targetGroupIdx - 1 : targetGroupIdx;
    groups.splice(adj, 0, movedGroup);
    this.tempColOrderedList = groups.flatMap(g => [g.parent, ...g.children]);
    this.dragColGroupIndex = null; this.dragOverColGroupIndex = null;
  }
  onColGroupDragEnd(): void { this.dragColGroupIndex = null; this.dragOverColGroupIndex = null; }

  // --- Apply column indicators with multi-level headers ---
  applyColIndicators(): void {
    if (!this.hot) return;

    // Build leaf columns (skip group headers — they only create colspan)
    const leafCols = this.tempColOrderedList.filter(i => !i.isGroupHeader);
    this.selectedColIndicators = [...this.tempColOrderedList]; // store full ordered list

    const fixedColCount = 3; // STT, Chỉ tiêu, ĐVT
    const requiredCols = fixedColCount + leafCols.length;
    const currentCols = this.hot.countCols();

    if (requiredCols > currentCols) {
      this.hot.alter('insert_col_end', currentCols - 1, requiredCols - currentCols);
    } else if (requiredCols < currentCols) {
      this.hot.alter('remove_col', requiredCols, currentCols - requiredCols);
    }
    this.gridCols = requiredCols;

    this.columnCodeMap.clear();
    this.columnCodeNameMap.clear();

    // Dynamic header row count based on max level (Issue #2)
    const maxLevel = Math.max(0, ...this.tempColOrderedList.map(i => i.level || 0));
    const hasGroupHeaders = maxLevel > 0;
    const headerRows = hasGroupHeaders ? maxLevel + 1 : 1;

    // Ensure grid has enough rows for headers
    const currentRows = this.hot.countRows();
    if (currentRows < headerRows + 1) {
      this.hot.alter('insert_row_below', currentRows - 1, headerRows + 1 - currentRows);
    }

    const changes: [number, number, any][] = [];

    // Fixed column headers
    changes.push([0, 0, 'STT']);
    changes.push([0, 1, 'Chỉ tiêu']);
    changes.push([0, 2, 'Đơn vị tính']);
    if (hasGroupHeaders) {
      changes.push([1, 0, '']);
      changes.push([1, 1, '']);
      changes.push([1, 2, '']);
    }
    this.columnCodeMap.set(0, 'STT');
    this.columnCodeNameMap.set(0, 'Số thứ tự');
    this.columnCodeMap.set(1, 'CHITIEU_NAME');
    this.columnCodeNameMap.set(1, 'Tên chỉ tiêu');
    this.columnCodeMap.set(2, 'UNIT');
    this.columnCodeNameMap.set(2, 'Đơn vị tính');

    // Build column groups from ordered list
    const groups = this.getColPreviewGroups();
    let colIdx = fixedColCount;
    const mergeCells: { row: number; col: number; rowspan: number; colspan: number }[] = [];

    // Fixed cols get rowspan 2 if multi-level
    if (hasGroupHeaders) {
      mergeCells.push({ row: 0, col: 0, rowspan: 2, colspan: 1 });
      mergeCells.push({ row: 0, col: 1, rowspan: 2, colspan: 1 });
      mergeCells.push({ row: 0, col: 2, rowspan: 2, colspan: 1 });
    }

    for (const group of groups) {
      if (group.parent.isGroupHeader && group.children.length > 0) {
        // Group header: row 0 = parent name (colspan), row 1 = child names
        const startCol = colIdx;
        changes.push([0, startCol, group.parent.name]);
        mergeCells.push({ row: 0, col: startCol, rowspan: 1, colspan: group.children.length });

        for (const child of group.children) {
          changes.push([1, colIdx, child.name]);
          this.columnCodeMap.set(colIdx, child.code);
          this.columnCodeNameMap.set(colIdx, child.name);
          this.cellMetadata.set(`0,${colIdx}`, { role: 'header', readOnly: true });
          this.cellMetadata.set(`1,${colIdx}`, { role: 'header', readOnly: true });
          colIdx++;
        }
      } else {
        // Standalone column: row 0 = name (rowspan 2 if multi-level)
        changes.push([0, colIdx, group.parent.name]);
        if (hasGroupHeaders) {
          changes.push([1, colIdx, '']);
          mergeCells.push({ row: 0, col: colIdx, rowspan: 2, colspan: 1 });
        }
        this.columnCodeMap.set(colIdx, group.parent.code);
        this.columnCodeNameMap.set(colIdx, group.parent.name);
        this.cellMetadata.set(`0,${colIdx}`, { role: 'header', readOnly: true });
        colIdx++;
      }
    }

    // Column widths
    const newWidths: number[] = [50, 250, 100];
    for (let i = 0; i < leafCols.length; i++) newWidths.push(120);
    this.hot.updateSettings({
      colWidths: newWidths,
      mergeCells: mergeCells.length > 0 ? mergeCells : false,
      fixedRowsTop: headerRows,
    } as any);

    // Sync component property with grid setting to prevent stale reads in applyRowIndicators()
    this.fixedRows = headerRows;

    // Sync programmatic merges into this.mergedCells so cells() callback can apply centering
    // Remove old header merges (rows within header area), then add new ones
    this.mergedCells = this.mergedCells.filter(m => m.row >= headerRows);
    for (const mc of mergeCells) {
      this.mergedCells.push(mc);
    }

    this.hot.setDataAtCell(changes, 'loadData');

    // Re-apply existing row indicators at the correct offset after header count change
    if (this.selectedRowIndicators.length > 0) {
      this.writeRowIndicatorData(this.selectedRowIndicators);
    }

    this.hot.render();
    this.showColIndicatorDialog.set(false);
    this.notify(`Đã áp dụng ${leafCols.length} chỉ tiêu cột lên lưới`, 'success');
  }

  // --- Filtered indicators for dialog search ---
  filteredDialogRowIndicators(): IndicatorGroup[] {
    const term = this.indicatorSearchTerm.toLowerCase().trim();
    if (!term) return this.rowIndicators();
    return this.rowIndicators()
      .map(g => ({
        ...g,
        items: g.items.filter(i =>
          i.code.toLowerCase().includes(term) ||
          i.name.toLowerCase().includes(term)
        )
      }))
      .filter(g => g.items.length > 0);
  }

  filteredDialogColIndicators(): IndicatorGroup[] {
    const term = this.indicatorSearchTerm.toLowerCase().trim();
    return this.colIndicators()
      .map(g => ({
        ...g,
        items: g.items.filter(i => {
          if (i.type === 'system') return false;
          if (!term) return true;
          return i.code.toLowerCase().includes(term) ||
                 i.name.toLowerCase().includes(term);
        })
      }))
      .filter(g => g.items.length > 0);
  }

  // --- Get flat list for applying to grid ---
  getTempRowSelectedItems(): IndicatorItem[] {
    return this.tempRowOrderedList;
  }

  getTempColSelectedItems(): IndicatorItem[] {
    return this.tempColOrderedList;
  }

}
