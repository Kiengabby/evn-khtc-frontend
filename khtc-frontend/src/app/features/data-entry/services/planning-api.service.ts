import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { catchError, delay, map, timeout, retry } from 'rxjs/operators';
import {
  TemplateJson, DimMetadata, PovSelection, FactDataPoint,
} from '../../../apps/service/template-parser.service';
import {
  LoadGridResponse, SaveGridPayload, LayoutJSON, LayoutTemplate, GridCellData,
  LayoutColumnDef, LayoutRowDef, LayoutHeaderRow, LayoutCellMapping,
} from '../../../config/models/layout-template.model';
import {
  FormConfigApiResponse,
  normalizeApiResponse,
} from '../../../config/models/form-config-api.model';
import { ConfigService } from '../../../core/app-config.service';

export interface PlanningFormResponse {
  template: TemplateJson;
  dimMeta: DimMetadata;
  factData: FactDataPoint[];
}

export interface TemplateListItem {
  templateId: string;
  templateName: string;
  /** UUID của form (dùng khi load form từ BE thật) — optional vì dùng mock khi V1 */
  templateUUID?: string;
}

/** Item trả về từ GET /api/v2/FormTemplate/get-list */
export interface FormTemplateListItem {
  id: number;
  formCode: string;
  formName: string;
  description?: string;
  isActive?: boolean;
}



/** Kịch bản nhập liệu (VD: Kế hoạch / Thực hiện — mã SCE) — gửi kèm khi lưu / tải dữ liệu */
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
  /** Mã kịch bản SCE (VD: KH = Kế hoạch, TH = Thực hiện) */
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
   *  V1 (dimension-based) — vẫn dùng mock (useMockV1)
   *  V2 (colCode/rowCode) — dùng API thật (useMockV2 = false)
   * ================================================================
   */
  private readonly useMockV1 = true;
  private readonly useMockV2 = false;  // ← API thật cho V2!
  private readonly apiBaseUrl = '/api/planning';

  /** Base URL cho API thật */
  private get beApiBase(): string {
    return this.configService.apiBaseUrl;
  }

  // ================================================================
  // SESSION DATA CACHE
  // Workaround: BE lưu bản nháp nhưng load-form trả về toàn 0.
  // FE cache giá trị đã lưu trong phiên, merge vào khi load lại.
  // ================================================================

  /** Map<cacheKey, Map<rowCode:colCode, value>> */
  private readonly sessionCache = new Map<string, Map<string, number>>();

  // ================================================================
  // FORM UUID CACHE
  // BE trả về formId (UUID) và formVersionId (UUID) trong load-form response.
  // Lưu lại để dùng khi gọi save-submission (yêu cầu Guid, không phải formCode).
  // ================================================================
  private readonly EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
  /** Map<formCode, formId UUID> — lưu UUID từ load-form response */
  private formUuidCache = new Map<string, string>();
  /** Map<formCode, formVersionId UUID> */
  private formVersionUuidCache = new Map<string, string>();

  /** Tạo cache key từ các tham số POV */
  private makeCacheKey(
    formCode: string, year: number,
    entityCode: string, period: string, scenario: string,
  ): string {
    return `${formCode}|${year}|${entityCode}|${period}|${scenario}`;
  }

  /** Lưu cells vào session cache (chỉ lưu non-zero để tiết kiệm bộ nhớ) */
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
      // Lưu tất cả giá trị kể cả 0 (để override đúng khi người dùng xóa ô)
      cellMap.set(`${cell.rowCode}:${cell.colCode}`, val);
    }
    console.log(`[PlanningApi] 💾 Session cache updated [${key}]: ${cellMap.size} cells`);
  }

  /** Merge session cache vào dbData khi BE trả về toàn 0 */
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
    console.log(`[PlanningApi] 🔄 Session cache merged [${key}]: ${mergedCount} cells restored from cache`);
    return result;
  }

  // ==========================================================
  // V1 — Dimension-based format (OLD — giữ nguyên)
  // ==========================================================

  /** Tải toàn bộ dữ liệu cần thiết để render 1 biểu mẫu */
  loadForm(templateId: string): Observable<PlanningFormResponse> {
    if (this.useMockV1) {
      return this.mockLoadForm(templateId);
    }
    return this.http.get<PlanningFormResponse>(
      `${this.apiBaseUrl}/forms/${templateId}`,
    );
  }

  /** Tải fact data riêng (khi đổi POV / kịch bản mà không cần load lại template) */
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

  /** Lưu các ô thay đổi về BE */
  saveChanges(request: SaveChangesRequest): Observable<SaveResult> {
    if (this.useMockV1) {
      console.log('[MockAPI] Saving', request.changes.length, 'changes (scenario:', request.scenarioId, '):', request);
      return of({
        success: true,
        savedCount: request.changes.length,
        message: `Đã lưu ${request.changes.length} thay đổi`,
      }).pipe(delay(600));
    }
    return this.http.post<SaveResult>(`${this.apiBaseUrl}/save`, request);
  }

  /** Danh sách biểu mẫu cho dropdown */
  getTemplateList(): Observable<TemplateListItem[]> {
    if (this.useMockV1) {
      return of([
        // ── Biểu mẫu trọng yếu (từ document PM) ──
        { templateId: 'KHTC_SXKD_03',  templateName: 'KhTC/SXKD/03 — Kế hoạch sản xuất kinh doanh điện' },
        { templateId: 'TH_SXKD_03',    templateName: 'TH.KhTC/SXKD/03 — Báo cáo thực hiện kế hoạch SXKD' },
        { templateId: 'UTH_SXKD_03',   templateName: 'ƯTH.KhTC/SXKD/03 — Ước thực hiện và dự báo SXKD' },
        // ── Biểu mẫu cũ (giữ để tương thích) ──
        { templateId: 'BKH_KH_01',      templateName: 'BKH.KH.01 — Kế hoạch Điện sản xuất và Mua' },
        { templateId: 'BCTH_SXKD_DIEN', templateName: 'Báo cáo thực hiện KH SXKD Điện (cũ)' },
        { templateId: 'NEW_TEMPLATE',   templateName: 'Biểu mẫu mới — Layout colCode/rowCode' },
      ]).pipe(delay(100));
    }
    return this.http.get<TemplateListItem[]>(`${this.apiBaseUrl}/templates`);
  }

  /**
   * Lấy danh sách biểu mẫu từ API thật.
   * GET /api/v2/FormTemplate/get-list
   * BE trả về: { Succeeded, Data: [ { id, formCode, formName, ... } ], Message }
   */
  getFormTemplateList(): Observable<FormTemplateListItem[]> {
    const url = `${this.beApiBase}/api/v2/FormTemplate/get-list`;
    console.log('[PlanningApi] 🌐 GET FormTemplate list:', url);

    return this.http.get<any>(url).pipe(
      timeout(15000),
      catchError((err: unknown) => {
        const httpErr = err as HttpErrorResponse;
        const errMsg = `Không thể tải danh sách biểu mẫu: ${httpErr?.message || httpErr?.statusText || 'Unknown error'}`;
        console.error('[PlanningApi] ❌ FormTemplate list error:', err);
        return throwError(() => new Error(errMsg));
      }),
      map(raw => {
        console.log('[PlanningApi] 📥 FormTemplate list raw:', raw);
        // BE trả wrapped: { Succeeded, Data: [...], Message }
        if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
          const response = normalizeApiResponse(raw);
          if (!response.succeeded) {
            throw new Error(response.message || 'Tải danh sách biểu mẫu thất bại');
          }
          return (response.data as FormTemplateListItem[]) || [];
        }
        // Direct array
        if (Array.isArray(raw)) return raw as FormTemplateListItem[];
        return [];
      }),
    );
  }

  /** Danh sách kịch bản (mock / GET thật khi BE sẵn sàng) */
  getScenarioList(): Observable<PlanningScenarioItem[]> {
    if (this.useMockV1) {
      return of([
        { scenarioId: 'KH', scenarioName: 'Kế hoạch' },
        { scenarioId: 'TH', scenarioName: 'Thực hiện' },
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

  /** File fact mock theo biểu mẫu */
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
  // V2 — colCode/rowCode-based format (NEW — API thật)
  // ==========================================================

  /**
   * Tải biểu mẫu V2 từ API thật.
   *
   * GET /api/v2/PlanningData/load-form?formId=...&entityCode=...&year=...
   *
   * BE trả về:
   *   { succeeded, message, data: { layoutJSON: "...", mappings: [...] }, ... }
   *
   * FE cần chuyển thành: LoadGridResponse { template, dbData }
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

    // ── API thật ──
    // BE API dùng param 'formCode' (không phải 'formId')
    let params = new HttpParams()
      .set('formCode', formId)
      .set('year', year.toString());
    if (entityCode) params = params.set('entityCode', entityCode);
    if (period) params = params.set('period', period);
    if (scenario) params = params.set('scenario', scenario);

    const url = `${this.beApiBase}/api/v2/PlanningData/load-form`;
    console.log('[PlanningApi] 🌐 GET:', url, 'params:', { formId, entityCode, year, period, scenario });

    return this.http.get<any>(url, { params }).pipe(
      // Timeout 30 giây, retry 1 lần sau 1 giây nếu lỗi mạng
      timeout(30000),
      retry({ count: 1, delay: 1000 }),
      // BE .NET trả về PascalCase + có thể trả 500 kèm JSON body
      catchError((err: unknown) => {
        // Kiểm tra timeout error
        if (err instanceof Error && err.name === 'TimeoutError') {
          return throwError(() => new Error('Request timeout sau 30 giây'));
        }
        
        // Xử lý HTTP error
        const httpErr = err as HttpErrorResponse;
        const body = httpErr?.error;
        // Nếu BE trả HTTP error với body báo Succeeded = false → throw error rõ ràng
        if (body && typeof body === 'object') {
          const succeeded = body.Succeeded ?? body.succeeded;
          if (succeeded === false) {
            const errorMsg = body.Message || body.message || body.Errors?.join(', ') || body.errors?.join(', ') || 'API request failed';
            return throwError(() => new Error(`Lỗi API: ${errorMsg}`));
          }
          // Nếu Succeeded = true nhưng HTTP error (trường hợp lạ) → xử lý như response
          if (succeeded === true) {
            console.warn('[PlanningApi] ⚠️ HTTP', httpErr.status, '— xử lý body:', body);
            return of(body);
          }
        }
        // Lỗi mạng hoặc response không parse được → throw với message rõ
        const errMsg = `Lỗi kết nối: ${httpErr?.message || httpErr?.statusText || 'Unknown error'}`;
        return throwError(() => new Error(errMsg));
      }),
      map(raw => {
        console.log('[PlanningApi] 📥 load-form raw response:', raw);
        
        // BE có thể trả về 2 format:
        // 1. Wrapped: { Succeeded, Data: {...}, Message, ... }
        // 2. Direct:  { formId, formName, layoutJSON, cells, ... }
        
        let beData: any;
        
        // Kiểm tra xem response có phải format wrapped không
        if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
          // Format wrapped → normalize
          const response = normalizeApiResponse(raw);
          console.log('[PlanningApi] 📥 Wrapped response (normalized):', response);
          
          if (!response.succeeded) {
            throw new Error(response.errors?.join(', ') || response.message || 'Load form thất bại');
          }
          if (!response.data) {
            throw new Error('Response data rỗng');
          }
          beData = response.data;
        } else {
          // Format direct → dùng trực tiếp
          console.log('[PlanningApi] 📥 Direct response format');
          beData = raw;
        }

        return this.transformBeResponseToLoadGrid(beData, formId, year);
      }),
    );
  }

  /**
   * Lưu dữ liệu nhập liệu V2 lên API thật.
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
        message: `Đã lưu ${payload.data.length} ô dữ liệu (V2)`,
      }).pipe(delay(600));
    }

    // ── API thật ──
    // POST /api/v2/PlanningData/save-submission
    // formId & formVersionId phải là UUID (Guid), lấy từ cache load-form
    const formUuid = this.formUuidCache.get(payload.formId) || this.EMPTY_GUID;
    const formVersionUuid = this.formVersionUuidCache.get(payload.formId) || formUuid;

    const url = `${this.beApiBase}/api/v2/PlanningData/save-submission`;
    const body = {
      entityCode: payload.orgId || 'EVN',
      formId: formUuid,
      formVersionId: formVersionUuid,
      year: payload.version_year,
      period: payload.period || '',
      scenarioCode: payload.scenario || 'Kế hoạch',
      jsonData: '{}',
      items: payload.data.map(cell => ({
        accountCode: cell.rowCode,
        attributeCode: cell.colCode,
        scenarioCode: payload.scenario || 'Kế hoạch',
        value: typeof cell.value === 'number' ? cell.value : (parseFloat(String(cell.value)) || 0)
      })),
    };

    const nonZeroInPayload = payload.data.filter(c => c.value !== 0 && c.value !== null);
    console.log('[PlanningApi] 🌐 POST save-submission:', url, {
      formId: body.formId,
      entityCode: body.entityCode,
      cellCount: payload.data.length,
      nonZeroCells: nonZeroInPayload.length,
      nonZeroSample: nonZeroInPayload.slice(0, 5)
    });

    return this.http.post<any>(url, body).pipe(
      timeout(30000),
      retry({ count: 1, delay: 1000 }),
      catchError((err: unknown) => {
        // Kiểm tra timeout error
        if (err instanceof Error && err.name === 'TimeoutError') {
          return throwError(() => new Error('Request timeout sau 30 giây'));
        }
        
        // Xử lý HTTP error
        const httpErr = err as HttpErrorResponse;
        const body2 = httpErr?.error;
        if (body2 && typeof body2 === 'object') {
          const succeeded = body2.Succeeded ?? body2.succeeded;
          if (succeeded === false) {
            const errorMsg = body2.Message || body2.message || body2.Errors?.join(', ') || body2.errors?.join(', ') || 'Lưu thất bại';
            return throwError(() => new Error(`Lỗi API: ${errorMsg}`));
          }
          if (succeeded === true) {
            return of(body2);
          }
        }
        const errMsg = `Lỗi kết nối: ${httpErr?.message || httpErr?.statusText || 'Unknown error'}`;
        return throwError(() => new Error(errMsg));
      }),
      map(raw => {
        // BE có thể trả 2 format: wrapped hoặc direct
        let succeeded: boolean;
        let message: string;
        
        if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
          const response = normalizeApiResponse(raw);
          console.log('[PlanningApi] 📤 save-submission response (normalized):', response);
          succeeded = response.succeeded;
          message = response.message || '';
        } else {
          // Direct response (e.g. { "message": "Lưu bản nháp thành công" })
          console.log('[PlanningApi] 📤 save-submission direct response:', raw);
          succeeded = true;
          message = raw?.Message || raw?.message || '';
        }

        if (succeeded) {
          return {
            success: true,
            savedCount: payload.data.length,
            message: message || `Đã lưu ${payload.data.length} ô dữ liệu thành công`,
          };
        } else {
          return {
            success: false,
            message: message || 'Lưu thất bại',
          };
        }
      }),
    );
  }



  // ==========================================================
  // V2 — Response transformer
  // ==========================================================

  /**
   * Chuyển đổi BE response → FE LoadGridResponse.
   *
   * BE trả về format:
   *   {
   *     formId, formCode, formName,
   *     layoutJSON: "{...}"  // ← JSON string chứa đầy đủ layout
   *     cells: [{ rowCode, colCode, value, isReadOnly }, ...]
   *   }
   *
   * Ưu tiên parse layoutJSON từ BE. Fallback sang inferLayoutFromCells nếu lỗi.
   */
  private transformBeResponseToLoadGrid(
    beData: any,
    formId: string,
    year: number,
  ): LoadGridResponse {
    // ── 1. Lấy cells từ BE ──
    const cells: BeCellData[] = beData?.cells || [];
    if (!Array.isArray(cells) || cells.length === 0) {
      throw new Error('Response không chứa cells hoặc cells rỗng');
    }

    console.log('[PlanningApi] 📥 BE cells count:', cells.length);

    // ── 2. Parse layoutJSON từ BE (ưu tiên) hoặc fallback sang infer ──
    let layoutJSON: LayoutJSON;
    const beLayoutJSON = beData?.layoutJSON;

    if (beLayoutJSON && typeof beLayoutJSON === 'string') {
      // BE trả layoutJSON dạng string → parse trực tiếp
      try {
        const parsed = JSON.parse(beLayoutJSON);
        // Validate cấu trúc cơ bản: phải có columns array chứa objects (không phải nested arrays rỗng)
        if (parsed.columns && Array.isArray(parsed.columns) &&
            parsed.columns.length > 0 && typeof parsed.columns[0] === 'object' &&
            parsed.columns[0].colCode) {
          layoutJSON = parsed as LayoutJSON;
          console.log('[PlanningApi] ✅ Parsed layoutJSON from BE string:', {
            columns: layoutJSON.columns?.length,
            rows: layoutJSON.rows?.length,
            headerRows: layoutJSON.headerRows?.length,
            mergeCells: (layoutJSON.mergeCells as any)?.length,
            fixedRowsTop: layoutJSON.fixedRowsTop,
            freezeColumns: layoutJSON.freezeColumns,
          });
        } else {
          console.warn('[PlanningApi] ⚠️ layoutJSON string parsed but structure invalid, falling back to infer');
          layoutJSON = this.inferLayoutFromCells(cells);
        }
      } catch (e) {
        console.warn('[PlanningApi] ⚠️ layoutJSON string parse failed:', e);
        layoutJSON = this.inferLayoutFromCells(cells);
      }
    } else if (beLayoutJSON && typeof beLayoutJSON === 'object' &&
               beLayoutJSON.columns && Array.isArray(beLayoutJSON.columns) &&
               beLayoutJSON.columns.length > 0 && typeof beLayoutJSON.columns[0] === 'object' &&
               beLayoutJSON.columns[0].colCode) {
      // BE trả layoutJSON dạng object đã parse sẵn (đúng cấu trúc)
      layoutJSON = beLayoutJSON as LayoutJSON;
      console.log('[PlanningApi] ✅ Using layoutJSON object from BE directly');
    } else {
      // Fallback: infer từ cells
      console.warn('[PlanningApi] ⚠️ layoutJSON from BE unusable, falling back to inferLayoutFromCells');
      layoutJSON = this.inferLayoutFromCells(cells);
    }

    // ── 3. Chuyển cells → dbData ──
    const dbData: GridCellData[] = cells
      .filter((c) => c.rowCode && c.colCode && c.value !== undefined && c.value !== null)
      .map((c) => ({
        rowCode: c.rowCode,
        colCode: c.colCode,
        value: c.value,
      }));

    // ── DIAGNOSTIC: Kiểm tra xem BE có trả về data khác 0 không ──
    const nonZeroCells = dbData.filter(c => c.value !== 0 && c.value !== null && c.value !== '');
    const labelColCodes = new Set(['STT','CHITIEU_NAME','NOI_DUNG','UNIT','DVT','MA_CHITIEU','TEN_CHITIEU','DON_VI','METADATA_ROW']);
    const editableCells = dbData.filter(c => !labelColCodes.has(c.colCode?.toUpperCase()));
    console.warn('[PlanningApi] 🔍 Load-form data diagnostic:', {
      totalCells: dbData.length,
      editableCells: editableCells.length,
      nonZeroValues: nonZeroCells.length,
      nonZeroSample: nonZeroCells.slice(0, 5),
      allZero: editableCells.length > 0 && nonZeroCells.length === 0,
      note: editableCells.length > 0 && nonZeroCells.length === 0
        ? '⚠️ BE trả về tất cả cells = 0. Dữ liệu đã lưu có thể không được đọc từ save-submission!'
        : '✅ BE có trả về giá trị ≠ 0',
    });

    // ── 4. Lấy formName ──
    const formName = beData?.formName || beData?.formConfig?.formName || formId;

    // ── 5. Cache UUID từ BE response ──
    // beData.formId có thể là UUID (Guid) từ BE
    const beFormId = beData?.formId || '';
    const beFormVersionId = beData?.formVersionId || beData?.versionId || '';
    const formCode = beData?.formCode || formId;

    // Lưu UUID nếu đúng dạng GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (beFormId && guidPattern.test(beFormId)) {
      this.formUuidCache.set(formCode, beFormId);
      console.log(`[PlanningApi] 🔑 Cached formId UUID for [${formCode}]:`, beFormId);
    } else {
      console.warn(`[PlanningApi] ⚠️ beData.formId is not a GUID:`, beFormId, '— save-submission sẽ dùng empty GUID');
    }
    if (beFormVersionId && guidPattern.test(beFormVersionId)) {
      this.formVersionUuidCache.set(formCode, beFormVersionId);
      console.log(`[PlanningApi] 🔑 Cached formVersionId UUID for [${formCode}]:`, beFormVersionId);
    }

    // ── 6. Assemble ──
    const template: LayoutTemplate = {
      formId: formCode,
      formName,
      version: {
        year,
        layoutJSON,
      },
    };

    console.log('[PlanningApi] ✅ Transformed:', {
      formId: template.formId,
      formName,
      formUuid: beFormId || '(none)',
      formVersionUuid: beFormVersionId || '(none)',
      columns: layoutJSON.columns?.length,
      rows: layoutJSON.rows?.length,
      headerRows: layoutJSON.headerRows?.length,
      dbDataCells: dbData.length,
    });

    return { template, dbData };
  }

  /**
   * Infer layoutJSON từ BE cells array.
   * Vì BE không trả đúng cấu trúc layoutJSON, ta phải tự build từ cells.
   */
  private inferLayoutFromCells(cells: BeCellData[]): LayoutJSON {
    // ── 1. Thu thập unique colCodes và rowCodes theo thứ tự xuất hiện ──
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

    // ── 2. Build columns ──
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

    // ── 3. Build rows ──
    const rows: LayoutRowDef[] = [];
    let rowIndex = 0;
    for (const [rowCode, sampleCell] of rowCodeSet) {
      // Tìm cell chứa tên chỉ tiêu (colCode = CHITIEU_NAME)
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

    // ── 4. Build header rows ──
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

    // ── 5. Tính freeze columns (các cột label bên trái) ──
    let freezeColumns = 0;
    for (const col of columns) {
      if (this.isLabelColumn(col.colCode)) {
        freezeColumns++;
      } else {
        break; // Dừng khi gặp cột data đầu tiên
      }
    }

    // ── 6. Build mappings từ cells ──
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
      mergeCells: [], // BE không trả merge info
      fixedRowsTop: 1, // 1 dòng header
      freezeColumns,
      mappings,
    };
  }

  // ─── Helper functions ───

  /** Chuyển index → ký tự cột Excel: 0=A, 1=B, ..., 25=Z, 26=AA */
  private indexToColLetter(index: number): string {
    let result = '';
    let i = index;
    while (i >= 0) {
      result = String.fromCharCode((i % 26) + 65) + result;
      i = Math.floor(i / 26) - 1;
    }
    return result;
  }

  /** Kiểm tra colCode có phải cột label (không nhập liệu) */
  private isLabelColumn(colCode: string): boolean {
    const labelCols = ['STT', 'CHITIEU_NAME', 'UNIT', 'MA_CHITIEU', 'TEN_CHITIEU', 'DON_VI'];
    return labelCols.includes(colCode.toUpperCase());
  }

  /** Chuyển colCode → tiêu đề hiển thị */
  private colCodeToTitle(colCode: string): string {
    const titleMap: Record<string, string> = {
      'STT': 'STT',
      'CHITIEU_NAME': 'Chỉ tiêu',
      'UNIT': 'ĐVT',
      'MA_CHITIEU': 'Mã',
      'TEN_CHITIEU': 'Tên chỉ tiêu',
      'DON_VI': 'Đơn vị',
      'CHI_PHI': 'Chi phí',
      'GIA_BQ': 'Giá BQ',
      'ACTUAL_N2': 'TH N-2',
      'ACTUAL_N1': 'TH N-1',
      'ESTIMATE_N1': 'ƯTH N-1',
      'PLAN_N': 'KH N',
      'PLAN_N1': 'KH N+1',
      'PLAN_N2': 'KH N+2',
      // Tháng
      'SL_T1': 'Tháng 1',
      'SL_T2': 'Tháng 2',
      'SL_T3': 'Tháng 3',
      'SL_T4': 'Tháng 4',
      'SL_T5': 'Tháng 5',
      'SL_T6': 'Tháng 6',
      'SL_T7': 'Tháng 7',
      'SL_T8': 'Tháng 8',
      'SL_T9': 'Tháng 9',
      'SL_T10': 'Tháng 10',
      'SL_T11': 'Tháng 11',
      'SL_T12': 'Tháng 12',
      // Quý
      'SL_Q1': 'Quý 1',
      'SL_Q2': 'Quý 2',
      'SL_Q3': 'Quý 3',
      'SL_Q4': 'Quý 4',
      // Năm
      'SL_NAM': 'Cả năm',
      'TONG': 'Tổng cộng',
    };
    const upper = colCode.toUpperCase();
    if (titleMap[upper]) return titleMap[upper];
    
    // Fallback: parse patterns like T1, T2, Q1, etc.
    const monthMatch = colCode.match(/T(\d+)$/i);
    if (monthMatch) return `Tháng ${monthMatch[1]}`;
    
    const quarterMatch = colCode.match(/Q(\d+)$/i);
    if (quarterMatch) return `Quý ${quarterMatch[1]}`;
    
    return colCode;
  }

  /** Tính độ rộng cột dựa trên colCode */
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

  /** Chuyển rowCode → tiêu đề (dùng tạm, sau này lấy từ dimension) */
  private rowCodeToTitle(rowCode: string): string {
    // Có thể mở rộng mapping nếu cần
    const titleMap: Record<string, string> = {
      'SL_GIA_THANH': 'Sản lượng giá thành',
      'CP_THEO_YT': 'Chi phí theo yếu tố',
      'CP_NHIEN_LIEU': 'Chi phí nhiên liệu',
      'CP_VAT_LIEU': 'Chi phí vật liệu',
      'CP_VL_SX_DIEN': 'CP vật liệu SX điện',
      'CP_VL_PP_DIEN': 'CP vật liệu PP điện',
    };
    return titleMap[rowCode] || rowCode.replace(/_/g, ' ');
  }

  /** Infer level (indent) từ rowCode */
  private inferRowLevel(rowCode: string): number {
    // Có thể customize logic này
    if (rowCode.startsWith('TONG') || rowCode.startsWith('SL_')) return 0;
    if (rowCode.includes('_CON_') || rowCode.includes('_VL_')) return 2;
    return 1;
  }
}

/** Interface cho cell data từ BE */
interface BeCellData {
  rowCode: string;
  colCode: string;
  value: number | string | null;
  accountCode?: string;
  attributeCode?: string;
  formula?: string | null;
  isReadOnly?: boolean;
}

