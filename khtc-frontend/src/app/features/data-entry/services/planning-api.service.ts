import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  TemplateJson, DimMetadata, PovSelection, FactDataPoint,
} from './template-parser.service';
import {
  LoadGridResponse, SaveGridPayload,
} from '../../../core/models/layout-template.model';

export interface PlanningFormResponse {
  template: TemplateJson;
  dimMeta: DimMetadata;
  factData: FactDataPoint[];
}

export interface TemplateListItem {
  templateId: string;
  templateName: string;
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

  /**
   * ================================================================
   *  MOCK / REAL API TOGGLE
   * ================================================================
   *  Khi BE sẵn sàng:
   *    1. Set useMock = false
   *    2. Set apiBaseUrl = URL thật (VD: 'https://api.evn.com.vn/v1/planning')
   *    3. Đảm bảo BE trả đúng interface PlanningFormResponse / LoadGridResponse
   * ================================================================
   */
  private readonly useMock = true;
  private readonly apiBaseUrl = '/api/planning';

  // ==========================================================
  // V1 — Dimension-based format (OLD — giữ nguyên)
  // ==========================================================

  /** Tải toàn bộ dữ liệu cần thiết để render 1 biểu mẫu */
  loadForm(templateId: string): Observable<PlanningFormResponse> {
    if (this.useMock) {
      return this.mockLoadForm(templateId);
    }
    return this.http.get<PlanningFormResponse>(
      `${this.apiBaseUrl}/forms/${templateId}`,
    );
  }

  /** Tải fact data riêng (khi đổi POV mà không cần load lại template) */
  loadFactData(
    templateId: string, pov: PovSelection, nam: number,
  ): Observable<FactDataPoint[]> {
    if (this.useMock) {
      return this.http
        .get<FactDataPoint[]>('assets/mock-data/planning-fact-data.json')
        .pipe(delay(200));
    }
    return this.http.post<FactDataPoint[]>(
      `${this.apiBaseUrl}/fact-data`,
      { templateId, pov, nam },
    );
  }

  /** Lưu các ô thay đổi về BE */
  saveChanges(request: SaveChangesRequest): Observable<SaveResult> {
    if (this.useMock) {
      console.log('[MockAPI] Saving', request.changes.length, 'changes:', request);
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
    if (this.useMock) {
      return of([
        { templateId: 'BKH_KH_01', templateName: 'BKH.KH.01 — Kế hoạch Điện sản xuất và Mua' },
        { templateId: 'NEW_TEMPLATE', templateName: 'Biểu mẫu mới — Layout colCode/rowCode' },
      ]).pipe(delay(100));
    }
    return this.http.get<TemplateListItem[]>(`${this.apiBaseUrl}/templates`);
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
      factData: this.http.get<FactDataPoint[]>(
        'assets/mock-data/planning-fact-data.json',
      ),
    }).pipe(delay(400));
  }

  // ==========================================================
  // V2 — colCode/rowCode-based format (NEW)
  // ==========================================================

  /**
   * Tải biểu mẫu theo format mới (layoutJSON + dbData).
   *
   * Response chứa:
   *   - template: LayoutTemplate (layout + metadata)
   *   - dbData: GridCellData[] (dữ liệu từ DB)
   *
   * Khi BE sẵn sàng: thay mock bằng HTTP GET thật.
   */
  loadFormV2(formId: string): Observable<LoadGridResponse> {
    if (this.useMock) {
      return this.http
        .get<LoadGridResponse>('assets/mock-data/new-template-demo.json')
        .pipe(delay(400));
    }
    return this.http.get<LoadGridResponse>(
      `${this.apiBaseUrl}/v2/forms/${formId}`,
    );
  }

  /**
   * Lưu dữ liệu theo format mới (rowCode/colCode/value).
   *
   * Payload:
   *   { formId, version_year, orgId, data: GridCellData[] }
   *
   * Khi BE sẵn sàng: thay mock bằng HTTP POST thật.
   */
  saveFormV2(payload: SaveGridPayload): Observable<SaveResult> {
    if (this.useMock) {
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
    return this.http.post<SaveResult>(`${this.apiBaseUrl}/v2/save`, payload);
  }
}
