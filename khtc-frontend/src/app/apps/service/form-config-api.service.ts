// ============================================
// FormConfigApiService
// Gọi API thật t�:i BE server.
//
// Flow 2 bư�:c:
//   Step 1: POST /api/v2/FormTemplate/save-form      �  Tạo/update biỒu mẫu
//   Step 2: POST /api/v2/FormConfig/save-form-config  �  Lưu layout + mappings
//
// Server:   http://10.1.117.143:9090
// Response: BE .NET trả PascalCase { Succeeded, Message, Data, Errors }
//           �  normalizeApiResponse() chuyỒn sang camelCase
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, delay, switchMap, catchError, map } from 'rxjs';
import { ConfigService } from '../../core/app-config.service';
import { FormRegistryService } from './form-registry.service';
import {
    FormTemplateSaveRequest,
    FormConfigSaveRequest,
    FormConfigApiResponse,
    LoadFormParams,
    normalizeApiResponse,
} from '../../config/models/form-config-api.model';
import { FormConfigMapperService } from './form-config-mapper.service';

@Injectable({ providedIn: 'root' })
export class FormConfigApiService {

    private http = inject(HttpClient);
    private configService = inject(ConfigService);
    private mapper = inject(FormConfigMapperService);
    private formRegistry = inject(FormRegistryService);

    // ================================================================
    //  TOGGLE: set false khi mu�n dùng mock (offline dev)
    // ================================================================
    private readonly useRealApi = true;

    // ================================================================
    //  Base URL � lấy từ ConfigService (app-config.json)
    // ================================================================
    private get apiBase(): string {
        return this.configService.apiBaseUrl;
    }

    // ================================================================
    //  Helper: POST lên BE + normalize PascalCase �  camelCase
    // ================================================================

    /**
     * Gọi POST lên BE, tự ��"ng:
     *   1. Catch HTTP error (4xx/5xx) nếu body là JSON �  xử lý bình thường
     *   2. Normalize PascalCase (.NET) �  camelCase (FE)
     */
    private postAndNormalize<T = any>(url: string, body: any): Observable<FormConfigApiResponse<T>> {
        return this.http.post<any>(url, body).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FormConfigApi] �a�️ HTTP', httpErr.status, '� body:', errBody);
                    return of(errBody);
                }
                throw httpErr;
            }),
            map(raw => normalizeApiResponse<T>(raw)),
        );
    }

    private getAndNormalize<T = any>(url: string): Observable<FormConfigApiResponse<T>> {
        return this.http.get<any>(url).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FormConfigApi] �a�️ HTTP', httpErr.status, '� body:', errBody);
                    return of(errBody);
                }
                throw httpErr;
            }),
            map(raw => normalizeApiResponse<T>(raw)),
        );
    }

    // ================================================================
    //  GET FORM TEMPLATE LIST
    //  GET /api/v2/FormTemplate/get-list
    // ================================================================

    /**
     * Lấy danh sách biỒu mẫu từ BE.
     * BE trả về: { Succeeded, Data: [ { id, formCode, formName, description, isActive } ], Message }
     */
    getFormTemplateList(): Observable<any[]> {
        const url = `${this.apiBase}/api/v2/FormTemplate/get-list`;
        console.log('[FormConfigApi] �xR� GET FormTemplate/get-list:', url);

        return this.getAndNormalize<any[]>(url).pipe(
            map(res => {
                if (!res.succeeded) {
                    console.warn('[FormConfigApi] �a�️ get-list thất bại:', res.message);
                    return [];
                }
                const data = res.data;
                if (Array.isArray(data)) return data;
                return [];
            }),
        );
    }

    // ================================================================
    //  LOAD FORM LAYOUT (cho Form Designer � xem/sửa biỒu mẫu �ã lưu)
    //  GET /api/v2/PlanningData/load-form?formCode=...&year=...
    // ================================================================

    /**
     * Load layout �ã lưu từ BE cho Form Designer (xem lại / ch�0nh sửa).
     * Sử dụng cùng endpoint mà Data Entry dùng, nhưng ch�0 extract layoutJSON.
     *
     * @param formCode Mã biỒu mẫu (VD: "AAA", "KHTC_SXKD_03")
     * @param year NĒm phiên bản (default: nĒm hi�!n tại)
     * @returns { formCode, formName, year, layoutJSON } hoặc null nếu chưa có config
     */
    loadFormForDesigner(formCode: string, year?: number): Observable<{
        formCode: string;
        formName: string;
        year: number;
        layoutJSON: any;
        formUUID: string | null;  // UUID từ BE �Ồ dùng khi UPDATE (không tạo m�:i)
    } | null> {
        const effectiveYear = year || new Date().getFullYear();
        const url = `${this.apiBase}/api/v2/PlanningData/load-form`;

        const params = new HttpParams()
            .set('formCode', formCode)
            .set('year', effectiveYear.toString())
            .set('entityCode', 'EVN')
            .set('period', 'Kỳ 1');  // BE yêu cầu period (NullRef nếu r�ng)

        console.log('[FormConfigApi] �x� Load form for designer:', { formCode, year: effectiveYear });

        return this.http.get<any>(url, { params }).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                // BE trả HTTP error nhưng body có Succeeded �  xử lý bình thường
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FormConfigApi] �a�️ HTTP', httpErr.status, '� treating body as response');
                    return of(errBody);
                }
                throw httpErr;
            }),
            map(raw => {
                console.log('[FormConfigApi] �x� Load form raw response:', raw);

                // ���� Normalize PascalCase �  camelCase ����
                let beData: any;
                if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
                    const response = normalizeApiResponse(raw);
                    if (!response.succeeded) {
                        console.warn('[FormConfigApi] �a�️ Load form thất bại:', response.message);
                        return null;
                    }
                    beData = response.data;
                } else {
                    beData = raw;
                }

                if (!beData) {
                    console.warn('[FormConfigApi] �a�️ Response data r�ng');
                    return null;
                }

                // ���� Parse layoutJSON ����
                let layoutJSON: any = null;
                const rawLayout = beData.layoutJSON || beData.LayoutJSON;

                if (typeof rawLayout === 'string' && rawLayout.trim()) {
                    try {
                        layoutJSON = JSON.parse(rawLayout);
                    } catch (e) {
                        console.warn('[FormConfigApi] �a�️ layoutJSON parse error:', e);
                        return null;
                    }
                } else if (rawLayout && typeof rawLayout === 'object') {
                    layoutJSON = rawLayout;
                }

                // Validate cấu trúc cơ bản
                if (!layoutJSON?.columns || !Array.isArray(layoutJSON.columns) || layoutJSON.columns.length === 0) {
                    console.warn('[FormConfigApi] �a�️ layoutJSON không có columns hợp l�!');
                    return null;
                }

                console.log('[FormConfigApi] �S& Loaded form for designer:', {
                    formCode: beData.formCode || formCode,
                    formName: beData.formName,
                    columns: layoutJSON.columns?.length,
                    rows: layoutJSON.rows?.length,
                    headerRows: layoutJSON.headerRows?.length,
                    mappings: layoutJSON.mappings?.length,
                    mergeCells: layoutJSON.mergeCells?.length,
                });

                return {
                    formCode: beData.formCode || beData.formId || formCode,
                    formName: beData.formName || beData.formConfig?.formName || formCode,
                    year: effectiveYear,
                    layoutJSON,
                    formUUID: beData.formId || beData.FormId || null, // UUID �Ồ dùng khi UPDATE
                };
            }),
        );
    }

    // ================================================================
    //  STEP 1: SAVE FORM TEMPLATE (tạo/update biỒu mẫu trên BE)
    // ================================================================

    /**
     * Tạo hoặc cập nhật biỒu mẫu trên BE.
     * PHẢI gọi trư�:c save-form-config!
     */
    saveFormTemplate(request: FormTemplateSaveRequest): Observable<FormConfigApiResponse> {
        console.log('[FormConfigApi] �x9 Step 1 � save-form:', request);

        if (!this.useRealApi) {
            return of({
                succeeded: true,
                message: 'Mock: Tạo biỒu mẫu thành công',
                data: { formID: request.formID || request.formCode },
                errors: [],
                statusCode: 200,
                errorCode: 0,
            }).pipe(delay(300));
        }

        const url = `${this.apiBase}/api/v2/FormTemplate/save-form`;
        console.log('[FormConfigApi] �xR� POST:', url);
        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  STEP 2: SAVE FORM CONFIG (lưu layout + mappings)
    // ================================================================

    /**
     * Lưu cấu hình biỒu mẫu lên BE.
     *
     * @param exportedTemplate - JSON từ Form Designer (exportToJson())
     * @returns Observable<FormConfigApiResponse> � response từ BE
     */
    saveFormConfig(exportedTemplate: any): Observable<FormConfigApiResponse> {
        const request = this.mapper.toSaveRequest(exportedTemplate);

        console.log('[FormConfigApi] �x� Step 2 � save-form-config:', request);
        console.log('[FormConfigApi] �x� layoutJSON (parsed):', JSON.parse(request.layoutJSON));

        if (!this.useRealApi) {
            return this.mockSave(request);
        }

        const url = `${this.apiBase}/api/v2/FormConfig/save-form-config`;
        console.log('[FormConfigApi] �xR� POST:', url);

        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  COMBO: Step 1 + Step 2 (Tạo form �  Lưu config)
    // ================================================================

    /**
     * Flow �ầy �ủ: Tạo biỒu mẫu trên BE, r�i lưu config.
     * Dùng trong Form Designer khi nhấn "Lưu".
     */
    saveTemplateAndConfig(exportedTemplate: any): Observable<FormConfigApiResponse> {
        const existingUUID = exportedTemplate.existingFormUUID || null;

        // ���� Nếu form �ã t�n tại trên BE (có UUID) �  bỏ qua Step 1, nhảy thẳng Step 2 ����
        // BE endpoint save-form ch�0 h� trợ INSERT, không UPDATE.
        // Gọi lại v�:i formCode �ã có �  400 FormCodeAlreadyExists.
        if (existingUUID) {
            console.log('[FormConfigApi] �x Form �ã t�n tại (UUID:', existingUUID, ') �  Bỏ qua Step 1, ch�0 lưu layout config');
            return this.saveConfigOnly(existingUUID, exportedTemplate);
        }

        // ���� Form m�:i: Step 1 (tạo FormTemplate) �  Step 2 (lưu config) ����
        const formCode = exportedTemplate.formId || 'NEW_TEMPLATE';
        const templateRequest: FormTemplateSaveRequest = {
            formID: null, // null = INSERT m�:i trên BE
            formCode,
            formName: exportedTemplate.formName || 'BiỒu mẫu m�:i',
            isActive: exportedTemplate.isActive ?? true,
            appliedEntities: (exportedTemplate.orgList || []).join(','),
            formTypeCode: exportedTemplate.formTypeCode || 'MONTH',
            allowedPeriods: Array.isArray(exportedTemplate.allowedPeriods)
                ? JSON.stringify(exportedTemplate.allowedPeriods)
                : (exportedTemplate.allowedPeriods || ''),
        };
        console.log('[FormConfigApi] �x� Step 1 � save-form (tạo m�:i formCode:', formCode, ')');

        return this.saveFormTemplate(templateRequest).pipe(
            switchMap((step1Response) => {
                if (!step1Response.succeeded) {
                    console.error('[FormConfigApi] �R Step 1 thất bại:', step1Response);
                    return of(step1Response);
                }

                console.log('[FormConfigApi] �S& Step 1 thành công:', step1Response);

                // BE trả data = UUID string của FormTemplate vừa tạo
                const beFormID = (typeof step1Response.data === 'string')
                    ? step1Response.data
                    : (step1Response.data?.formID || step1Response.data?.id || null);

                // ĐĒng ký vào FormRegistry (code �  UUID)
                if (beFormID && formCode) {
                    this.formRegistry.registerForm(formCode, beFormID);
                }

                return this.saveConfigOnly(beFormID || formCode, exportedTemplate);
            }),
            catchError((err) => {
                console.error('[FormConfigApi] �R L�i trong flow save:', err);
                const errBody = err.error;
                const serverMsg = errBody?.Message ?? errBody?.message ?? err.message ?? 'Unknown error';
                return of({
                    succeeded: false,
                    message: 'L�i kết n�i server',
                    data: null,
                    errors: [serverMsg],
                    statusCode: err.status || 500,
                    errorCode: 0,
                });
            }),
        );
    }

    /**
     * Ch�0 lưu FormConfig (layout) v�:i formID �ã biết.
     * Dùng khi UPDATE form �ã t�n tại (bỏ qua bư�:c tạo FormTemplate).
     */
    private saveConfigOnly(formID: string, exportedTemplate: any): Observable<FormConfigApiResponse> {
        const configRequest = this.mapper.toSaveRequest(exportedTemplate);
        configRequest.formID = formID;

        console.log('[FormConfigApi] �x� save-form-config (formID:', formID, ')');
        return this.saveFormConfigDirect(configRequest).pipe(
            map(response => ({
                ...response,
                // Propagate formID so component can store it for future updates
                data: formID,
            })),
        );
    }


    /**
     * Lưu config trực tiếp (dùng request �ã transform sẵn).
     */
    saveFormConfigDirect(request: FormConfigSaveRequest): Observable<FormConfigApiResponse> {
        if (!this.useRealApi) {
            return this.mockSave(request);
        }

        const url = `${this.apiBase}/api/v2/FormConfig/save-form-config`;
        console.log('[FormConfigApi] �xR� POST save-form-config:', url);
        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  LOAD FORM (GET � cho Data Entry)
    // ================================================================

    /**
     * Load form data từ BE.
     * GET /api/v2/PlanningData/load-form?formId=...&entityCode=...&year=...
     */
    loadForm(params: LoadFormParams): Observable<FormConfigApiResponse> {
        console.log('[FormConfigApi] �x� load-form:', params);

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
        console.log('[FormConfigApi] �x� Mock save:', request.formID, '�', request.mappings.length, 'mappings');
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
