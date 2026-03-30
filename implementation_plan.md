# Fix All Form Designer Issues

Sửa 5 vấn đề critical/medium của Form Designer (issue #5 multi-level header deferred vì cần thiết kế UX riêng).

## Proposed Changes

### Component: Row/Col Index Re-indexing (Issue #4 + #6)

Đây là bug quan trọng nhất — khi insert/delete dòng/cột, metadata bị lệch vì dùng row index tĩnh.

#### [MODIFY] [thiet-ke-bieu-mau.component.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts)

**Thay đổi 1: Thêm hooks `afterCreateRow`, `afterRemoveRow`, `afterCreateCol`, `afterRemoveCol`** trong [initDesigner()](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts#229-370):
- `afterCreateRow(index, amount)`: shift tất cả entries trong `rowCodeMap`, `rowCodeNameMap`, `cellMetadata` có row >= index lên +amount
- `afterRemoveRow(index, amount)`: xóa entries bị xóa, shift entries có row > index xuống -amount
- Tương tự cho cột

**Thay đổi 2: Fix [generateColCode()](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts#1219-1250) trùng code:**
- Sau khi generate code, kiểm tra xem code đã tồn tại chưa trong các cột khác
- Nếu trùng, append suffix `_1`, `_2`, etc.

---

### Component: Save to MockAPI (Issue #1)

#### [MODIFY] [thiet-ke-bieu-mau.component.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts)

- Sửa [saveTemplate()](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts#1022-1029) gọi `bieuMauService.luuTemplate()` thay vì chỉ console.log
- Truyền toàn bộ [ExportedTemplate](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts#37-53) JSON vào API

#### [MODIFY] [bieu-mau.service.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/services/bieu-mau.service.ts)

- Thêm method `luuTemplate(data: any): Promise<KetQuaApi<any>>`

#### [MODIFY] [mock-api.service.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/core/services/mock-api.service.ts)

- Thêm method `luuTemplateVaLayout(data: any)` — lưu ExportedTemplate vào memory map (key = formId)
- Thêm method `layTemplateLayout(formId: string)` — trả về ExportedTemplate đã lưu
- Dùng `Map<string, any>` để lưu trong memory (mock DB)

---

### Component: Load & Rebuild Grid (Issue #3)

#### [MODIFY] [thiet-ke-bieu-mau.component.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts)

- Thêm method `rebuildFromExportedTemplate(exported: ExportedTemplate)`:
  - Đọc `layoutJSON.columns` → set `gridCols`, column widths
  - Đọc `layoutJSON.headerRows` → tạo data rows cho header
  - Đọc `layoutJSON.rows` → tạo data rows cho body (STT, title, empty data cells)
  - Đọc `layoutJSON.mergeCells` → set merge cells
  - Đọc `layoutJSON.mappings` → rebuild `cellMetadata`, `rowCodeMap`, `columnCodeMap`
  - Đọc `fixedRowsTop`, `freezeColumns` → set freeze settings
- Sửa [loadTemplate()](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/pages/form-builder/thiet-ke-bieu-mau.component.ts#213-228) → sau khi load, check nếu có layoutJSON thì gọi rebuild

#### [MODIFY] [bieu-mau.service.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/form-designer/services/bieu-mau.service.ts)

- Thêm method `layTemplateLayout(formId: string): Promise<KetQuaApi<any>>`

#### [MODIFY] [mock-api.service.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/core/services/mock-api.service.ts)

- Implement `layTemplateLayout()` đọc từ memory map

---

### Component: Data Entry Integration (Issue #2)

#### [NEW] [layout-grid-renderer.service.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/data-entry/services/layout-grid-renderer.service.ts)

Service mới đọc [LayoutJSON](file:///d:/EVN/KHTC/khtc-frontend/src/app/core/models/layout-template.model.ts#81-97) (format V2) và tạo Handsontable config:
- `renderGrid(layoutJSON, dbData)` → `{ data[][], nestedHeaders, colWidths, columns, cells callback, mergeCells }`
- Map `dbData` (GridCellData[]) vào đúng ô bằng `rowCode×colCode`
- Support hidden columns (METADATA_ROW), freeze, merge cells
- Support header rows từ `headerRows`

#### [MODIFY] [bao-cao-ke-hoach.component.ts](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/data-entry/pages/planning-grid/bao-cao-ke-hoach.component.ts)

- Inject `LayoutGridRendererService`
- Trong [taiForm()](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/data-entry/pages/planning-grid/bao-cao-ke-hoach.component.ts#123-142): detect format V2 (khi [loadFormV2()](file:///d:/EVN/KHTC/khtc-frontend/src/app/features/data-entry/services/planning-api.service.ts#169-188) trả data hợp lệ) → dùng renderer mới
- Thêm nút "Nạp mẫu V2 (layout)" trên panel test hoặc tự detect khi chọn biểu mẫu

---

## Verification Plan

### Browser Testing

1. **Test Issue #4 (Row Index Bug)**:
   - Mở `http://localhost:4201/#/app/form-designer/builder`
   - Nhập chỉ tiêu dòng (qua dialog "Chỉ tiêu dòng")
   - Click chuột phải vào giữa bảng → "Insert row above"
   - Kiểm tra: chỉ tiêu dòng vẫn hiển thị đúng, không bị dịch
   
2. **Test Issue #1 + #3 (Save & Load)**:
   - Tạo mẫu trên Form Designer, thêm header + data
   - Bấm "Lưu biểu mẫu" → kiểm tra console log có "Đã lưu" 
   - Bấm "Copy JSON" → verify JSON có đủ layoutJSON
   - Reload page → kiểm tra mẫu load lại đúng cấu trúc

3. **Test Issue #2 (Data Entry)**:
   - Mở `http://localhost:4201/#/app/data-entry/planning`
   - Chọn biểu mẫu "Biểu mẫu mới — Layout colCode/rowCode"
   - Kiểm tra: grid hiển thị đúng cột, dòng, header + merge + data values từ dbData

### Manual Testing (PM)
- Sau khi deploy, PM test lại toàn bộ flow: Thiết kế → Lưu → Load lại → Người dùng đơn vị mở và nhập liệu
