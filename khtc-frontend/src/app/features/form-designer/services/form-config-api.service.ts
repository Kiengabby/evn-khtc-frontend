// ============================================
// FormConfigApiService
// Gọi API thật tới BE server.
//
// Flow 2 bước:
//   Step 1: POST /api/v2/FormTemplate/save-form      → Tạo/update biểu mẫu
//   Step 2: POST /api/v2/FormConfig/save-form-config  → Lưu layout + mappings
//
// Server:   http://10.1.117.143:9090
// Response: BE .NET trả PascalCase { Succeeded, Message, Data, Errors }
//           → normalizeApiResponse() chuyển sang camelCase
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, delay, switchMap, catchError, map } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { FormRegistryService } from '../../../core/services/form-registry.service';
import {
    FormTemplateSaveRequest,
    FormConfigSaveRequest,
    FormConfigApiResponse,
    LoadFormParams,
    normalizeApiResponse,
} from '../../../core/models/form-config-api.model';
import { FormConfigMapperService } from './form-config-mapper.service';

@Injectable({ providedIn: 'root' })
export class FormConfigApiService {

    private http = inject(HttpClient);
    private configService = inject(ConfigService);
    private mapper = inject(FormConfigMapperService);
    private formRegistry = inject(FormRegistryService);

    // ================================================================
    //  TOGGLE: set false khi muốn dùng mock (offline dev)
    // ================================================================
    private readonly useRealApi = true;

    // ================================================================
    //  Base URL — lấy từ ConfigService (app-config.json)
    // ================================================================
    private get apiBase(): string {
        return this.configService.apiBaseUrl;
    }

    // ================================================================
    //  Helper: POST lên BE + normalize PascalCase → camelCase
    // ================================================================

    /**
     * Gọi POST lên BE, tự động:
     *   1. Catch HTTP error (4xx/5xx) nếu body là JSON → xử lý bình thường
     *   2. Normalize PascalCase (.NET) → camelCase (FE)
     */
    private postAndNormalize<T = any>(url: string, body: any): Observable<FormConfigApiResponse<T>> {
        return this.http.post<any>(url, body).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FormConfigApi] ⚠️ HTTP', httpErr.status, '— body:', errBody);
                    return of(errBody);
                }
                throw httpErr;
            }),
            map(raw => normalizeApiResponse<T>(raw)),
        );
    }

    // ================================================================
    //  STEP 1: SAVE FORM TEMPLATE (tạo/update biểu mẫu trên BE)
    // ================================================================

    /**
     * Tạo hoặc cập nhật biểu mẫu trên BE.
     * PHẢI gọi trước save-form-config!
     */
    saveFormTemplate(request: FormTemplateSaveRequest): Observable<FormConfigApiResponse> {
        console.log('[FormConfigApi] 📋 Step 1 — save-form:', request);

        if (!this.useRealApi) {
            return of({
                succeeded: true,
                message: 'Mock: Tạo biểu mẫu thành công',
                data: { formID: request.formID || request.formCode },
                errors: [],
                statusCode: 200,
                errorCode: 0,
            }).pipe(delay(300));
        }

        const url = `${this.apiBase}/api/v2/FormTemplate/save-form`;
        console.log('[FormConfigApi] 🌐 POST:', url);
        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  STEP 2: SAVE FORM CONFIG (lưu layout + mappings)
    // ================================================================

    /**
     * Lưu cấu hình biểu mẫu lên BE.
     *
     * @param exportedTemplate - JSON từ Form Designer (exportToJson())
     * @returns Observable<FormConfigApiResponse> — response từ BE
     */
    saveFormConfig(exportedTemplate: any): Observable<FormConfigApiResponse> {
        const request = this.mapper.toSaveRequest(exportedTemplate);

        console.log('[FormConfigApi] 📤 Step 2 — save-form-config:', request);
        console.log('[FormConfigApi] 📤 layoutJSON (parsed):', JSON.parse(request.layoutJSON));

        if (!this.useRealApi) {
            return this.mockSave(request);
        }

        const url = `${this.apiBase}/api/v2/FormConfig/save-form-config`;
        console.log('[FormConfigApi] 🌐 POST:', url);

        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  COMBO: Step 1 + Step 2 (Tạo form → Lưu config)
    // ================================================================

    /**
     * Flow đầy đủ: Tạo biểu mẫu trên BE, rồi lưu config.
     * Dùng trong Form Designer khi nhấn "Lưu".
     */
    saveTemplateAndConfig(exportedTemplate: any): Observable<FormConfigApiResponse> {
        // ── Step 1: Tạo/cập nhật FormTemplate ──
        const templateRequest: FormTemplateSaveRequest = {
            formID: null, // null = tạo mới, BE sẽ gán UUID
            formCode: exportedTemplate.formId || 'NEW_TEMPLATE',
            formName: exportedTemplate.formName || 'Biểu mẫu mới',
            isActive: exportedTemplate.isActive ?? true,
            appliedEntities: (exportedTemplate.orgList || []).join(','),
        };

        return this.saveFormTemplate(templateRequest).pipe(
            switchMap((step1Response) => {
                // ★ FIX: Giờ step1Response đã được normalize → succeeded đúng type
                if (!step1Response.succeeded) {
                    console.error('[FormConfigApi] ❌ Step 1 thất bại:', step1Response);
                    return of(step1Response); // Trả lỗi ngay
                }

                console.log('[FormConfigApi] ✅ Step 1 thành công:', step1Response);

                // Lấy formID từ response BE (có thể là UUID mới được tạo)
                // BE trả về data = string UUID, không phải object
                const beFormID = (typeof step1Response.data === 'string')
                    ? step1Response.data
                    : (step1Response.data?.formID || step1Response.data?.id || exportedTemplate.formId);

                // ★ NEW: Đăng ký form vào FormRegistry (code → UUID mapping)
                if (beFormID && templateRequest.formCode) {
                    this.formRegistry.registerForm(templateRequest.formCode, beFormID);
                }

                // ── Step 2: Lưu FormConfig với formID từ BE ──
                const configRequest = this.mapper.toSaveRequest(exportedTemplate);
                // Override formID với giá trị từ BE
                if (beFormID) {
                    configRequest.formID = beFormID;
                }

                console.log('[FormConfigApi] 📤 Step 2 — save-form-config (formID từ BE):', configRequest.formID);
                return this.saveFormConfigDirect(configRequest);
            }),
            catchError((err) => {
                console.error('[FormConfigApi] ❌ Lỗi trong flow save:', err);
                const errBody = err.error;
                const serverMsg = errBody?.Message ?? errBody?.message ?? err.message ?? 'Unknown error';
                return of({
                    succeeded: false,
                    message: 'Lỗi kết nối server',
                    data: null,
                    errors: [serverMsg],
                    statusCode: err.status || 500,
                    errorCode: 0,
                });
            }),
        );
    }

    /**
     * Lưu config trực tiếp (dùng request đã transform sẵn).
     */
    saveFormConfigDirect(request: FormConfigSaveRequest): Observable<FormConfigApiResponse> {
        if (!this.useRealApi) {
            return this.mockSave(request);
        }

        const url = `${this.apiBase}/api/v2/FormConfig/save-form-config`;
        console.log('[FormConfigApi] 🌐 POST save-form-config:', url);
        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  LOAD FORM (GET — cho Data Entry)
    // ================================================================

    /**
     * Load form data từ BE.
     * GET /api/v2/PlanningData/load-form?formId=...&entityCode=...&year=...
     */
    loadForm(params: LoadFormParams): Observable<FormConfigApiResponse> {
        console.log('[FormConfigApi] 📥 load-form:', params);

        if (!this.useRealApi) {
            return of({
                succeeded: true,
                message: 'Mock: Load form',
                data: null,
                errors: [],
                statusCode: 200,
                errorCode: 0,
            }).pipe(delay(500));
        }

        let httpParams = new HttpParams()
            .set('formId', params.formId)
            .set('entityCode', params.entityCode)
            .set('year', params.year.toString());

        if (params.period) httpParams = httpParams.set('period', params.period);
        if (params.scenario) httpParams = httpParams.set('scenario', params.scenario);

        const url = `${this.apiBase}/api/v2/PlanningData/load-form`;
        return this.http.get<any>(url, { params: httpParams }).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    return of(errBody);
                }
                throw httpErr;
            }),
            map(raw => normalizeApiResponse(raw)),
        );
    }

    // ================================================================
    //  MOCK (offline fallback)
    // ================================================================

    private mockSave(request: FormConfigSaveRequest): Observable<FormConfigApiResponse> {
        console.log('[FormConfigApi] 🔶 Mock save:', request.formID, '—', request.mappings.length, 'mappings');
        return of({
            succeeded: true,
            message: 'Mock: Lưu thành công',
            data: { formID: request.formID },
            errors: [],
            statusCode: 200,
            errorCode: 0,
        }).pipe(delay(500));
    }
}
