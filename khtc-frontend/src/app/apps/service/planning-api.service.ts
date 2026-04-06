import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { catchError, delay, map, timeout, retry } from 'rxjs/operators';
import {
  TemplateJson, DimMetadata, PovSelection, FactDataPoint,
} from './template-parser.service';
import {
  LoadGridResponse, SaveGridPayload, LayoutJSON, LayoutTemplate, GridCellData,
  LayoutColumnDef, LayoutRowDef, LayoutHeaderRow, LayoutCellMapping,
} from '../../config/models/layout-template.model';
import {
  FormConfigApiResponse,
  normalizeApiResponse,
} from '../../config/models/form-config-api.model';
import { ConfigService } from '../../core/app-config.service';

export interface PlanningFormResponse {
  template: TemplateJson;
  dimMeta: DimMetadata;
  factData: FactDataPoint[];
}

export interface TemplateListItem {
  templateId: string;
  templateName: string;
  /** UUID cá»§a form (dÃ¹ng khi load form tá»« BE tháº­t) â€” optional vÃ¬ dÃ¹ng mock khi V1 */
  templateUUID?: string;
}

/** Item tráº£ vá» tá»« GET /api/v2/FormTemplate/get-list */
export interface FormTemplateListItem {
  id: number;
  formCode: string;
  formName: string;
  description?: string;
  isActive?: boolean;
}

/** Ká»‹ch báº£n nháº­p liá»‡u (VD: Káº¿ hoáº¡ch / Thá»±c hiá»‡n â€” mÃ£ SCE) â€” gá»­i kÃ¨m khi lÆ°u / táº£i dá»¯ liá»‡u */
export interface PlanningScenarioItem {
  scenarioId: string;
  scenarioName: string;
}

export interface CellChangePayload {
  rowDimensions: Record<string, string>;
  colDimensions: Record<string, string>;
  oldValue: any;
  newValue: any;
}

export interface SaveChangesRequest {
  templateId: string;
  pov: PovSelection;
  nam: number;
  /** MÃ£ ká»‹ch báº£n SCE (VD: KH = Káº¿ hoáº¡ch, TH = Thá»±c hiá»‡n) */
  scenarioId?: string;
  changes: CellChangePayload[];
}

export interface SaveResult {
  success: boolean;
  message?: string;
  savedCount?: number;
}

@Injectable({ providedIn: 'root' })
export class PlanningApiService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  /**
   * ================================================================
   *  MOCK / REAL API TOGGLE
   * ================================================================
   *  V1 (dimension-based) â€” váº«n dÃ¹ng mock (useMockV1)
   *  V2 (colCode/rowCode) â€” dÃ¹ng API tháº­t (useMockV2 = false)
   * ================================================================
   */
  private readonly useMockV1 = true;
  private readonly useMockV2 = false;  // â† API tháº­t cho V2!
  private readonly apiBaseUrl = '/api/planning';

  /** Base URL cho API tháº­t */
  private get beApiBase(): string {
    return this.configService.apiBaseUrl;
  }

  // ================================================================
  // SESSION DATA CACHE
  // Workaround: BE lÆ°u báº£n nhÃ¡p nhÆ°ng load-form tráº£ vá» toÃ n 0.
  // FE cache giÃ¡ trá»‹ Ä‘Ã£ lÆ°u trong phiÃªn, merge vÃ o khi load láº¡i.
  // ================================================================

  /** Map<cacheKey, Map<rowCode:colCode, value>> */
  private readonly sessionCache = new Map<string, Map<string, number>>();

  /** Táº¡o cache key tá»« cÃ¡c tham sá»‘ POV */
  private makeCacheKey(
    formCode: string, year: number,
    entityCode: string, period: string, scenario: string,
  ): string {
    return `${formCode}|${year}|${entityCode}|${period}|${scenario}`;
  }

  /** LÆ°u cells vÃ o session cache (chá»‰ lÆ°u non-zero Ä‘á»ƒ tiáº¿t kiá»‡m bá»™ nhá»›) */
  private cacheAfterSave(payload: SaveGridPayload): void {
    const key = this.makeCacheKey(
      payload.formId, payload.version_year,
      payload.orgId || 'EVN', payload.period || '', payload.scenario || '',
    );
    let cellMap = this.sessionCache.get(key);
    if (!cellMap) {
      cellMap = new Map<string, number>();
      this.sessionCache.set(key, cellMap);
    }
    for (const cell of payload.data) {
      const val = typeof cell.value === 'number' ? cell.value : (parseFloat(String(cell.value)) || 0);
      // LÆ°u táº¥t cáº£ giÃ¡ trá»‹ ká»ƒ cáº£ 0 (Ä‘á»ƒ override Ä‘Ãºng khi ngÆ°á»i dÃ¹ng xÃ³a Ã´)
      cellMap.set(`${cell.rowCode}:${cell.colCode}`, val);
    }
    console.log(`[PlanningApi] ðŸ’¾ Session cache updated [${key}]: ${cellMap.size} cells`);
  }

  /** Merge session cache vÃ o dbData khi BE tráº£ vá» toÃ n 0 */
  private mergeCacheIntoDbData(
    dbData: GridCellData[],
    formCode: string, year: number,
    entityCode: string, period: string, scenario: string,
  ): GridCellData[] {
    const key = this.makeCacheKey(formCode, year, entityCode, period, scenario);
    const cellMap = this.sessionCache.get(key);
    if (!cellMap || cellMap.size === 0) return dbData;

    const result = dbData.map(cell => {
      const cached = cellMap.get(`${cell.rowCode}:${cell.colCode}`);
      if (cached !== undefined && cached !== cell.value) {
        return { ...cell, value: cached };
      }
      return cell;
    });

    const mergedCount = result.filter((r, i) => r.value !== dbData[i].value).length;
    console.log(`[PlanningApi] ðŸ”„ Session cache merged [${key}]: ${mergedCount} cells restored from cache`);
    return result;
  }

  // ==========================================================
  // V1 â€” Dimension-based format (OLD â€” giá»¯ nguyÃªn)
  // ==========================================================

  /** Táº£i toÃ n bá»™ dá»¯ liá»‡u cáº§n thiáº¿t Ä‘á»ƒ render 1 biá»ƒu máº«u */
  loadForm(templateId: string): Observable<PlanningFormResponse> {
    if (this.useMockV1) {
      return this.mockLoadForm(templateId);
    }
    return this.http.get<PlanningFormResponse>(
      `${this.apiBaseUrl}/forms/${templateId}`,
    );
  }

  /** Táº£i fact data riÃªng (khi Ä‘á»•i POV / ká»‹ch báº£n mÃ  khÃ´ng cáº§n load láº¡i template) */
  loadFactData(
    templateId: string,
    pov: PovSelection,
    nam: number,
    scenarioId?: string,
  ): Observable<FactDataPoint[]> {
    if (this.useMockV1) {
      return this.http
        .get<FactDataPoint[]>(this.mockFactDataUrl(templateId))
        .pipe(delay(200));
    }
    return this.http.post<FactDataPoint[]>(
      `${this.apiBaseUrl}/fact-data`,
      { templateId, pov, nam, scenarioId },
    );
  }

  /** LÆ°u cÃ¡c Ã´ thay Ä‘á»•i vá» BE */
  saveChanges(request: SaveChangesRequest): Observable<SaveResult> {
    if (this.useMockV1) {
      console.log('[MockAPI] Saving', request.changes.length, 'changes (scenario:', request.scenarioId, '):', request);
      return of({
        success: true,
        savedCount: request.changes.length,
        message: `ÄÃ£ lÆ°u ${request.changes.length} thay Ä‘á»•i`,
      }).pipe(delay(600));
    }
    return this.http.post<SaveResult>(`${this.apiBaseUrl}/save`, request);
  }

  /** Danh sÃ¡ch biá»ƒu máº«u cho dropdown */
  getTemplateList(): Observable<TemplateListItem[]> {
    if (this.useMockV1) {
      return of([
        // â”€â”€ Biá»ƒu máº«u trá»ng yáº¿u (tá»« document PM) â”€â”€
        { templateId: 'KHTC_SXKD_03',  templateName: 'KhTC/SXKD/03 â€” Káº¿ hoáº¡ch sáº£n xuáº¥t kinh doanh Ä‘iá»‡n' },
        { templateId: 'TH_SXKD_03',    templateName: 'TH.KhTC/SXKD/03 â€” BÃ¡o cÃ¡o thá»±c hiá»‡n káº¿ hoáº¡ch SXKD' },
        { templateId: 'UTH_SXKD_03',   templateName: 'Æ¯TH.KhTC/SXKD/03 â€” Æ¯á»›c thá»±c hiá»‡n vÃ  dá»± bÃ¡o SXKD' },
        // â”€â”€ Biá»ƒu máº«u cÅ© (giá»¯ Ä‘á»ƒ tÆ°Æ¡ng thÃ­ch) â”€â”€
        { templateId: 'BKH_KH_01',      templateName: 'BKH.KH.01 â€” Káº¿ hoáº¡ch Äiá»‡n sáº£n xuáº¥t vÃ  Mua' },
        { templateId: 'BCTH_SXKD_DIEN', templateName: 'BÃ¡o cÃ¡o thá»±c hiá»‡n KH SXKD Äiá»‡n (cÅ©)' },
        { templateId: 'NEW_TEMPLATE',   templateName: 'Biá»ƒu máº«u má»›i â€” Layout colCode/rowCode' },
      ]).pipe(delay(100));
    }
    return this.http.get<TemplateListItem[]>(`${this.apiBaseUrl}/templates`);
  }

  /**
   * Láº¥y danh sÃ¡ch biá»ƒu máº«u tá»« API tháº­t.
   * GET /api/v2/FormTemplate/get-list
   * BE tráº£ vá»: { Succeeded, Data: [ { id, formCode, formName, ... } ], Message }
   */
  getFormTemplateList(): Observable<FormTemplateListItem[]> {
    const url = `${this.beApiBase}/api/v2/FormTemplate/get-list`;
    console.log('[PlanningApi] ðŸŒ GET FormTemplate list:', url);

    return this.http.get<any>(url).pipe(
      timeout(15000),
      catchError((err: unknown) => {
        const httpErr = err as HttpErrorResponse;
        const errMsg = `KhÃ´ng thá»ƒ táº£i danh sÃ¡ch biá»ƒu máº«u: ${httpErr?.message || httpErr?.statusText || 'Unknown error'}`;
        console.error('[PlanningApi] âŒ FormTemplate list error:', err);
        return throwError(() => new Error(errMsg));
      }),
      map(raw => {
        console.log('[PlanningApi] ðŸ“¥ FormTemplate list raw:', raw);
        // BE tráº£ wrapped: { Succeeded, Data: [...], Message }
        if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
          const response = normalizeApiResponse(raw);
          if (!response.succeeded) {
            throw new Error(response.message || 'Táº£i danh sÃ¡ch biá»ƒu máº«u tháº¥t báº¡i');
          }
          return (response.data as FormTemplateListItem[]) || [];
        }
        // Direct array
        if (Array.isArray(raw)) return raw as FormTemplateListItem[];
        return [];
      }),
    );
  }

  /** Danh sÃ¡ch ká»‹ch báº£n (mock / GET tháº­t khi BE sáºµn sÃ ng) */
  getScenarioList(): Observable<PlanningScenarioItem[]> {
    if (this.useMockV1) {
      return of([
        { scenarioId: 'KH', scenarioName: 'Káº¿ hoáº¡ch' },
        { scenarioId: 'TH', scenarioName: 'Thá»±c hiá»‡n' },
      ]).pipe(delay(80));
    }
    return this.http.get<PlanningScenarioItem[]>(`${this.apiBaseUrl}/scenarios`);
  }

  private mockLoadForm(templateId: string): Observable<PlanningFormResponse> {
    const fileName = templateId.toLowerCase().replace(/_/g, '-');
    return forkJoin({
      template: this.http.get<TemplateJson>(
        `assets/mock-data/${fileName}-template.json`,
      ),
      dimMeta: this.http.get<DimMetadata>(
        'assets/mock-data/dimension-metadata.json',
      ),
      factData: this.http.get<FactDataPoint[]>(this.mockFactDataUrl(templateId)),
    }).pipe(delay(400));
  }

  /** File fact mock theo biá»ƒu máº«u */
  private mockFactDataUrl(templateId: string): string {
    const map: Record<string, string> = {
      'KHTC_SXKD_03':  'assets/mock-data/khtc-sxkd-03-fact-data.json',
      'TH_SXKD_03':    'assets/mock-data/th-sxkd-03-fact-data.json',
      'UTH_SXKD_03':   'assets/mock-data/uth-sxkd-03-fact-data.json',
      'BCTH_SXKD_DIEN':'assets/mock-data/bcth-sxkd-dien-fact-data.json',
    };
    return map[templateId] ?? 'assets/mock-data/planning-fact-data.json';
  }

  // ==========================================================
  // V2 â€” colCode/rowCode-based format (NEW â€” API tháº­t)
  // ==========================================================

  /**
   * Táº£i biá»ƒu máº«u V2 tá»« API tháº­t.
   *
   * GET /api/v2/PlanningData/load-form?formId=...&entityCode=...&year=...
   *
   * BE tráº£ vá»:
   *   { succeeded, message, data: { layoutJSON: "...", mappings: [...] }, ... }
   *
   * FE cáº§n chuyá»ƒn thÃ nh: LoadGridResponse { template, dbData }
   */
  loadFormV2(
    formId: string,
    entityCode: string = 'EVN',
    year: number = new Date().getFullYear(),
    period?: string,
    scenario?: string,
  ): Observable<LoadGridResponse> {
    if (this.useMockV2) {
      return this.http
        .get<LoadGridResponse>('assets/mock-data/new-template-demo.json')
        .pipe(delay(400));
    }

    // â”€â”€ API tháº­t â”€â”€
    // BE API dÃ¹ng param 'formCode' (khÃ´ng pháº£i 'formId')
    let params = new HttpParams()
      .set('formCode', formId)
      .set('year', year.toString());
    if (entityCode) params = params.set('entityCode', entityCode);
    if (period) params = params.set('period', period);
    if (scenario) params = params.set('scenario', scenario);

    const url = `${this.beApiBase}/api/v2/PlanningData/load-form`;
    console.log('[PlanningApi] ðŸŒ GET:', url, 'params:', { formId, entityCode, year, period, scenario });

    return this.http.get<any>(url, { params }).pipe(
      // Timeout 30 giÃ¢y, retry 1 láº§n sau 1 giÃ¢y náº¿u lá»—i máº¡ng
      timeout(30000),
      retry({ count: 1, delay: 1000 }),
      // BE .NET tráº£ vá» PascalCase + cÃ³ thá»ƒ tráº£ 500 kÃ¨m JSON body
      catchError((err: unknown) => {
        // Kiá»ƒm tra timeout error
        if (err instanceof Error && err.name === 'TimeoutError') {
          return throwError(() => new Error('Request timeout sau 30 giÃ¢y'));
        }
        
        // Xá»­ lÃ½ HTTP error
        const httpErr = err as HttpErrorResponse;
        const body = httpErr?.error;
        // Náº¿u BE tráº£ HTTP error vá»›i body bÃ¡o Succeeded = false â†’ throw error rÃµ rÃ ng
        if (body && typeof body === 'object') {
          const succeeded = body.Succeeded ?? body.succeeded;
          if (succeeded === false) {
            const errorMsg = body.Message || body.message || body.Errors?.join(', ') || body.errors?.join(', ') || 'API request failed';
            return throwError(() => new Error(`Lá»—i API: ${errorMsg}`));
          }
          // Náº¿u Succeeded = true nhÆ°ng HTTP error (trÆ°á»ng há»£p láº¡) â†’ xá»­ lÃ½ nhÆ° response
          if (succeeded === true) {
            console.warn('[PlanningApi] âš ï¸ HTTP', httpErr.status, 'â€” xá»­ lÃ½ body:', body);
            return of(body);
          }
        }
        // Lá»—i máº¡ng hoáº·c response khÃ´ng parse Ä‘Æ°á»£c â†’ throw vá»›i message rÃµ
        const errMsg = `Lá»—i káº¿t ná»‘i: ${httpErr?.message || httpErr?.statusText || 'Unknown error'}`;
        return throwError(() => new Error(errMsg));
      }),
      map(raw => {
        console.log('[PlanningApi] ðŸ“¥ load-form raw response:', raw);
        
        // BE cÃ³ thá»ƒ tráº£ vá» 2 format:
        // 1. Wrapped: { Succeeded, Data: {...}, Message, ... }
        // 2. Direct:  { formId, formName, layoutJSON, cells, ... }
        
        let beData: any;
        
        // Kiá»ƒm tra xem response cÃ³ pháº£i format wrapped khÃ´ng
        if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
          // Format wrapped â†’ normalize
          const response = normalizeApiResponse(raw);
          console.log('[PlanningApi] ðŸ“¥ Wrapped response (normalized):', response);
          
          if (!response.succeeded) {
            throw new Error(response.errors?.join(', ') || response.message || 'Load form tháº¥t báº¡i');
          }
          if (!response.data) {
            throw new Error('Response data rá»—ng');
          }
          beData = response.data;
        } else {
          // Format direct â†’ dÃ¹ng trá»±c tiáº¿p
          console.log('[PlanningApi] ðŸ“¥ Direct response format');
          beData = raw;
        }

        return this.transformBeResponseToLoadGrid(beData, formId, year);
      }),
    );
  }

  /**
   * LÆ°u dá»¯ liá»‡u nháº­p liá»‡u V2 lÃªn API tháº­t.
   *
   * POST /api/v2/PlanningData/save-submission
   * Body: { submissionId: 0, entityCode: "EVN", jsonData: "..." }
   */
  saveFormV2(payload: SaveGridPayload): Observable<SaveResult> {
    if (this.useMockV2) {
      console.log(
        '[MockAPI V2] Saving', payload.data.length,
        'cells for form', payload.formId, ':',
        payload,
      );
      return of({
        success: true,
        savedCount: payload.data.length,
        message: `ÄÃ£ lÆ°u ${payload.data.length} Ã´ dá»¯ liá»‡u (V2)`,
      }).pipe(delay(600));
    }

    // â”€â”€ API tháº­t â”€â”€
    // POST /api/v2/PlanningData/save-submission
    // SubmissionRequest: { submissionId: int64, entityCode: string, jsonData: string }
    const url = `${this.beApiBase}/api/v2/PlanningData/save-submission`;
    const body = {
      submissionId: 0, // 0 = táº¡o má»›i submission
      entityCode: payload.orgId || 'EVN',
      jsonData: JSON.stringify({
        formCode: payload.formId,
        year: payload.version_year,
        period: payload.period || '',
        scenario: payload.scenario || 'Káº¿ hoáº¡ch',
        cells: payload.data.map(cell => ({
          rowCode: cell.rowCode,
          colCode: cell.colCode,
          value: typeof cell.value === 'number' ? cell.value : (parseFloat(String(cell.value)) || 0),
          accountCode: '',
          attributeCode: '',
          formula: null,
          isReadOnly: false,
        })),
      }),
    };

    const nonZeroInPayload = payload.data.filter(c => c.value !== 0 && c.value !== null);
    console.log('[PlanningApi] ðŸŒ POST save-submission:', url, {
      submissionId: body.submissionId,
      entityCode: body.entityCode,
      cellCount: payload.data.length,
      nonZeroCells: nonZeroInPayload.length,
      nonZeroSample: nonZeroInPayload.slice(0, 5),
      jsonDataPreview: body.jsonData.substring(0, 300) + '...',
    });

    return this.http.post<any>(url, body).pipe(
      timeout(30000),
      retry({ count: 1, delay: 1000 }),
      catchError((err: unknown) => {
        // Kiá»ƒm tra timeout error
        if (err instanceof Error && err.name === 'TimeoutError') {
          return throwError(() => new Error('Request timeout sau 30 giÃ¢y'));
        }
        
        // Xá»­ lÃ½ HTTP error
        const httpErr = err as HttpErrorResponse;
        const body2 = httpErr?.error;
        if (body2 && typeof body2 === 'object') {
          const succeeded = body2.Succeeded ?? body2.succeeded;
          if (succeeded === false) {
            const errorMsg = body2.Message || body2.message || body2.Errors?.join(', ') || body2.errors?.join(', ') || 'LÆ°u tháº¥t báº¡i';
            return throwError(() => new Error(`Lá»—i API: ${errorMsg}`));
          }
          if (succeeded === true) {
            return of(body2);
          }
        }
        const errMsg = `Lá»—i káº¿t ná»‘i: ${httpErr?.message || httpErr?.statusText || 'Unknown error'}`;
        return throwError(() => new Error(errMsg));
      }),
      map(raw => {
        // BE cÃ³ thá»ƒ tráº£ 2 format: wrapped hoáº·c direct
        let succeeded: boolean;
        let message: string;
        
        if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
          const response = normalizeApiResponse(raw);
          console.log('[PlanningApi] ðŸ“¤ save-submission response (normalized):', response);
          succeeded = response.succeeded;
          message = response.message || '';
        } else {
          // Direct response (e.g. { "message": "LÆ°u báº£n nhÃ¡p thÃ nh cÃ´ng" })
          console.log('[PlanningApi] ðŸ“¤ save-submission direct response:', raw);
          succeeded = true;
          message = raw?.Message || raw?.message || '';
        }

        if (succeeded) {
          return {
            success: true,
            savedCount: payload.data.length,
            message: message || `ÄÃ£ lÆ°u ${payload.data.length} Ã´ dá»¯ liá»‡u thÃ nh cÃ´ng`,
          };
        } else {
          return {
            success: false,
            message: message || 'LÆ°u tháº¥t báº¡i',
          };
        }
      }),
    );
  }

  // ==========================================================
  // V2 â€” Response transformer
  // ==========================================================

  /**
   * Chuyá»ƒn Ä‘á»•i BE response â†’ FE LoadGridResponse.
   *
   * BE tráº£ vá» format:
   *   {
   *     formId, formCode, formName,
   *     layoutJSON: "{...}"  // â† JSON string chá»©a Ä‘áº§y Ä‘á»§ layout
   *     cells: [{ rowCode, colCode, value, isReadOnly }, ...]
   *   }
   *
   * Æ¯u tiÃªn parse layoutJSON tá»« BE. Fallback sang inferLayoutFromCells náº¿u lá»—i.
   */
  private transformBeResponseToLoadGrid(
    beData: any,
    formId: string,
    year: number,
  ): LoadGridResponse {
    // â”€â”€ 1. Láº¥y cells tá»« BE â”€â”€
    const cells: BeCellData[] = beData?.cells || [];
    if (!Array.isArray(cells) || cells.length === 0) {
      throw new Error('Response khÃ´ng chá»©a cells hoáº·c cells rá»—ng');
    }

    console.log('[PlanningApi] ðŸ“¥ BE cells count:', cells.length);

    // â”€â”€ 2. Parse layoutJSON tá»« BE (Æ°u tiÃªn) hoáº·c fallback sang infer â”€â”€
    let layoutJSON: LayoutJSON;
    const beLayoutJSON = beData?.layoutJSON;

    if (beLayoutJSON && typeof beLayoutJSON === 'string') {
      // BE tráº£ layoutJSON dáº¡ng string â†’ parse trá»±c tiáº¿p
      try {
        const parsed = JSON.parse(beLayoutJSON);
        // Validate cáº¥u trÃºc cÆ¡ báº£n: pháº£i cÃ³ columns array chá»©a objects (khÃ´ng pháº£i nested arrays rá»—ng)
        if (parsed.columns && Array.isArray(parsed.columns) &&
            parsed.columns.length > 0 && typeof parsed.columns[0] === 'object' &&
            parsed.columns[0].colCode) {
          layoutJSON = parsed as LayoutJSON;
          console.log('[PlanningApi] âœ… Parsed layoutJSON from BE string:', {
            columns: layoutJSON.columns?.length,
            rows: layoutJSON.rows?.length,
            headerRows: layoutJSON.headerRows?.length,
            mergeCells: (layoutJSON.mergeCells as any)?.length,
            fixedRowsTop: layoutJSON.fixedRowsTop,
            freezeColumns: layoutJSON.freezeColumns,
          });
        } else {
          console.warn('[PlanningApi] âš ï¸ layoutJSON string parsed but structure invalid, falling back to infer');
          layoutJSON = this.inferLayoutFromCells(cells);
        }
      } catch (e) {
        console.warn('[PlanningApi] âš ï¸ layoutJSON string parse failed:', e);
        layoutJSON = this.inferLayoutFromCells(cells);
      }
    } else if (beLayoutJSON && typeof beLayoutJSON === 'object' &&
               beLayoutJSON.columns && Array.isArray(beLayoutJSON.columns) &&
               beLayoutJSON.columns.length > 0 && typeof beLayoutJSON.columns[0] === 'object' &&
               beLayoutJSON.columns[0].colCode) {
      // BE tráº£ layoutJSON dáº¡ng object Ä‘Ã£ parse sáºµn (Ä‘Ãºng cáº¥u trÃºc)
      layoutJSON = beLayoutJSON as LayoutJSON;
      console.log('[PlanningApi] âœ… Using layoutJSON object from BE directly');
    } else {
      // Fallback: infer tá»« cells
      console.warn('[PlanningApi] âš ï¸ layoutJSON from BE unusable, falling back to inferLayoutFromCells');
      layoutJSON = this.inferLayoutFromCells(cells);
    }

    // â”€â”€ 3. Chuyá»ƒn cells â†’ dbData â”€â”€
    const dbData: GridCellData[] = cells
      .filter((c) => c.rowCode && c.colCode && c.value !== undefined && c.value !== null)
      .map((c) => ({
        rowCode: c.rowCode,
        colCode: c.colCode,
        value: c.value,
      }));

    // â”€â”€ DIAGNOSTIC: Kiá»ƒm tra xem BE cÃ³ tráº£ vá» data khÃ¡c 0 khÃ´ng â”€â”€
    const nonZeroCells = dbData.filter(c => c.value !== 0 && c.value !== null && c.value !== '');
    const labelColCodes = new Set(['STT','CHITIEU_NAME','NOI_DUNG','UNIT','DVT','MA_CHITIEU','TEN_CHITIEU','DON_VI','METADATA_ROW']);
    const editableCells = dbData.filter(c => !labelColCodes.has(c.colCode?.toUpperCase()));
    console.warn('[PlanningApi] ðŸ” Load-form data diagnostic:', {
      totalCells: dbData.length,
      editableCells: editableCells.length,
      nonZeroValues: nonZeroCells.length,
      nonZeroSample: nonZeroCells.slice(0, 5),
      allZero: editableCells.length > 0 && nonZeroCells.length === 0,
      note: editableCells.length > 0 && nonZeroCells.length === 0
        ? 'âš ï¸ BE tráº£ vá» táº¥t cáº£ cells = 0. Dá»¯ liá»‡u Ä‘Ã£ lÆ°u cÃ³ thá»ƒ khÃ´ng Ä‘Æ°á»£c Ä‘á»c tá»« save-submission!'
        : 'âœ… BE cÃ³ tráº£ vá» giÃ¡ trá»‹ â‰  0',
    });

    // â”€â”€ 4. Láº¥y formName â”€â”€
    const formName = beData?.formName || beData?.formConfig?.formName || formId;

    // â”€â”€ 5. Assemble â”€â”€
    const template: LayoutTemplate = {
      formId: beData?.formCode || beData?.formId || formId,
      formName,
      version: {
        year,
        layoutJSON,
      },
    };

    console.log('[PlanningApi] âœ… Transformed:', {
      formId: template.formId,
      formName,
      columns: layoutJSON.columns?.length,
      rows: layoutJSON.rows?.length,
      headerRows: layoutJSON.headerRows?.length,
      dbDataCells: dbData.length,
    });

    return { template, dbData };
  }

  /**
   * Infer layoutJSON tá»« BE cells array.
   * VÃ¬ BE khÃ´ng tráº£ Ä‘Ãºng cáº¥u trÃºc layoutJSON, ta pháº£i tá»± build tá»« cells.
   */
  private inferLayoutFromCells(cells: BeCellData[]): LayoutJSON {
    // â”€â”€ 1. Thu tháº­p unique colCodes vÃ  rowCodes theo thá»© tá»± xuáº¥t hiá»‡n â”€â”€
    const colCodeSet = new Map<string, BeCellData>();
    const rowCodeSet = new Map<string, BeCellData>();

    for (const cell of cells) {
      if (cell.colCode && !colCodeSet.has(cell.colCode)) {
        colCodeSet.set(cell.colCode, cell);
      }
      if (cell.rowCode && !rowCodeSet.has(cell.rowCode)) {
        rowCodeSet.set(cell.rowCode, cell);
      }
    }

    // â”€â”€ 2. Build columns â”€â”€
    const columns: LayoutColumnDef[] = [];
    let colIndex = 0;
    for (const [colCode, sampleCell] of colCodeSet) {
      const colKey = this.indexToColLetter(colIndex);
      const isReadOnlyCol = this.isLabelColumn(colCode);
      
      columns.push({
        key: colKey,
        colCode: colCode,
        title: this.colCodeToTitle(colCode),
        width: this.getColumnWidth(colCode),
        type: isReadOnlyCol ? 'text' : 'numeric',
        readOnly: isReadOnlyCol,
      });
      colIndex++;
    }

    // â”€â”€ 3. Build rows â”€â”€
    const rows: LayoutRowDef[] = [];
    let rowIndex = 0;
    for (const [rowCode, sampleCell] of rowCodeSet) {
      // TÃ¬m cell chá»©a tÃªn chá»‰ tiÃªu (colCode = CHITIEU_NAME)
      const nameCell = cells.find(c => c.rowCode === rowCode && c.colCode === 'CHITIEU_NAME');
      const isRowReadOnly = cells.some(c => c.rowCode === rowCode && c.isReadOnly === true);

      rows.push({
        rowKey: `R${rowIndex}`,
        rowCode: rowCode,
        title: this.rowCodeToTitle(rowCode),
        level: this.inferRowLevel(rowCode),
        isReadOnly: isRowReadOnly,
      });
      rowIndex++;
    }

    // â”€â”€ 4. Build header rows â”€â”€
    const headerRows: LayoutHeaderRow[] = [
      {
        cells: columns.map((col) => ({
          label: col.title,
          colKey: col.key,
          colspan: 1,
          rowspan: 1,
        })),
      },
    ];

    // â”€â”€ 5. TÃ­nh freeze columns (cÃ¡c cá»™t label bÃªn trÃ¡i) â”€â”€
    let freezeColumns = 0;
    for (const col of columns) {
      if (this.isLabelColumn(col.colCode)) {
        freezeColumns++;
      } else {
        break; // Dá»«ng khi gáº·p cá»™t data Ä‘áº§u tiÃªn
      }
    }

    // â”€â”€ 6. Build mappings tá»« cells â”€â”€
    const mappings: LayoutCellMapping[] = cells.map((cell) => {
      const colDef = columns.find(c => c.colCode === cell.colCode);
      const rowDef = rows.find(r => r.rowCode === cell.rowCode);
      return {
        rowKey: rowDef?.rowKey || '',
        colKey: colDef?.key || '',
        rowCode: cell.rowCode,
        colCode: cell.colCode,
        cellRole: cell.formula ? 'formula' : (cell.isReadOnly ? 'header' : 'data'),
        formula: cell.formula || undefined,
        isReadOnly: cell.isReadOnly ?? false,
      };
    });

    return {
      columns,
      headerRows,
      rows,
      mergeCells: [], // BE khÃ´ng tráº£ merge info
      fixedRowsTop: 1, // 1 dÃ²ng header
      freezeColumns,
      mappings,
    };
  }

  // â”€â”€â”€ Helper functions â”€â”€â”€

  /** Chuyá»ƒn index â†’ kÃ½ tá»± cá»™t Excel: 0=A, 1=B, ..., 25=Z, 26=AA */
  private indexToColLetter(index: number): string {
    let result = '';
    let i = index;
    while (i >= 0) {
      result = String.fromCharCode((i % 26) + 65) + result;
      i = Math.floor(i / 26) - 1;
    }
    return result;
  }

  /** Kiá»ƒm tra colCode cÃ³ pháº£i cá»™t label (khÃ´ng nháº­p liá»‡u) */
  private isLabelColumn(colCode: string): boolean {
    const labelCols = ['STT', 'CHITIEU_NAME', 'UNIT', 'MA_CHITIEU', 'TEN_CHITIEU', 'DON_VI'];
    return labelCols.includes(colCode.toUpperCase());
  }

  /** Chuyá»ƒn colCode â†’ tiÃªu Ä‘á» hiá»ƒn thá»‹ */
  private colCodeToTitle(colCode: string): string {
    const titleMap: Record<string, string> = {
      'STT': 'STT',
      'CHITIEU_NAME': 'Chá»‰ tiÃªu',
      'UNIT': 'ÄVT',
      'MA_CHITIEU': 'MÃ£',
      'TEN_CHITIEU': 'TÃªn chá»‰ tiÃªu',
      'DON_VI': 'ÄÆ¡n vá»‹',
      'CHI_PHI': 'Chi phÃ­',
      'GIA_BQ': 'GiÃ¡ BQ',
      'ACTUAL_N2': 'TH N-2',
      'ACTUAL_N1': 'TH N-1',
      'ESTIMATE_N1': 'Æ¯TH N-1',
      'PLAN_N': 'KH N',
      'PLAN_N1': 'KH N+1',
      'PLAN_N2': 'KH N+2',
      // ThÃ¡ng
      'SL_T1': 'ThÃ¡ng 1',
      'SL_T2': 'ThÃ¡ng 2',
      'SL_T3': 'ThÃ¡ng 3',
      'SL_T4': 'ThÃ¡ng 4',
      'SL_T5': 'ThÃ¡ng 5',
      'SL_T6': 'ThÃ¡ng 6',
      'SL_T7': 'ThÃ¡ng 7',
      'SL_T8': 'ThÃ¡ng 8',
      'SL_T9': 'ThÃ¡ng 9',
      'SL_T10': 'ThÃ¡ng 10',
      'SL_T11': 'ThÃ¡ng 11',
      'SL_T12': 'ThÃ¡ng 12',
      // QuÃ½
      'SL_Q1': 'QuÃ½ 1',
      'SL_Q2': 'QuÃ½ 2',
      'SL_Q3': 'QuÃ½ 3',
      'SL_Q4': 'QuÃ½ 4',
      // NÄƒm
      'SL_NAM': 'Cáº£ nÄƒm',
      'TONG': 'Tá»•ng cá»™ng',
    };
    const upper = colCode.toUpperCase();
    if (titleMap[upper]) return titleMap[upper];
    
    // Fallback: parse patterns like T1, T2, Q1, etc.
    const monthMatch = colCode.match(/T(\d+)$/i);
    if (monthMatch) return `ThÃ¡ng ${monthMatch[1]}`;
    
    const quarterMatch = colCode.match(/Q(\d+)$/i);
    if (quarterMatch) return `QuÃ½ ${quarterMatch[1]}`;
    
    return colCode;
  }

  /** TÃ­nh Ä‘á»™ rá»™ng cá»™t dá»±a trÃªn colCode */
  private getColumnWidth(colCode: string): number {
    const widthMap: Record<string, number> = {
      'STT': 50,
      'CHITIEU_NAME': 250,
      'TEN_CHITIEU': 250,
      'UNIT': 80,
      'DON_VI': 80,
      'MA_CHITIEU': 80,
    };
    return widthMap[colCode.toUpperCase()] || 120;
  }

  /** Chuyá»ƒn rowCode â†’ tiÃªu Ä‘á» (dÃ¹ng táº¡m, sau nÃ y láº¥y tá»« dimension) */
  private rowCodeToTitle(rowCode: string): string {
    // CÃ³ thá»ƒ má»Ÿ rá»™ng mapping náº¿u cáº§n
    const titleMap: Record<string, string> = {
      'SL_GIA_THANH': 'Sáº£n lÆ°á»£ng giÃ¡ thÃ nh',
      'CP_THEO_YT': 'Chi phÃ­ theo yáº¿u tá»‘',
      'CP_NHIEN_LIEU': 'Chi phÃ­ nhiÃªn liá»‡u',
      'CP_VAT_LIEU': 'Chi phÃ­ váº­t liá»‡u',
      'CP_VL_SX_DIEN': 'CP váº­t liá»‡u SX Ä‘iá»‡n',
      'CP_VL_PP_DIEN': 'CP váº­t liá»‡u PP Ä‘iá»‡n',
    };
    return titleMap[rowCode] || rowCode.replace(/_/g, ' ');
  }

  /** Infer level (indent) tá»« rowCode */
  private inferRowLevel(rowCode: string): number {
    // CÃ³ thá»ƒ customize logic nÃ y
    if (rowCode.startsWith('TONG') || rowCode.startsWith('SL_')) return 0;
    if (rowCode.includes('_CON_') || rowCode.includes('_VL_')) return 2;
    return 1;
  }
}

/** Interface cho cell data tá»« BE */
interface BeCellData {
  rowCode: string;
  colCode: string;
  value: number | string | null;
  accountCode?: string;
  attributeCode?: string;
  formula?: string | null;
  isReadOnly?: boolean;
}

