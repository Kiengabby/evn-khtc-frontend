import {
  Component, ViewChild, ElementRef, HostListener,
  OnInit, AfterViewInit, OnDestroy,
  signal, inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Handsontable from 'handsontable';
import { HyperFormula } from 'hyperformula';
import {
  TemplateParserService, TemplateJson, DimMetadata,
  ParsedGridConfig, PovSelection, FactDataPoint,
} from '../../../service/template-parser.service';
import {
  PlanningApiService, TemplateListItem, PlanningScenarioItem, CellChangePayload, FormTemplateListItem,
} from '../../../service/planning-api.service';
import {
  LayoutGridRendererService, RenderedGridConfig, RenderedRowMeta, RenderedColMeta,
} from '../../../service/layout-grid-renderer.service';
import {
  LayoutJSON, GridCellData, LayoutColumnDef,
} from '../../../../config/models/layout-template.model';
import { FormRegistryService } from '../../../service/form-registry.service';

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

/** BÃ¡ÂºÂ£n ghi mÃ¡Â»â„¢t lÃ¡ÂºÂ§n lÃ†Â°u thÃƒÂ nh cÃƒÂ´ng trong phiÃƒÂªn lÃƒÂ m viÃ¡Â»â€¡c */
interface SessionRecord {
  formCode: string;
  formName: string;
  period: string;
  scenario: string;
  nam: number;
  savedAt: Date;
  savedCount: number;
}

/** Danh sÃƒÂ¡ch kÃ¡Â»Â³ theo thÃ¡Â»Â© tÃ¡Â»Â± Ã„â€˜Ã¡Â»Æ’ Ã„â€˜iÃ¡Â»Âu hÃ†Â°Ã¡Â»â€ºng nhanh */
const PERIOD_ORDER = [
  'T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12',
  'Q1','Q2','Q3','Q4',
  'KÃ¡Â»Â³ 1','KÃ¡Â»Â³ 2',
  'NÃ„Æ’m',
];

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
  formId = '';              // MÃƒÂ£ biÃ¡Â»Æ’u mÃ¡ÂºÂ«u Ã¢â‚¬â€ sÃ¡ÂºÂ½ Ã„â€˜Ã†Â°Ã¡Â»Â£c set tÃ¡Â»Â« API list ngay khi tÃ¡ÂºÂ£i xong
  entityCode = 'EVN';       // MÃƒÂ£ Ã„â€˜Ã†Â¡n vÃ¡Â»â€¹
  nam = 2026;               // NÃ„Æ’m
  period = 'KÃ¡Â»Â³ 1';          // KÃ¡Â»Â³ bÃƒÂ¡o cÃƒÂ¡o Ã¢â‚¬â€ BE bÃ¡ÂºÂ¯t buÃ¡Â»â„¢c (NullRef nÃ¡ÂºÂ¿u rÃ¡Â»â€”ng)
  scenario = 'KÃ¡ÂºÂ¿ hoÃ¡ÂºÂ¡ch';    // KÃ¡Â»â€¹ch bÃ¡ÂºÂ£n

  // Danh sÃƒÂ¡ch kÃ¡Â»Â³ bÃƒÂ¡o cÃƒÂ¡o nhÃƒÂ³m theo loÃ¡ÂºÂ¡i
  periodGroups = [
    {
      group: 'KÃ¡Â»Â³',
      icon: 'pi-calendar',
      items: [
        { value: 'KÃ¡Â»Â³ 1',  label: 'KÃ¡Â»Â³ 1', sub: 'ThÃƒÂ¡ng 1Ã¢â‚¬â€œ6' },
        { value: 'KÃ¡Â»Â³ 2',  label: 'KÃ¡Â»Â³ 2', sub: 'ThÃƒÂ¡ng 7Ã¢â‚¬â€œ12' },
      ],
    },
    {
      group: 'QuÃƒÂ½',
      icon: 'pi-chart-bar',
      items: [
        { value: 'Q1', label: 'QuÃƒÂ½ 1', sub: 'T1Ã¢â‚¬â€œT3' },
        { value: 'Q2', label: 'QuÃƒÂ½ 2', sub: 'T4Ã¢â‚¬â€œT6' },
        { value: 'Q3', label: 'QuÃƒÂ½ 3', sub: 'T7Ã¢â‚¬â€œT9' },
        { value: 'Q4', label: 'QuÃƒÂ½ 4', sub: 'T10Ã¢â‚¬â€œT12' },
      ],
    },
    {
      group: 'ThÃƒÂ¡ng',
      icon: 'pi-calendar-plus',
      items: [
        { value: 'T1',  label: 'ThÃƒÂ¡ng 1',  sub: '' },
        { value: 'T2',  label: 'ThÃƒÂ¡ng 2',  sub: '' },
        { value: 'T3',  label: 'ThÃƒÂ¡ng 3',  sub: '' },
        { value: 'T4',  label: 'ThÃƒÂ¡ng 4',  sub: '' },
        { value: 'T5',  label: 'ThÃƒÂ¡ng 5',  sub: '' },
        { value: 'T6',  label: 'ThÃƒÂ¡ng 6',  sub: '' },
        { value: 'T7',  label: 'ThÃƒÂ¡ng 7',  sub: '' },
        { value: 'T8',  label: 'ThÃƒÂ¡ng 8',  sub: '' },
        { value: 'T9',  label: 'ThÃƒÂ¡ng 9',  sub: '' },
        { value: 'T10', label: 'ThÃƒÂ¡ng 10', sub: '' },
        { value: 'T11', label: 'ThÃƒÂ¡ng 11', sub: '' },
        { value: 'T12', label: 'ThÃƒÂ¡ng 12', sub: '' },
      ],
    },
    {
      group: 'TÃ¡Â»â€¢ng hÃ¡Â»Â£p',
      icon: 'pi-check-circle',
      items: [
        { value: 'NÃ„Æ’m', label: 'CÃ¡ÂºÂ£ nÃ„Æ’m', sub: 'T1Ã¢â‚¬â€œT12' },
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
  
  // Danh sÃƒÂ¡ch dropdown (cÃƒÂ³ thÃ¡Â»Æ’ mÃ¡Â»Å¸ rÃ¡Â»â„¢ng sau)
  danhSachBieuMau = signal<TemplateListItem[]>([]);
  danhSachKichBan = signal<PlanningScenarioItem[]>([]);
  povDropdowns    = signal<PovDropdown[]>([]);

  /** Danh sÃƒÂ¡ch biÃ¡Â»Æ’u mÃ¡ÂºÂ«u tÃ¡Â»Â« API /api/v2/FormTemplate/get-list */
  danhSachBieuMauV2 = signal<FormTemplateListItem[]>([]);
  /** ID biÃ¡Â»Æ’u mÃ¡ÂºÂ«u hiÃ¡Â»â€¡n Ã„â€˜ang chÃ¡Â»Ân (id tÃ¡Â»Â« FormTemplate) */
  selectedFormTemplateId = signal<number | null>(null);
  /** Ã„Âang tÃ¡ÂºÂ£i danh sÃƒÂ¡ch biÃ¡Â»Æ’u mÃ¡ÂºÂ«u */
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Post-save UX: Next Action Dialog Ã¢â€â‚¬Ã¢â€â‚¬
  /** HiÃ¡Â»Æ’n thÃ¡Â»â€¹ dialog "TiÃ¡ÂºÂ¿p theo bÃ¡ÂºÂ¡n muÃ¡Â»â€˜n lÃƒÂ m gÃƒÂ¬?" */
  hienDialogTiepTheo = signal(false);
  /** ThÃƒÂ´ng tin lÃ¡ÂºÂ§n lÃ†Â°u vÃ¡Â»Â«a rÃ¡Â»â€œi (Ã„â€˜Ã¡Â»Æ’ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ trong dialog) */
  luuVuaRoi = signal<{ formCode: string; formName: string; period: string; savedCount: number } | null>(null);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Session Progress Tracker Ã¢â€â‚¬Ã¢â€â‚¬
  /** Danh sÃƒÂ¡ch cÃƒÂ¡c biÃ¡Â»Æ’u mÃ¡ÂºÂ«u Ã„â€˜ÃƒÂ£ lÃ†Â°u trong phiÃƒÂªn nÃƒÂ y */
  lichSuLuu = signal<SessionRecord[]>([]);
  /** HiÃ¡Â»Æ’n thÃ¡Â»â€¹ panel lÃ¡Â»â€¹ch sÃ¡Â»Â­ */
  hienLichSu = signal(false);

  /** KÃ¡Â»Â³ tiÃ¡ÂºÂ¿p theo theo thÃ¡Â»Â© tÃ¡Â»Â± */
  get kyTiepTheo(): string | null {
    const idx = PERIOD_ORDER.indexOf(this.period);
    return idx >= 0 && idx < PERIOD_ORDER.length - 1 ? PERIOD_ORDER[idx + 1] : null;
  }

  /** CÃƒÂ³ biÃ¡Â»Æ’u mÃ¡ÂºÂ«u tiÃ¡ÂºÂ¿p theo trong danh sÃƒÂ¡ch khÃƒÂ´ng? */
  get coBieuMauTiepTheo(): boolean {
    const list = this.danhSachBieuMauV2();
    const idx = list.findIndex(f => f.formCode === this.formId);
    return idx >= 0 && idx < list.length - 1;
  }

  /** BiÃ¡Â»Æ’u mÃ¡ÂºÂ«u tiÃ¡ÂºÂ¿p theo trong danh sÃƒÂ¡ch (formCode + formName) */
  get bieuMauTiepTheo(): { formCode: string; formName: string } | null {
    const list = this.danhSachBieuMauV2();
    const idx = list.findIndex(f => f.formCode === this.formId);
    return idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  }

  /** Panel test: nÃ¡ÂºÂ¡p mÃ¡ÂºÂ«u tÃ¡Â»Â« JSON (dÃƒÂ¡n hoÃ¡ÂºÂ·c file) Ã¢â‚¬â€ chÃ¡Â»â€° dÃƒÂ¹ng khi kiÃ¡Â»Æ’m thÃ¡Â»Â­ */
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
    // KhÃƒÂ´ng tÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng load - Ã„â€˜Ã¡Â»Â£i user nhÃ¡ÂºÂ¥n nÃƒÂºt "TÃ¡ÂºÂ£i biÃ¡Â»Æ’u mÃ¡ÂºÂ«u"
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.xuLyPhimTat);
    this.hot?.destroy();
  }

  // ===================================
  // 1. Load form tÃ¡Â»Â« API (V2)
  // ===================================

  taiForm(): void {
    if (!this.formId?.trim()) {
      this.hienThiThongBao('Vui lÃƒÂ²ng nhÃ¡ÂºÂ­p MÃƒÂ£ biÃ¡Â»Æ’u mÃ¡ÂºÂ«u (formId)', 'error');
      return;
    }
    
    this.dangTai.set(true);
    this.xoaThayDoi();

    // Ã¢Ëœâ€¦ GÃ¡Â»Âi API V2 vÃ¡Â»â€ºi Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§ params theo Swagger spec
    this.isV2Mode = true;
    console.log('[DataEntry] Ã°Å¸â€Â Loading V2 form:', {
      formId: this.formId,
      entityCode: this.entityCode,
      year: this.nam,
      period: this.period,
      scenario: this.scenario,
    });

    this.api.loadFormV2(this.formId, this.entityCode, this.nam, this.period, this.scenario).subscribe({
      next: (res) => {
        console.log('[DataEntry] Ã°Å¸â€œÂ¥ V2 form loaded:', res.template.formId, res.template.formName);
        const layout = res.template.version.layoutJSON;
        this.v2LayoutJSON = layout;
        this.v2VisibleCols = layout.columns.filter(c => c.colCode !== 'METADATA_ROW');
        this.v2GridConfig = this.v2Renderer.render(layout, res.dbData);
        this.renderV2Grid();
        this.dangTai.set(false);
        this.hienThiThongBao(`Ã„ÂÃƒÂ£ tÃ¡ÂºÂ£i biÃ¡Â»Æ’u mÃ¡ÂºÂ«u "${res.template.formName}"`, 'success');
      },
      error: (err) => {
        console.error('[DataEntry] Ã¢ÂÅ’ V2 load error:', err);
        const errMsg = err?.message || err?.error?.message || JSON.stringify(err);
        this.hienThiThongBao('LÃ¡Â»â€”i tÃ¡ÂºÂ£i biÃ¡Â»Æ’u mÃ¡ÂºÂ«u: ' + errMsg, 'error');
        this.dangTai.set(false);
      },
    });
  }

  /** Fallback: Load form V1 (dimension-based) - giÃ¡Â»Â¯ cho backward compatible */
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
        this.hienThiThongBao('LÃ¡Â»â€”i tÃ¡ÂºÂ£i dÃ¡Â»Â¯ liÃ¡Â»â€¡u: ' + (err?.message ?? err), 'error');
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
      // Ã¢Ëœâ€¦ TruyÃ¡Â»Ân formulaCellSet Ã„â€˜Ã¡Â»Æ’ ÃƒÂ´ cÃƒÂ´ng thÃ¡Â»Â©c Ã„â€˜Ã†Â°Ã¡Â»Â£c highlight Ã„â€˜ÃƒÂºng vÃƒÂ  khÃƒÂ³a sÃ¡Â»Â­a
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
    console.log('[DataEntry] Ã¢Å“â€¦ V2 grid rendered:', {
      rows: cfg.data.length, cols: cfg.colWidths.length,
      merges: cfg.mergeCells.length, headerRows: hdrCount,
      formulaCells: cfg.formulaCellSet.size,
    });
  }

  // ===================================
  // 3. Build POV dropdowns tÃ¡Â»Â« template
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
  // 4. Parse template Ã¢â€ â€™ grid + populate data
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

  /** Khi user chÃ¡Â»Ân biÃ¡Â»Æ’u mÃ¡ÂºÂ«u tÃ¡Â»Â« dropdown -> tÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng load */
  onFormTemplateChange(formCode: string): void {
    this.formId = formCode;
    console.log('[DataEntry] Ã°Å¸â€â€ž Form selected:', this.formId);
    // TÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng load biÃ¡Â»Æ’u mÃ¡ÂºÂ«u khi chÃ¡Â»Ân
    this.taiForm();
  }

  /** GÃ¡Â»Âi API lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch biÃ¡Â»Æ’u mÃ¡ÂºÂ«u */
  private taiDanhSachBieuMau(): void {
    this.dangTaiBieuMau.set(true);
    this.api.getFormTemplateList().subscribe({
      next: (list) => {
        this.danhSachBieuMauV2.set(list);
        this.dangTaiBieuMau.set(false);
        console.log('[DataEntry] Ã°Å¸â€œâ€¹ FormTemplate list loaded:', list.length, 'items');
        // Ã¢Ëœâ€¦ LUÃƒâ€N auto-select item Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn vÃƒÂ  tÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng load
        if (list.length > 0) {
          this.selectedFormTemplateId.set(list[0].id);
          this.formId = list[0].formCode;
          console.log('[DataEntry] Ã¢Å“â€¦ Auto-selected form:', this.formId, '(id:', list[0].id, ')');
          // TÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng load biÃ¡Â»Æ’u mÃ¡ÂºÂ«u Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn
          this.taiForm();
        }
      },
      error: (err) => {
        this.dangTaiBieuMau.set(false);
        console.warn('[DataEntry] Ã¢Å¡Â Ã¯Â¸Â KhÃƒÂ´ng tÃ¡ÂºÂ£i Ã„â€˜Ã†Â°Ã¡Â»Â£c danh sÃƒÂ¡ch biÃ¡Â»Æ’u mÃ¡ÂºÂ«u:', err?.message);
      },
    });
  }

  togglePanelJsonTest(): void {
    this.panelJsonTestMo.update(v => !v);
  }

  /**
   * NÃ¡ÂºÂ¡p mÃ¡ÂºÂ«u tÃ¡Â»Â« JSON trong textarea.
   * HÃ¡Â»â€” trÃ¡Â»Â£:
   *   - `{ "template": {...}, "dimMeta": {...}, "factData": [...] }` (giÃ¡Â»â€˜ng PlanningFormResponse)
   *   - HoÃ¡ÂºÂ·c chÃ¡Â»â€° object template gÃ¡Â»â€˜c (sÃ¡ÂºÂ½ tÃ¡ÂºÂ£i `dimension-metadata.json`, factData = [])
   */
  apDungJsonTest(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.noiDungJsonTest.trim() || '{}');
    } catch {
      this.hienThiThongBao('JSON khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡ (syntax).', 'error');
      return;
    }

    const root = parsed as Record<string, unknown>;
    const tpl = (root['template'] ?? root) as TemplateJson;
    if (!tpl?.POV?.Dimension || !tpl?.GRID?.COLS || !tpl?.GRID?.ROWS) {
      this.hienThiThongBao(
        'ThiÃ¡ÂºÂ¿u cÃ¡ÂºÂ¥u trÃƒÂºc mÃ¡ÂºÂ«u: cÃ¡ÂºÂ§n POV.Dimension, GRID.COLS, GRID.ROWS.',
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
      console.log('[KHTC JSON test] Ã„ÂÃƒÂ£ nÃ¡ÂºÂ¡p mÃ¡ÂºÂ«u', {
        templateId: tpl.templateId,
        templateName: tpl.templateName,
        dimKeys: Object.keys(meta),
        factCount: facts.length,
        payload: { template: tpl, dimMeta: meta, factData: facts },
      });
      this.hienThiThongBao('Ã„ÂÃƒÂ£ nÃ¡ÂºÂ¡p mÃ¡ÂºÂ«u tÃ¡Â»Â« JSON (xem console).', 'success');
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
          'KhÃƒÂ´ng tÃ¡ÂºÂ£i Ã„â€˜Ã†Â°Ã¡Â»Â£c dimension-metadata.json: ' + (err?.message ?? err),
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
      this.hienThiThongBao('Ã„ÂÃ¡Â»Âc file thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i.', 'error');
      input.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  }

  /** In ra console + copy clipboard bundle hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ chÃ¡Â»â€°nh vÃƒÂ  nÃ¡ÂºÂ¡p lÃ¡ÂºÂ¡i */
  logVaCopyJsonMauHienTai(): void {
    const tpl = this.template();
    const meta = this.dimMeta();
    if (!tpl || !meta) {
      this.hienThiThongBao('ChÃ†Â°a cÃƒÂ³ mÃ¡ÂºÂ«u trÃƒÂªn grid Ã„â€˜Ã¡Â»Æ’ xuÃ¡ÂºÂ¥t.', 'error');
      return;
    }
    const bundle = {
      template: tpl,
      dimMeta: meta,
      factData: this.factData(),
    };
    const text = JSON.stringify(bundle, null, 2);
    console.log('[KHTC JSON test] MÃ¡ÂºÂ«u hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (copy Ã„â€˜Ã¡Â»Æ’ sÃ¡Â»Â­a / nÃ¡ÂºÂ¡p lÃ¡ÂºÂ¡i):\n', text);
    void navigator.clipboard.writeText(text).then(
      () => this.hienThiThongBao('Ã„ÂÃƒÂ£ log console + copy clipboard.', 'success'),
      () => this.hienThiThongBao('Ã„ÂÃƒÂ£ log console (clipboard khÃƒÂ´ng khÃ¡ÂºÂ£ dÃ¡Â»Â¥ng).', 'success'),
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
            'LÃ¡Â»â€”i tÃ¡ÂºÂ£i dÃ¡Â»Â¯ liÃ¡Â»â€¡u theo kÃ¡Â»â€¹ch bÃ¡ÂºÂ£n: ' + (err?.message ?? err),
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
        this.hienThiThongBao('KhÃƒÂ´ng cÃƒÂ³ dÃ¡Â»Â¯ liÃ¡Â»â€¡u Ã„â€˜Ã¡Â»Æ’ lÃ†Â°u', 'error');
        this.dangLuu.set(false);
        return;
      }

      console.log('[DataEntry] Ã°Å¸â€™Â¾ Saving V2:', {
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
            const savedCount = result.savedCount ?? allCells.length;
            // Ghi vÃƒÂ o lÃ¡Â»â€¹ch sÃ¡Â»Â­ session
            const formName = this.danhSachBieuMauV2().find(f => f.formCode === this.formId)?.formName ?? this.formId;
            this.lichSuLuu.update(list => [{
              formCode: this.formId,
              formName,
              period: this.period,
              scenario: this.scenario,
              nam: this.nam,
              savedAt: new Date(),
              savedCount,
            }, ...list]);
            // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ dialog "TiÃ¡ÂºÂ¿p theo"
            this.luuVuaRoi.set({ formCode: this.formId, formName, period: this.period, savedCount });
            this.hienDialogTiepTheo.set(true);
            this.xoaThayDoi();
          } else {
            this.hienThiThongBao(result.message ?? 'LÃ†Â°u thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i', 'error');
          }
        },
        error: (err) => {
          this.dangLuu.set(false);
          this.hienThiThongBao('LÃ¡Â»â€”i lÃ†Â°u V2: ' + (err?.message ?? err), 'error');
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
            result.message ?? `Ã„ÂÃƒÂ£ lÃ†Â°u ${result.savedCount} thay Ã„â€˜Ã¡Â»â€¢i!`,
            'success',
          );
          this.xoaThayDoi();
        } else {
          this.hienThiThongBao(result.message ?? 'LÃ†Â°u thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i', 'error');
        }
      },
      error: (err) => {
        this.dangLuu.set(false);
        this.hienThiThongBao('LÃ¡Â»â€”i lÃ†Â°u: ' + (err?.message ?? err), 'error');
      },
    });
  }

  // ===================================
  // 7. Grid initialization
  // ===================================

  private khoiTaoGrid(): void {
    // TÃ¡ÂºÂ¡o HyperFormula instance (phÃ¡ÂºÂ£i lÃƒÂ  instance, khÃƒÂ´ng phÃ¡ÂºÂ£i class)
    const hfInstance = HyperFormula.buildEmpty({
      licenseKey: 'internal-use-in-handsontable',
      functionArgSeparator: ';',  // DÃƒÂ¹ng ";" nhÃ†Â° Form Designer
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Next Action Handlers Ã¢â€â‚¬Ã¢â€â‚¬

  /** Ã„ÂÃƒÂ³ng dialog tiÃ¡ÂºÂ¿p theo */
  dongDialogTiepTheo(): void {
    this.hienDialogTiepTheo.set(false);
    this.luuVuaRoi.set(null);
  }

  /** TiÃ¡ÂºÂ¿p tÃ¡Â»Â¥c nhÃ¡ÂºÂ­p trÃƒÂªn cÃƒÂ¹ng biÃ¡Â»Æ’u mÃ¡ÂºÂ«u + kÃ¡Â»Â³ (Ã„â€˜ÃƒÂ³ng dialog, load lÃ¡ÂºÂ¡i dÃ¡Â»Â¯ liÃ¡Â»â€¡u mÃ¡Â»â€ºi) */
  tiepTucNhapHienTai(): void {
    this.dongDialogTiepTheo();
    this.taiForm();
  }

  /** ChuyÃ¡Â»Æ’n sang kÃ¡Â»Â³ tiÃ¡ÂºÂ¿p theo rÃ¡Â»â€œi load */
  nhapKyTiepTheo(): void {
    const next = this.kyTiepTheo;
    if (!next) return;
    this.period = next;
    this.dongDialogTiepTheo();
    this.taiForm();
  }

  /** ChuyÃ¡Â»Æ’n sang biÃ¡Â»Æ’u mÃ¡ÂºÂ«u tiÃ¡ÂºÂ¿p theo trong danh sÃƒÂ¡ch */
  nhapBieuMauTiepTheo(): void {
    const list = this.danhSachBieuMauV2();
    const idx = list.findIndex(f => f.formCode === this.formId);
    const nextForm = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
    if (!nextForm) {
      this.dongDialogTiepTheo();
      return;
    }
    this.formId = nextForm.formCode;
    this.selectedFormTemplateId.set(nextForm.id);
    this.dongDialogTiepTheo();
    this.taiForm();
  }

  /** Toggle lÃ¡Â»â€¹ch sÃ¡Â»Â­ lÃ†Â°u */
  toggleLichSu(): void {
    this.hienLichSu.update(v => !v);
  }

  /** NhÃ¡ÂºÂ­p lÃ¡ÂºÂ¡i mÃ¡Â»â„¢t bÃ¡ÂºÂ£n ghi trong lÃ¡Â»â€¹ch sÃ¡Â»Â­ (chuyÃ¡Â»Æ’n params vÃƒÂ  load) */
  nhapLaiTuLichSu(rec: SessionRecord): void {
    this.formId = rec.formCode;
    this.period = rec.period;
    this.scenario = rec.scenario;
    this.nam = rec.nam;
    const found = this.danhSachBieuMauV2().find(f => f.formCode === rec.formCode);
    if (found) this.selectedFormTemplateId.set(found.id);
    this.hienLichSu.set(false);
    this.taiForm();
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
