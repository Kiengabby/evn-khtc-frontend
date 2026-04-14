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
        formUUID: string | null;
        formTypeCode: string | null;
        periodType: string | null;
    } | null> {
        const currentYear = new Date().getFullYear();
        // Thử các năm: năm truyền vào (nếu có), năm hiện tại, năm sau, năm trước
        const yearsToTry: number[] = year
            ? [year]
            : [currentYear, currentYear + 1, currentYear - 1];

        return this.tryLoadForDesigner(formCode, yearsToTry);
    }

    private tryLoadForDesigner(formCode: string, yearsToTry: number[]): Observable<{
        formCode: string;
        formName: string;
        year: number;
        layoutJSON: any;
        formUUID: string | null;
        formTypeCode: string | null;
        periodType: string | null;
    } | null> {
        if (yearsToTry.length === 0) return of(null);

        const [tryYear, ...rest] = yearsToTry;
        return this.loadFormForDesignerWithYear(formCode, tryYear).pipe(
            switchMap(result => {
                if (result !== null) return of(result);
                console.warn('[FormConfigApi] Thử năm', tryYear, 'không có data, thử năm tiếp theo...');
                return this.tryLoadForDesigner(formCode, rest);
            }),
        );
    }

    private loadFormForDesignerWithYear(formCode: string, effectiveYear: number): Observable<{
        formCode: string;
        formName: string;
        year: number;
        layoutJSON: any;
        formUUID: string | null;
        formTypeCode: string | null;
        periodType: string | null;
    } | null> {
        const url = `${this.apiBase}/api/v2/PlanningData/load-form`;

        const params = new HttpParams()
            .set('formCode', formCode)
            .set('year', effectiveYear.toString())
            .set('entityCode', 'EVN')
            .set('period', '00');  // '00' là mã kỳ hợp lệ cho YEAR, tránh NullRef trên BE

        console.log('[FormConfigApi] Load form for designer:', { formCode, year: effectiveYear });

        return this.http.get<any>(url, { params }).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FormConfigApi] HTTP', httpErr.status, 'treating body as response');
                    return of(errBody);
                }
                // 500 or network error → return null to try next year
                console.warn('[FormConfigApi] HTTP error', httpErr.status, 'for year', effectiveYear);
                return of(null);
            }),
            map(raw => {
                if (raw === null) return null;
                console.log('[FormConfigApi] Load form raw response (year=' + effectiveYear + '):', raw);

                let beData: any;
                if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
                    const response = normalizeApiResponse(raw);
                    if (!response.succeeded) {
                        console.warn('[FormConfigApi] Load form thất bại:', response.message);
                        return null;
                    }
                    beData = response.data;
                } else {
                    beData = raw;
                }

                if (!beData) return null;

                let layoutJSON: any = null;
                const rawLayout = beData.layoutJSON || beData.LayoutJSON;

                if (typeof rawLayout === 'string' && rawLayout.trim()) {
                    try {
                        layoutJSON = JSON.parse(rawLayout);
                    } catch (e) {
                        console.warn('[FormConfigApi] layoutJSON parse error:', e);
                        return null;
                    }
                } else if (rawLayout && typeof rawLayout === 'object') {
                    layoutJSON = rawLayout;
                }

                if (!layoutJSON?.columns || !Array.isArray(layoutJSON.columns) || layoutJSON.columns.length === 0) {
                    console.warn('[FormConfigApi] layoutJSON không có columns hợp lệ');
                    return null;
                }

                console.log('[FormConfigApi] Loaded form for designer:', {
                    formCode: beData.formCode || formCode,
                    formName: beData.formName,
                    year: effectiveYear,
                    columns: layoutJSON.columns?.length,
                });

                const rawFormTypeCode = beData.formTypeCode || beData.FormTypeCode || null;
                const rawPeriodType = beData.periodType || beData.PeriodType || rawFormTypeCode || null;
                return {
                    formCode: beData.formCode || beData.formId || formCode,
                    formName: beData.formName || beData.formConfig?.formName || formCode,
                    year: effectiveYear,
                    layoutJSON,
                    formUUID: beData.formId || beData.FormId || null,
                    formTypeCode: rawFormTypeCode,
                    periodType: rawPeriodType,
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
        const formCode = exportedTemplate.formId || 'NEW_TEMPLATE';

        // Gửi cả khi INSERT (formID=null) lẫn UPDATE (formID=UUID) qua cùng save-form endpoint
        const templateRequest: FormTemplateSaveRequest = {
            formID: existingUUID,
            formCode,
            formName: exportedTemplate.formName || 'Biểu mẫu mới',
            isActive: exportedTemplate.isActive ?? true,
            appliedEntities: (exportedTemplate.orgList || []).join(','),
            formTypeCode: exportedTemplate.formTypeCode || 'YEAR',
            allowedPeriods: Array.isArray(exportedTemplate.allowedPeriods)
                ? JSON.stringify(exportedTemplate.allowedPeriods)
                : (exportedTemplate.allowedPeriods || ''),
        };

        const mode = existingUUID ? 'UPDATE' : 'INSERT';
        console.log('[FormConfigApi] Step 1 save-form (' + mode + ' ' + formCode + '):', templateRequest);

        return this.saveFormTemplate(templateRequest).pipe(
            switchMap((step1Response) => {
                if (!step1Response.succeeded) {
                    console.error('[FormConfigApi] Step 1 thất bại:', step1Response);
                    return of(step1Response);
                }

                console.log('[FormConfigApi] Step 1 thành công:', step1Response);

                const beFormID = (typeof step1Response.data === 'string')
                    ? step1Response.data
                    : (step1Response.data?.formID || step1Response.data?.id || existingUUID || null);

                if (beFormID && formCode) {
                    this.formRegistry.registerForm(formCode, beFormID);
                }

                return this.saveConfigOnly(beFormID || existingUUID || formCode, exportedTemplate);
            }),
            catchError((err) => {
                console.error('[FormConfigApi] Lỗi trong flow save:', err);
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
