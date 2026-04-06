// ============================================
// FormConfigMapperService
// Chuyá»ƒn Ä‘á»•i ExportedTemplate (format FE) â†’
// FormConfigSaveRequest (format BE API v2)
//
// FE format (tá»« Form Designer exportToJson()):
//   { formId, formName, version: { year, layoutJSON }, ... }
//
// BE format (POST /api/v2/FormConfig/save-form-config):
//   { formID, year, layoutJSON: "string", effectiveDate, expiryDate, mappings[] }
// ============================================

import { Injectable } from '@angular/core';
import {
    FormConfigSaveRequest,
    FormConfigMappingItem,
} from '../../config/models/form-config-api.model';

@Injectable({ providedIn: 'root' })
export class FormConfigMapperService {

    /**
     * Chuyá»ƒn Ä‘á»•i ExportedTemplate â†’ FormConfigSaveRequest.
     *
     * @param exported - JSON tá»« Form Designer (exportToJson())
     * @returns Payload sáºµn sÃ ng POST lÃªn BE
     */
    toSaveRequest(exported: any): FormConfigSaveRequest {
        const formID = exported.formId || exported.formID || '';
        const year = exported.version?.year || new Date().getFullYear();
        const layoutJSON = exported.version?.layoutJSON;

        // â”€â”€ layoutJSON: BE ká»³ vá»ng dáº¡ng string â”€â”€
        const layoutJSONString = typeof layoutJSON === 'string'
            ? layoutJSON
            : JSON.stringify(layoutJSON);

        // â”€â”€ effectiveDate / expiryDate: máº·c Ä‘á»‹nh Ä‘áº§u nÄƒm â†’ cuá»‘i nÄƒm â”€â”€
        const effectiveDate = new Date(year, 0, 1).toISOString();
        const expiryDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

        // â”€â”€ mappings: chuyá»ƒn tá»« FE format â†’ BE format â”€â”€
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
     * Chuyá»ƒn FE mappings â†’ BE mappings.
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
