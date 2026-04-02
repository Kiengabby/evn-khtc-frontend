// ============================================
// FormConfigMapperService
// Chuyển đổi ExportedTemplate (format FE) →
// FormConfigSaveRequest (format BE API v2)
//
// FE format (từ Form Designer exportToJson()):
//   { formId, formName, version: { year, layoutJSON }, ... }
//
// BE format (POST /api/v2/FormConfig/save-form-config):
//   { formID, year, layoutJSON: "string", effectiveDate, expiryDate, mappings[] }
// ============================================

import { Injectable } from '@angular/core';
import {
    FormConfigSaveRequest,
    FormConfigMappingItem,
} from '../../../core/models/form-config-api.model';

@Injectable({ providedIn: 'root' })
export class FormConfigMapperService {

    /**
     * Chuyển đổi ExportedTemplate → FormConfigSaveRequest.
     *
     * @param exported - JSON từ Form Designer (exportToJson())
     * @returns Payload sẵn sàng POST lên BE
     */
    toSaveRequest(exported: any): FormConfigSaveRequest {
        const formID = exported.formId || exported.formID || '';
        const year = exported.version?.year || new Date().getFullYear();
        const layoutJSON = exported.version?.layoutJSON;

        // ── layoutJSON: BE kỳ vọng dạng string ──
        const layoutJSONString = typeof layoutJSON === 'string'
            ? layoutJSON
            : JSON.stringify(layoutJSON);

        // ── effectiveDate / expiryDate: mặc định đầu năm → cuối năm ──
        const effectiveDate = new Date(year, 0, 1).toISOString();
        const expiryDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

        // ── mappings: chuyển từ FE format → BE format ──
        const feMappings: any[] = layoutJSON?.mappings || [];
        const mappings = this.convertMappings(feMappings);

        return {
            formID,
            year,
            layoutJSON: layoutJSONString,
            effectiveDate,
            expiryDate,
            mappings,
        };
    }

    /**
     * Chuyển FE mappings → BE mappings.
     *
     * FE mapping item:
     *   { rowKey, colKey, rowCode, colCode, cellRole, formula?, isReadOnly }
     *
     * BE mapping item:
     *   { rowCode, colCode, value, accountCode, attributeCode, formula, isReadOnly }
     */
    private convertMappings(feMappings: any[]): FormConfigMappingItem[] {
        return feMappings.map(m => ({
            rowCode: m.rowCode || '',
            colCode: m.colCode || '',
            value: m.value ?? 0,
            accountCode: m.accountCode || '',
            attributeCode: m.attributeCode || '',
            formula: m.formula || '',
            isReadOnly: m.isReadOnly ?? (m.cellRole === 'formula' || m.cellRole === 'header' || m.cellRole === 'text'),
        }));
    }
}
