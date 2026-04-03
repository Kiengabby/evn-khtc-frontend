import {
  Component, ViewChild, ElementRef, HostListener,
  OnInit, AfterViewInit, OnDestroy,
  signal, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Handsontable from 'handsontable';
import { HyperFormula } from 'hyperformula';
import {
  TemplateParserService, TemplateJson, DimMetadata,
  ParsedGridConfig, PovSelection, FactDataPoint,
} from '../../services/template-parser.service';
import {
  PlanningApiService, TemplateListItem, PlanningScenarioItem, CellChangePayload, FormTemplateListItem,
} from '../../services/planning-api.service';
import {
  LayoutGridRendererService, RenderedGridConfig, RenderedRowMeta, RenderedColMeta,
} from '../../services/layout-grid-renderer.service';
import {
  LayoutJSON, GridCellData, LayoutColumnDef,
} from '../../../../core/models/layout-template.model';
import { FormRegistryService } from '../../../../core/services/form-registry.service';

interface PovDropdown {
  dimKey: string;
  label: string;
  members: { key: string; name: string }[];
  selected: string;
}

interface TrackedChange {
  row: number;
  col: number;
  oldValue: any;
  newValue: any;
  rowDimensions: Record<string, string>;
  colDimensions: Record<string, string>;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bao-cao-ke-hoach.component.html',
  styleUrl: './bao-cao-ke-hoach.component.scss',
})
export class BaoCaoKeHoachComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('hotEl') hotEl!: ElementRef;
  @ViewChild('periodRef') periodRef!: ElementRef;

  /** Close period dropdown when clicking outside */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.periodDropdownOpen && this.periodRef &&
        !this.periodRef.nativeElement.contains(event.target)) {
      this.periodDropdownOpen = false;
    }
  }

  private api    = inject(PlanningApiService);
  private parser = inject(TemplateParserService);
  private http   = inject(HttpClient);
  private v2Renderer = inject(LayoutGridRendererService);
  private formRegistry = inject(FormRegistryService);

  // === Template & Data ===
  template   = signal<TemplateJson | null>(null);
  dimMeta    = signal<DimMetadata | null>(null);
  factData   = signal<FactDataPoint[]>([]);
  gridConfig: ParsedGridConfig | null = null;

  // === V2 Layout mode ===
  isV2Mode = false;
  v2GridConfig: RenderedGridConfig | null = null;
  v2LayoutJSON: LayoutJSON | null = null;
  v2VisibleCols: LayoutColumnDef[] = [];

  // === Filters (theo API BE) ===
  formId = '';              // Mã biểu mẫu — sẽ được set từ API list ngay khi tải xong
  entityCode = 'EVN';       // Mã đơn vị
  nam = 2026;               // Năm
  period = 'Kỳ 1';          // Kỳ báo cáo — BE bắt buộc (NullRef nếu rỗng)
  scenario = 'Kế hoạch';    // Kịch bản

  // Danh sách kỳ báo cáo nhóm theo loại
  periodGroups = [
    {
      group: 'Kỳ',
      icon: 'pi-calendar',
      items: [
        { value: 'Kỳ 1',  label: 'Kỳ 1', sub: 'Tháng 1–6' },
        { value: 'Kỳ 2',  label: 'Kỳ 2', sub: 'Tháng 7–12' },
      ],
    },
    {
      group: 'Quý',
      icon: 'pi-chart-bar',
      items: [
        { value: 'Q1', label: 'Quý 1', sub: 'T1–T3' },
        { value: 'Q2', label: 'Quý 2', sub: 'T4–T6' },
        { value: 'Q3', label: 'Quý 3', sub: 'T7–T9' },
        { value: 'Q4', label: 'Quý 4', sub: 'T10–T12' },
      ],
    },
    {
      group: 'Tháng',
      icon: 'pi-calendar-plus',
      items: [
        { value: 'T1',  label: 'Tháng 1',  sub: '' },
        { value: 'T2',  label: 'Tháng 2',  sub: '' },
        { value: 'T3',  label: 'Tháng 3',  sub: '' },
        { value: 'T4',  label: 'Tháng 4',  sub: '' },
        { value: 'T5',  label: 'Tháng 5',  sub: '' },
        { value: 'T6',  label: 'Tháng 6',  sub: '' },
        { value: 'T7',  label: 'Tháng 7',  sub: '' },
        { value: 'T8',  label: 'Tháng 8',  sub: '' },
        { value: 'T9',  label: 'Tháng 9',  sub: '' },
        { value: 'T10', label: 'Tháng 10', sub: '' },
        { value: 'T11', label: 'Tháng 11', sub: '' },
        { value: 'T12', label: 'Tháng 12', sub: '' },
      ],
    },
    {
      group: 'Tổng hợp',
      icon: 'pi-check-circle',
      items: [
        { value: 'Năm', label: 'Cả năm', sub: 'T1–T12' },
      ],
    },
  ];

  // Custom dropdown state
  periodDropdownOpen = false;

  get periodLabel(): string {
    for (const g of this.periodGroups) {
      const found = g.items.find(i => i.value === this.period);
      if (found) return found.label;
    }
    return this.period;
  }

  selectPeriod(value: string): void {
    this.period = value;
    this.periodDropdownOpen = false;
  }

  togglePeriodDropdown(): void {
    this.periodDropdownOpen = !this.periodDropdownOpen;
  }

  closePeriodDropdown(): void {
    this.periodDropdownOpen = false;
  }
  
  // Backward compatible aliases
  get bieuMau(): string { return this.formId; }
  set bieuMau(v: string) { this.formId = v; }
  get kichBan(): string { return this.scenario; }
  set kichBan(v: string) { this.scenario = v; }
  
  // Danh sách dropdown (có thể mở rộng sau)
  danhSachBieuMau = signal<TemplateListItem[]>([]);
  danhSachKichBan = signal<PlanningScenarioItem[]>([]);
  povDropdowns    = signal<PovDropdown[]>([]);

  /** Danh sách biểu mẫu từ API /api/v2/FormTemplate/get-list */
  danhSachBieuMauV2 = signal<FormTemplateListItem[]>([]);
  /** ID biểu mẫu hiện đang chọn (id từ FormTemplate) */
  selectedFormTemplateId = signal<number | null>(null);
  /** Đang tải danh sách biểu mẫu */
  dangTaiBieuMau = signal(false);

  // === Grid state ===
  hot: Handsontable | null = null;
  dangTai         = signal(false);
  dangLuu         = signal(false);
  soOThayDoi      = signal(0);
  tongGiaTri      = signal<number | null>(null);
  countGiaTri     = signal(0);
  viTriO          = signal('');
  congThucHienTai = signal('');
  thongBao        = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);
  zoomLevel       = 100;
  private trackedChanges: TrackedChange[] = [];

  /** Panel test: nạp mẫu từ JSON (dán hoặc file) — chỉ dùng khi kiểm thử */
  panelJsonTestMo = signal(false);
  noiDungJsonTest = '';

  // ===================================
  // Lifecycle
  // ===================================

  ngOnInit(): void {
    document.addEventListener('keydown', this.xuLyPhimTat);
    this.taiDanhSachBieuMau();
  }

  ngAfterViewInit(): void {
    this.khoiTaoGrid();
    // Không tự động load - đợi user nhấn nút "Tải biểu mẫu"
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.xuLyPhimTat);
    this.hot?.destroy();
  }

  // ===================================
  // 1. Load form từ API (V2)
  // ===================================

  taiForm(): void {
    if (!this.formId?.trim()) {
      this.hienThiThongBao('Vui lòng nhập Mã biểu mẫu (formId)', 'error');
      return;
    }
    
    this.dangTai.set(true);
    this.xoaThayDoi();

    // ★ Gọi API V2 với đầy đủ params theo Swagger spec
    this.isV2Mode = true;
    console.log('[DataEntry] 🔍 Loading V2 form:', {
      formId: this.formId,
      entityCode: this.entityCode,
      year: this.nam,
      period: this.period,
      scenario: this.scenario,
    });

    this.api.loadFormV2(this.formId, this.entityCode, this.nam, this.period, this.scenario).subscribe({
      next: (res) => {
        console.log('[DataEntry] 📥 V2 form loaded:', res.template.formId, res.template.formName);
        const layout = res.template.version.layoutJSON;
        this.v2LayoutJSON = layout;
        this.v2VisibleCols = layout.columns.filter(c => c.colCode !== 'METADATA_ROW');
        this.v2GridConfig = this.v2Renderer.render(layout, res.dbData);
        this.renderV2Grid();
        this.dangTai.set(false);
        this.hienThiThongBao(`Đã tải biểu mẫu "${res.template.formName}"`, 'success');
      },
      error: (err) => {
        console.error('[DataEntry] ❌ V2 load error:', err);
        const errMsg = err?.message || err?.error?.message || JSON.stringify(err);
        this.hienThiThongBao('Lỗi tải biểu mẫu: ' + errMsg, 'error');
        this.dangTai.set(false);
      },
    });
  }

  /** Fallback: Load form V1 (dimension-based) - giữ cho backward compatible */
  private loadFormV1Fallback(): void {
    this.isV2Mode = false;
    this.api.loadForm(this.bieuMau).subscribe({
      next: (res) => {
        this.template.set(res.template);
        this.dimMeta.set(res.dimMeta);
        this.factData.set(res.factData);
        this.xayDungPovDropdowns(res.template, res.dimMeta);
        this.parseVaRender();
        this.dangTai.set(false);
      },
      error: (err) => {
        this.hienThiThongBao('Lỗi tải dữ liệu: ' + (err?.message ?? err), 'error');
        this.dangTai.set(false);
      },
    });
  }

  /** Render V2 (colCode/rowCode) grid */
  private renderV2Grid(): void {
    if (!this.v2GridConfig || !this.hot) return;
    const cfg = this.v2GridConfig;
    const hdrCount = cfg.headerRowCount || 0;

    this.hot.updateSettings({
      data:              cfg.data,
      colHeaders:        false,
      nestedHeaders:     undefined as any,
      colWidths:         cfg.colWidths,
      fixedColumnsStart: cfg.fixedColumnsStart,
      fixedRowsTop:      cfg.fixedRowsTop,
      columns:           cfg.columns,
      mergeCells:        cfg.mergeCells.length > 0 ? cfg.mergeCells : false,
      // ★ Truyền formulaCellSet để ô công thức được highlight đúng và khóa sửa
      cells: this.v2Renderer.buildCellCallback(
        cfg.rowMeta,
        this.v2VisibleCols,
        cfg.formulaCellSet,
      ),
      rowHeaders: hdrCount > 0
        ? ((index: number) => index < hdrCount ? '' : String(index - hdrCount + 1)) as any
        : true,
    });
    this.hot.render();
    this.xoaThayDoi();
    console.log('[DataEntry] ✅ V2 grid rendered:', {
      rows: cfg.data.length, cols: cfg.colWidths.length,
      merges: cfg.mergeCells.length, headerRows: hdrCount,
      formulaCells: cfg.formulaCellSet.size,
    });
  }

  // ===================================
  // 3. Build POV dropdowns từ template
  // ===================================

  private xayDungPovDropdowns(tpl: TemplateJson, meta: DimMetadata): void {
    const dropdowns: PovDropdown[] = [];
    for (let i = 0; i < tpl.POV.Dimension.length; i++) {
      const dimKey = tpl.POV.Dimension[i];
      const label  = tpl.POV.Promt[i];
      const dimData = meta[dimKey] ?? {};
      const members = Object.entries(dimData).map(([key, val]) => ({
        key,
        name: val.Name || key,
      }));
      dropdowns.push({ dimKey, label, members, selected: members[0]?.key ?? '' });
    }
    this.povDropdowns.set(dropdowns);
  }

  // ===================================
  // 4. Parse template → grid + populate data
  // ===================================

  private parseVaRender(): void {
    const tpl  = this.template();
    const meta = this.dimMeta();
    if (!tpl || !meta) return;

    const pov = this.layPovHienTai();
    this.gridConfig = this.parser.parse(tpl, meta, pov, this.nam);

    const facts = this.factData();
    if (facts.length > 0) {
      this.parser.populateFactData(this.gridConfig, facts, pov);
    }

    this.hot?.updateSettings({
      data:              this.gridConfig.data,
      nestedHeaders:     this.gridConfig.nestedHeaders,
      colWidths:         this.gridConfig.colWidths,
      fixedColumnsStart: this.gridConfig.fixedColumnsStart,
      columns:           this.gridConfig.columns,
      cells:             this.parser.buildCellCallback(
                           this.gridConfig.rowMeta,
                           this.gridConfig.physicalCols),
    });
    this.hot?.render();
    this.xoaThayDoi();
  }

  private layPovHienTai(): PovSelection {
    const pov: PovSelection = {};
    for (const dd of this.povDropdowns()) {
      pov[dd.dimKey] = dd.selected;
    }
    return pov;
  }

  // ===================================
  // 5. Event handlers
  // ===================================

  onPovChange(): void {
    this.parseVaRender();
  }

  onBieuMauChange(): void {
    this.taiForm();
  }

  /** Khi user chọn biểu mẫu từ dropdown -> tự động load */
  onFormTemplateChange(formCode: string): void {
    this.formId = formCode;
    console.log('[DataEntry] 🔄 Form selected:', this.formId);
    // Tự động load biểu mẫu khi chọn
    this.taiForm();
  }

  /** Gọi API lấy danh sách biểu mẫu */
  private taiDanhSachBieuMau(): void {
    this.dangTaiBieuMau.set(true);
    this.api.getFormTemplateList().subscribe({
      next: (list) => {
        this.danhSachBieuMauV2.set(list);
        this.dangTaiBieuMau.set(false);
        console.log('[DataEntry] 📋 FormTemplate list loaded:', list.length, 'items');
        // ★ LUÔN auto-select item đầu tiên và tự động load
        if (list.length > 0) {
          this.selectedFormTemplateId.set(list[0].id);
          this.formId = list[0].formCode;
          console.log('[DataEntry] ✅ Auto-selected form:', this.formId, '(id:', list[0].id, ')');
          // Tự động load biểu mẫu đầu tiên
          this.taiForm();
        }
      },
      error: (err) => {
        this.dangTaiBieuMau.set(false);
        console.warn('[DataEntry] ⚠️ Không tải được danh sách biểu mẫu:', err?.message);
      },
    });
  }

  togglePanelJsonTest(): void {
    this.panelJsonTestMo.update(v => !v);
  }

  /**
   * Nạp mẫu từ JSON trong textarea.
   * Hỗ trợ:
   *   - `{ "template": {...}, "dimMeta": {...}, "factData": [...] }` (giống PlanningFormResponse)
   *   - Hoặc chỉ object template gốc (sẽ tải `dimension-metadata.json`, factData = [])
   */
  apDungJsonTest(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.noiDungJsonTest.trim() || '{}');
    } catch {
      this.hienThiThongBao('JSON không hợp lệ (syntax).', 'error');
      return;
    }

    const root = parsed as Record<string, unknown>;
    const tpl = (root['template'] ?? root) as TemplateJson;
    if (!tpl?.POV?.Dimension || !tpl?.GRID?.COLS || !tpl?.GRID?.ROWS) {
      this.hienThiThongBao(
        'Thiếu cấu trúc mẫu: cần POV.Dimension, GRID.COLS, GRID.ROWS.',
        'error',
      );
      return;
    }

    const dimFromJson = root['dimMeta'] as DimMetadata | undefined;
    const factsRaw = root['factData'];
    const facts: FactDataPoint[] = Array.isArray(factsRaw)
      ? (factsRaw as FactDataPoint[])
      : [];

    const hoanTat = (meta: DimMetadata): void => {
      this.xoaThayDoi();
      this.template.set(tpl);
      this.dimMeta.set(meta);
      this.factData.set(facts);
      this.bieuMau = tpl.templateId ?? 'JSON_TEST';
      this.xayDungPovDropdowns(tpl, meta);
      this.parseVaRender();
      console.log('[KHTC JSON test] Đã nạp mẫu', {
        templateId: tpl.templateId,
        templateName: tpl.templateName,
        dimKeys: Object.keys(meta),
        factCount: facts.length,
        payload: { template: tpl, dimMeta: meta, factData: facts },
      });
      this.hienThiThongBao('Đã nạp mẫu từ JSON (xem console).', 'success');
    };

    if (dimFromJson && typeof dimFromJson === 'object') {
      hoanTat(dimFromJson);
      return;
    }

    this.dangTai.set(true);
    this.http.get<DimMetadata>('assets/mock-data/dimension-metadata.json').subscribe({
      next: (meta) => {
        hoanTat(meta);
        this.dangTai.set(false);
      },
      error: (err) => {
        this.dangTai.set(false);
        this.hienThiThongBao(
          'Không tải được dimension-metadata.json: ' + (err?.message ?? err),
          'error',
        );
      },
    });
  }

  onChonFileJson(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.noiDungJsonTest = String(reader.result ?? '');
      input.value = '';
    };
    reader.onerror = () => {
      this.hienThiThongBao('Đọc file thất bại.', 'error');
      input.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  }

  /** In ra console + copy clipboard bundle hiện tại để chỉnh và nạp lại */
  logVaCopyJsonMauHienTai(): void {
    const tpl = this.template();
    const meta = this.dimMeta();
    if (!tpl || !meta) {
      this.hienThiThongBao('Chưa có mẫu trên grid để xuất.', 'error');
      return;
    }
    const bundle = {
      template: tpl,
      dimMeta: meta,
      factData: this.factData(),
    };
    const text = JSON.stringify(bundle, null, 2);
    console.log('[KHTC JSON test] Mẫu hiện tại (copy để sửa / nạp lại):\n', text);
    void navigator.clipboard.writeText(text).then(
      () => this.hienThiThongBao('Đã log console + copy clipboard.', 'success'),
      () => this.hienThiThongBao('Đã log console (clipboard không khả dụng).', 'success'),
    );
  }

  onKichBanChange(): void {
    const tpl = this.template();
    const meta = this.dimMeta();
    if (!tpl || !meta) return;

    this.dangTai.set(true);
    this.api
      .loadFactData(this.bieuMau, this.layPovHienTai(), this.nam, this.kichBan)
      .subscribe({
        next: (facts) => {
          this.factData.set(facts);
          this.parseVaRender();
          this.dangTai.set(false);
        },
        error: (err) => {
          this.hienThiThongBao(
            'Lỗi tải dữ liệu theo kịch bản: ' + (err?.message ?? err),
            'error',
          );
          this.dangTai.set(false);
        },
      });
  }

  // ===================================
  // 6. Save
  // ===================================

  luuDuLieu(): void {
    // V2 save: collect ALL data cells from grid (not just changes)
    if (this.isV2Mode && this.v2GridConfig && this.hot) {
      this.dangLuu.set(true);
      
      // Extract ALL editable cells from the current grid
      const allCells = this.v2Renderer.extractAllDataCells(
        this.hot,
        this.v2GridConfig.rowMeta,
        this.v2GridConfig.colMeta,
      );

      if (allCells.length === 0) {
        this.hienThiThongBao('Không có dữ liệu để lưu', 'error');
        this.dangLuu.set(false);
        return;
      }

      console.log('[DataEntry] 💾 Saving V2:', {
        formId: this.formId,
        year: this.nam,
        period: this.period,
        scenario: this.scenario,
        cellCount: allCells.length,
      });

      this.api.saveFormV2({
        formId: this.formId,
        version_year: this.nam,
        orgId: this.entityCode,
        period: this.period,
        scenario: this.scenario,
        data: allCells,
      }).subscribe({
        next: (result) => {
          this.dangLuu.set(false);
          if (result.success) {
            this.hienThiThongBao(result.message ?? `Đã lưu ${result.savedCount} ô dữ liệu!`, 'success');
            this.xoaThayDoi();
          } else {
            this.hienThiThongBao(result.message ?? 'Lưu thất bại', 'error');
          }
        },
        error: (err) => {
          this.dangLuu.set(false);
          this.hienThiThongBao('Lỗi lưu V2: ' + (err?.message ?? err), 'error');
        },
      });
      return;
    }

    // V1 save: dimension-based format (need tracked changes)
    if (this.trackedChanges.length === 0) return;
    this.dangLuu.set(true);

    const request = {
      templateId: this.bieuMau,
      pov: this.layPovHienTai(),
      nam: this.nam,
      scenarioId: this.kichBan,
      changes: this.trackedChanges.map<CellChangePayload>(tc => ({
        rowDimensions: tc.rowDimensions,
        colDimensions: tc.colDimensions,
        oldValue: tc.oldValue,
        newValue: tc.newValue,
      })),
    };

    this.api.saveChanges(request).subscribe({
      next: (result) => {
        this.dangLuu.set(false);
        if (result.success) {
          this.hienThiThongBao(
            result.message ?? `Đã lưu ${result.savedCount} thay đổi!`,
            'success',
          );
          this.xoaThayDoi();
        } else {
          this.hienThiThongBao(result.message ?? 'Lưu thất bại', 'error');
        }
      },
      error: (err) => {
        this.dangLuu.set(false);
        this.hienThiThongBao('Lỗi lưu: ' + (err?.message ?? err), 'error');
      },
    });
  }

  // ===================================
  // 7. Grid initialization
  // ===================================

  private khoiTaoGrid(): void {
    // Tạo HyperFormula instance (phải là instance, không phải class)
    const hfInstance = HyperFormula.buildEmpty({
      licenseKey: 'internal-use-in-handsontable',
      functionArgSeparator: ';',  // Dùng ";" như Form Designer
      decimalSeparator: '.',
    });

    this.hot = new Handsontable(this.hotEl.nativeElement, {
      data: [],
      colHeaders: true,
      rowHeaders: true,
      stretchH: 'none',
      height: 600,
      width: '100%',
      licenseKey: 'non-commercial-and-evaluation',
      manualColumnResize: true,
      manualRowResize: true,
      contextMenu: true,
      fillHandle: true,
      undo: true,
      autoWrapRow: true,
      autoWrapCol: true,
      fixedColumnsStart: 3,
      className: 'htMiddle',
      formulas: { engine: hfInstance },

      afterChange: (changes: any, source: string) => {
        if (source === 'loadData' || !changes) return;
        for (const [row, col, oldVal, newVal] of changes) {
          if (oldVal === newVal) continue;
          const pc = this.gridConfig?.physicalCols[col];
          const rm = this.gridConfig?.rowMeta[row];
          if (!pc || !rm) continue;

          const rowDims: Record<string, string> = {};
          if (rm.dimMembers) {
            for (const dm of rm.dimMembers) {
              rowDims[dm.dimKey] = dm.memberKey;
            }
          }
          const colDims: Record<string, string> = {};
          if (pc.dimIntersection) {
            for (const di of pc.dimIntersection) {
              colDims[di.dimKey] = di.memberKey;
            }
          }

          this.trackedChanges.push({
            row, col,
            oldValue: oldVal,
            newValue: newVal,
            rowDimensions: rowDims,
            colDimensions: colDims,
          });
        }
        this.soOThayDoi.set(this.trackedChanges.length);
      },

      afterSelection: (r: number, c: number) => {
        const colName = c < 0 ? '' : (this.hot?.getColHeader(c) ?? '');
        this.viTriO.set(colName + (r + 1).toString());
        const val = this.hot?.getSourceDataAtCell(r, c);
        this.congThucHienTai.set(val != null ? String(val) : '');
        this.tinhTongVungChon();
      },
    });
  }

  // ===================================
  // 8. Helpers
  // ===================================

  thaydoiZoom(delta: number): void {
    this.zoomLevel = Math.max(50, Math.min(150, this.zoomLevel + delta));
  }

  xuatExcel(): void {
    this.hot?.getPlugin('exportFile')?.downloadFile('csv', {
      bom: true,
      columnDelimiter: ',',
      columnHeaders: true,
      exportHiddenColumns: true,
      exportHiddenRows: true,
      fileExtension: 'csv',
      filename: `Bao_cao_${this.bieuMau}_${this.nam}`,
      mimeType: 'text/csv',
      rowDelimiter: '\r\n',
      rowHeaders: true,
    });
  }

  private xoaThayDoi(): void {
    this.trackedChanges = [];
    this.soOThayDoi.set(0);
  }

  private hienThiThongBao(noiDung: string, loai: 'success' | 'error'): void {
    this.thongBao.set({ noiDung, loai });
    setTimeout(() => this.thongBao.set(null), 3000);
  }

  private xuLyPhimTat = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      this.luuDuLieu();
    }
  };

  private tinhTongVungChon(): void {
    if (!this.hot) return;
    const selected = this.hot.getSelected();
    if (!selected?.length) {
      this.tongGiaTri.set(null);
      return;
    }

    let sum = 0, count = 0;
    const [r1, c1, r2, c2] = selected[0];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        const v = this.hot.getDataAtCell(r, c);
        if (typeof v === 'number') { sum += v; count++; }
      }
    }

    if (count > 0) {
      this.tongGiaTri.set(sum);
      this.countGiaTri.set(count);
    } else {
      this.tongGiaTri.set(null);
    }
  }
}
