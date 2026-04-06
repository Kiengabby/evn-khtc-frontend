// ============================================
// FormConfigApiService
// Gá»i API tháº­t tá»›i BE server.
//
// Flow 2 bÆ°á»›c:
//   Step 1: POST /api/v2/FormTemplate/save-form      â†’ Táº¡o/update biá»ƒu máº«u
//   Step 2: POST /api/v2/FormConfig/save-form-config  â†’ LÆ°u layout + mappings
//
// Server:   http://10.1.117.143:9090
// Response: BE .NET tráº£ PascalCase { Succeeded, Message, Data, Errors }
//           â†’ normalizeApiResponse() chuyá»ƒn sang camelCase
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
    //  TOGGLE: set false khi muá»‘n dÃ¹ng mock (offline dev)
    // ================================================================
    private readonly useRealApi = true;

    // ================================================================
    //  Base URL â€” láº¥y tá»« ConfigService (app-config.json)
    // ================================================================
    private get apiBase(): string {
        return this.configService.apiBaseUrl;
    }

    // ================================================================
    //  Helper: POST lÃªn BE + normalize PascalCase â†’ camelCase
    // ================================================================

    /**
     * Gá»i POST lÃªn BE, tá»± Ä‘á»™ng:
     *   1. Catch HTTP error (4xx/5xx) náº¿u body lÃ  JSON â†’ xá»­ lÃ½ bÃ¬nh thÆ°á»ng
     *   2. Normalize PascalCase (.NET) â†’ camelCase (FE)
     */
    private postAndNormalize<T = any>(url: string, body: any): Observable<FormConfigApiResponse<T>> {
        return this.http.post<any>(url, body).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FormConfigApi] âš ï¸ HTTP', httpErr.status, 'â€” body:', errBody);
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
                    console.warn('[FormConfigApi] âš ï¸ HTTP', httpErr.status, 'â€” body:', errBody);
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
     * Láº¥y danh sÃ¡ch biá»ƒu máº«u tá»« BE.
     * BE tráº£ vá»: { Succeeded, Data: [ { id, formCode, formName, description, isActive } ], Message }
     */
    getFormTemplateList(): Observable<any[]> {
        const url = `${this.apiBase}/api/v2/FormTemplate/get-list`;
        console.log('[FormConfigApi] ðŸŒ GET FormTemplate/get-list:', url);

        return this.getAndNormalize<any[]>(url).pipe(
            map(res => {
                if (!res.succeeded) {
                    console.warn('[FormConfigApi] âš ï¸ get-list tháº¥t báº¡i:', res.message);
                    return [];
                }
                const data = res.data;
                if (Array.isArray(data)) return data;
                return [];
            }),
        );
    }

    // ================================================================
    //  LOAD FORM LAYOUT (cho Form Designer â€” xem/sá»­a biá»ƒu máº«u Ä‘Ã£ lÆ°u)
    //  GET /api/v2/PlanningData/load-form?formCode=...&year=...
    // ================================================================

    /**
     * Load layout Ä‘Ã£ lÆ°u tá»« BE cho Form Designer (xem láº¡i / chá»‰nh sá»­a).
     * Sá»­ dá»¥ng cÃ¹ng endpoint mÃ  Data Entry dÃ¹ng, nhÆ°ng chá»‰ extract layoutJSON.
     *
     * @param formCode MÃ£ biá»ƒu máº«u (VD: "AAA", "KHTC_SXKD_03")
     * @param year NÄƒm phiÃªn báº£n (default: nÄƒm hiá»‡n táº¡i)
     * @returns { formCode, formName, year, layoutJSON } hoáº·c null náº¿u chÆ°a cÃ³ config
     */
    loadFormForDesigner(formCode: string, year?: number): Observable<{
        formCode: string;
        formName: string;
        year: number;
        layoutJSON: any;
        formUUID: string | null;  // UUID tá»« BE Ä‘á»ƒ dÃ¹ng khi UPDATE (khÃ´ng táº¡o má»›i)
    } | null> {
        const effectiveYear = year || new Date().getFullYear();
        const url = `${this.apiBase}/api/v2/PlanningData/load-form`;

        const params = new HttpParams()
            .set('formCode', formCode)
            .set('year', effectiveYear.toString())
            .set('entityCode', 'EVN')
            .set('period', 'Ká»³ 1');  // BE yÃªu cáº§u period (NullRef náº¿u rá»—ng)

        console.log('[FormConfigApi] ðŸ“¥ Load form for designer:', { formCode, year: effectiveYear });

        return this.http.get<any>(url, { params }).pipe(
            catchError((httpErr: HttpErrorResponse) => {
                const errBody = httpErr.error;
                // BE tráº£ HTTP error nhÆ°ng body cÃ³ Succeeded â†’ xá»­ lÃ½ bÃ¬nh thÆ°á»ng
                if (errBody && typeof errBody === 'object' &&
                    (errBody.Succeeded !== undefined || errBody.succeeded !== undefined)) {
                    console.warn('[FormConfigApi] âš ï¸ HTTP', httpErr.status, 'â€” treating body as response');
                    return of(errBody);
                }
                throw httpErr;
            }),
            map(raw => {
                console.log('[FormConfigApi] ðŸ“¥ Load form raw response:', raw);

                // â”€â”€ Normalize PascalCase â†’ camelCase â”€â”€
                let beData: any;
                if (raw?.Succeeded !== undefined || raw?.succeeded !== undefined) {
                    const response = normalizeApiResponse(raw);
                    if (!response.succeeded) {
                        console.warn('[FormConfigApi] âš ï¸ Load form tháº¥t báº¡i:', response.message);
                        return null;
                    }
                    beData = response.data;
                } else {
                    beData = raw;
                }

                if (!beData) {
                    console.warn('[FormConfigApi] âš ï¸ Response data rá»—ng');
                    return null;
                }

                // â”€â”€ Parse layoutJSON â”€â”€
                let layoutJSON: any = null;
                const rawLayout = beData.layoutJSON || beData.LayoutJSON;

                if (typeof rawLayout === 'string' && rawLayout.trim()) {
                    try {
                        layoutJSON = JSON.parse(rawLayout);
                    } catch (e) {
                        console.warn('[FormConfigApi] âš ï¸ layoutJSON parse error:', e);
                        return null;
                    }
                } else if (rawLayout && typeof rawLayout === 'object') {
                    layoutJSON = rawLayout;
                }

                // Validate cáº¥u trÃºc cÆ¡ báº£n
                if (!layoutJSON?.columns || !Array.isArray(layoutJSON.columns) || layoutJSON.columns.length === 0) {
                    console.warn('[FormConfigApi] âš ï¸ layoutJSON khÃ´ng cÃ³ columns há»£p lá»‡');
                    return null;
                }

                console.log('[FormConfigApi] âœ… Loaded form for designer:', {
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
                    formUUID: beData.formId || beData.FormId || null, // UUID Ä‘á»ƒ dÃ¹ng khi UPDATE
                };
            }),
        );
    }

    // ================================================================
    //  STEP 1: SAVE FORM TEMPLATE (táº¡o/update biá»ƒu máº«u trÃªn BE)
    // ================================================================

    /**
     * Táº¡o hoáº·c cáº­p nháº­t biá»ƒu máº«u trÃªn BE.
     * PHáº¢I gá»i trÆ°á»›c save-form-config!
     */
    saveFormTemplate(request: FormTemplateSaveRequest): Observable<FormConfigApiResponse> {
        console.log('[FormConfigApi] ðŸ“‹ Step 1 â€” save-form:', request);

        if (!this.useRealApi) {
            return of({
                succeeded: true,
                message: 'Mock: Táº¡o biá»ƒu máº«u thÃ nh cÃ´ng',
                data: { formID: request.formID || request.formCode },
                errors: [],
                statusCode: 200,
                errorCode: 0,
            }).pipe(delay(300));
        }

        const url = `${this.apiBase}/api/v2/FormTemplate/save-form`;
        console.log('[FormConfigApi] ðŸŒ POST:', url);
        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  STEP 2: SAVE FORM CONFIG (lÆ°u layout + mappings)
    // ================================================================

    /**
     * LÆ°u cáº¥u hÃ¬nh biá»ƒu máº«u lÃªn BE.
     *
     * @param exportedTemplate - JSON tá»« Form Designer (exportToJson())
     * @returns Observable<FormConfigApiResponse> â€” response tá»« BE
     */
    saveFormConfig(exportedTemplate: any): Observable<FormConfigApiResponse> {
        const request = this.mapper.toSaveRequest(exportedTemplate);

        console.log('[FormConfigApi] ðŸ“¤ Step 2 â€” save-form-config:', request);
        console.log('[FormConfigApi] ðŸ“¤ layoutJSON (parsed):', JSON.parse(request.layoutJSON));

        if (!this.useRealApi) {
            return this.mockSave(request);
        }

        const url = `${this.apiBase}/api/v2/FormConfig/save-form-config`;
        console.log('[FormConfigApi] ðŸŒ POST:', url);

        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  COMBO: Step 1 + Step 2 (Táº¡o form â†’ LÆ°u config)
    // ================================================================

    /**
     * Flow Ä‘áº§y Ä‘á»§: Táº¡o biá»ƒu máº«u trÃªn BE, rá»“i lÆ°u config.
     * DÃ¹ng trong Form Designer khi nháº¥n "LÆ°u".
     */
    saveTemplateAndConfig(exportedTemplate: any): Observable<FormConfigApiResponse> {
        const existingUUID = exportedTemplate.existingFormUUID || null;

        // â”€â”€ Náº¿u form Ä‘Ã£ tá»“n táº¡i trÃªn BE (cÃ³ UUID) â†’ bá» qua Step 1, nháº£y tháº³ng Step 2 â”€â”€
        // BE endpoint save-form chá»‰ há»— trá»£ INSERT, khÃ´ng UPDATE.
        // Gá»i láº¡i vá»›i formCode Ä‘Ã£ cÃ³ â†’ 400 FormCodeAlreadyExists.
        if (existingUUID) {
            console.log('[FormConfigApi] ðŸ”„ Form Ä‘Ã£ tá»“n táº¡i (UUID:', existingUUID, ') â†’ Bá» qua Step 1, chá»‰ lÆ°u layout config');
            return this.saveConfigOnly(existingUUID, exportedTemplate);
        }

        // â”€â”€ Form má»›i: Step 1 (táº¡o FormTemplate) â†’ Step 2 (lÆ°u config) â”€â”€
        const formCode = exportedTemplate.formId || 'NEW_TEMPLATE';
        const templateRequest: FormTemplateSaveRequest = {
            formID: null, // null = INSERT má»›i trÃªn BE
            formCode,
            formName: exportedTemplate.formName || 'Biá»ƒu máº«u má»›i',
            isActive: exportedTemplate.isActive ?? true,
            appliedEntities: (exportedTemplate.orgList || []).join(','),
        };
        console.log('[FormConfigApi] ðŸ“¤ Step 1 â€” save-form (táº¡o má»›i formCode:', formCode, ')');

        return this.saveFormTemplate(templateRequest).pipe(
            switchMap((step1Response) => {
                if (!step1Response.succeeded) {
                    console.error('[FormConfigApi] âŒ Step 1 tháº¥t báº¡i:', step1Response);
                    return of(step1Response);
                }

                console.log('[FormConfigApi] âœ… Step 1 thÃ nh cÃ´ng:', step1Response);

                // BE tráº£ data = UUID string cá»§a FormTemplate vá»«a táº¡o
                const beFormID = (typeof step1Response.data === 'string')
                    ? step1Response.data
                    : (step1Response.data?.formID || step1Response.data?.id || null);

                // ÄÄƒng kÃ½ vÃ o FormRegistry (code â†’ UUID)
                if (beFormID && formCode) {
                    this.formRegistry.registerForm(formCode, beFormID);
                }

                return this.saveConfigOnly(beFormID || formCode, exportedTemplate);
            }),
            catchError((err) => {
                console.error('[FormConfigApi] âŒ Lá»—i trong flow save:', err);
                const errBody = err.error;
                const serverMsg = errBody?.Message ?? errBody?.message ?? err.message ?? 'Unknown error';
                return of({
                    succeeded: false,
                    message: 'Lá»—i káº¿t ná»‘i server',
                    data: null,
                    errors: [serverMsg],
                    statusCode: err.status || 500,
                    errorCode: 0,
                });
            }),
        );
    }

    /**
     * Chá»‰ lÆ°u FormConfig (layout) vá»›i formID Ä‘Ã£ biáº¿t.
     * DÃ¹ng khi UPDATE form Ä‘Ã£ tá»“n táº¡i (bá» qua bÆ°á»›c táº¡o FormTemplate).
     */
    private saveConfigOnly(formID: string, exportedTemplate: any): Observable<FormConfigApiResponse> {
        const configRequest = this.mapper.toSaveRequest(exportedTemplate);
        configRequest.formID = formID;

        console.log('[FormConfigApi] ðŸ“¤ save-form-config (formID:', formID, ')');
        return this.saveFormConfigDirect(configRequest).pipe(
            map(response => ({
                ...response,
                // Propagate formID so component can store it for future updates
                data: formID,
            })),
        );
    }


    /**
     * LÆ°u config trá»±c tiáº¿p (dÃ¹ng request Ä‘Ã£ transform sáºµn).
     */
    saveFormConfigDirect(request: FormConfigSaveRequest): Observable<FormConfigApiResponse> {
        if (!this.useRealApi) {
            return this.mockSave(request);
        }

        const url = `${this.apiBase}/api/v2/FormConfig/save-form-config`;
        console.log('[FormConfigApi] ðŸŒ POST save-form-config:', url);
        return this.postAndNormalize(url, request);
    }

    // ================================================================
    //  LOAD FORM (GET â€” cho Data Entry)
    // ================================================================

    /**
     * Load form data tá»« BE.
     * GET /api/v2/PlanningData/load-form?formId=...&entityCode=...&year=...
     */
    loadForm(params: LoadFormParams): Observable<FormConfigApiResponse> {
        console.log('[FormConfigApi] ðŸ“¥ load-form:', params);

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
        console.log('[FormConfigApi] ðŸ”¶ Mock save:', request.formID, 'â€”', request.mappings.length, 'mappings');
        return of({
            succeeded: true,
            message: 'Mock: LÆ°u thÃ nh cÃ´ng',
            data: { formID: request.formID },
            errors: [],
            statusCode: 200,
            errorCode: 0,
        }).pipe(delay(500));
    }
}
