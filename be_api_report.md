# API Specification — Hệ Thống Nhập Liệu Kế Hoạch Tài Chính
## Tài liệu yêu cầu kỹ thuật gửi Backend Team

**Ngày:** 06/04/2026  
**Phiên bản:** 1.0  
**Phân loại:** Technical Specification  
**Trạng thái:** Cần triển khai

---

## 1. BỐI CẢNH & VẤN ĐỀ XÁC NHẬN

### 1.1 Mô tả vấn đề

Hệ thống hiện tại tồn tại **lỗi nghiêm trọng** trong luồng nhập liệu kế hoạch: người dùng nhập dữ liệu và lưu thành công, nhưng khi tải lại biểu mẫu, toàn bộ dữ liệu đã nhập **biến mất** — tất cả ô trả về giá trị `0`.

### 1.2 Bằng chứng kỹ thuật

**Luồng test:** Ngày 06/04/2026, form `EVNICT`, năm 2026, kỳ `Kỳ 1`, kịch bản `Kế hoạch`

**Bước 1 — Gọi Save API:**
```http
POST /api/v2/PlanningData/save-submission
Content-Type: application/json

{
  "submissionId": 0,
  "entityCode": "EVN",
  "jsonData": "{
    \"formCode\": \"EVNICT\",
    \"year\": 2026,
    \"period\": \"Kỳ 1\",
    \"scenario\": \"Kế hoạch\",
    \"cells\": [
      { \"rowCode\": \"NV\",       \"colCode\": \"SL_T1\", \"value\": 360 },
      { \"rowCode\": \"NV_NO\",    \"colCode\": \"SL_T1\", \"value\": 124 },
      { \"rowCode\": \"NV_VCSH\",  \"colCode\": \"SL_T1\", \"value\": 124 },
      { \"rowCode\": \"NV_NO_DH\", \"colCode\": \"SL_T1\", \"value\": 112 }
    ]
  }"
}
```

**Response BE:** `200 OK` — `{ "message": "Lưu bản nháp thành công" }` ✅

**Bước 2 — Gọi Load API (cùng tham số):**
```http
GET /api/v2/PlanningData/load-form
  ?formCode=EVNICT&year=2026&entityCode=EVN&period=Kỳ 1&scenario=Kế hoạch
```

**Response BE — tất cả 72 ô đều `value: 0`** ❌
```json
{ "rowCode": "NV",       "colCode": "SL_T1", "value": 0 }
{ "rowCode": "NV_NO",    "colCode": "SL_T1", "value": 0 }
{ "rowCode": "NV_VCSH",  "colCode": "SL_T1", "value": 0 }
{ "rowCode": "NV_NO_DH", "colCode": "SL_T1", "value": 0 }
```

### 1.3 Kết luận chẩn đoán

API `save-submission` đang ghi dữ liệu vào **bảng draft/submission**, trong khi `load-form` đọc từ **bảng fact data riêng biệt**. Hai bảng này **không kết nối với nhau**, dẫn đến dữ liệu người dùng nhập vào không thể truy xuất lại được.

---

## 2. THIẾT KẾ KIẾN TRÚC ĐỀ XUẤT

### 2.1 Vòng đời dữ liệu (Data Lifecycle)

Tham chiếu mô hình chuẩn của các hệ thống hoạch định tài chính doanh nghiệp (SAP BPC, Oracle Hyperion, IBM Planning Analytics):

```
┌───────────────────────────────────────────────────────────────────┐
│                     DATA LIFECYCLE                                │
│                                                                   │
│  [NHẬP LIỆU]   [LƯU NHÁP]   [NỘP BÁO CÁO]   [PHÊ DUYỆT]        │
│       │             │              │                │              │
│       ▼             ▼              ▼                ▼              │
│    EDITING ──► DRAFT ──────► SUBMITTED ──────► APPROVED           │
│                  │                                  │              │
│                  │◄── Trả về để sửa ───────────────┘              │
│                  │         (REJECTED)                              │
│                                                                   │
│  Mỗi trạng thái lưu bản ghi riêng, load-form hiển thị bản        │
│  mới nhất theo thứ tự ưu tiên: DRAFT > SUBMITTED > APPROVED       │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Cấu trúc bảng dữ liệu đề xuất

```sql
-- Bảng lưu trữ dữ liệu nhập liệu theo vòng đời
PlanningSubmission (
  id              BIGINT PRIMARY KEY,
  formCode        VARCHAR(50),
  entityCode      VARCHAR(50),
  year            INT,
  period          VARCHAR(20),
  scenario        VARCHAR(50),
  status          ENUM('DRAFT','SUBMITTED','APPROVED','REJECTED'),
  createdAt       DATETIME,
  createdBy       VARCHAR(100),
  lastModifiedAt  DATETIME,
  lastModifiedBy  VARCHAR(100),
  submittedAt     DATETIME NULL,
  approvedAt      DATETIME NULL,
  approvedBy      VARCHAR(100) NULL,
  rejectReason    NVARCHAR(500) NULL
)

PlanningSubmissionCell (
  id              BIGINT PRIMARY KEY,
  submissionId    BIGINT FK → PlanningSubmission.id,
  rowCode         VARCHAR(50),
  colCode         VARCHAR(50),
  value           DECIMAL(18,4),
  formula         NVARCHAR(200) NULL,
  isReadOnly      BIT
)
```

---

## 3. ĐẶC TẢ API CHI TIẾT

### 3.1 Quy ước chung

**Base URL:** `https://{host}/api/v2/PlanningData`

**Response wrapper chuẩn — TẤT CẢ endpoints phải tuân thủ:**
```json
{
  "succeeded": true,
  "statusCode": 200,
  "message": "Mô tả kết quả",
  "data": { ... },
  "errors": null
}
```

**Quy ước đặt tên field:** `camelCase` cho tất cả JSON fields.

---

### 3.2 `GET /load-form` — Tải biểu mẫu và dữ liệu hiện tại

#### Mô tả
Tải layout biểu mẫu và dữ liệu nhập liệu mới nhất theo thứ tự ưu tiên:  
`DRAFT` → `SUBMITTED` → `APPROVED` → *(rỗng, value=0)*

#### Query Parameters

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `formCode` | string | ✅ | Mã biểu mẫu, VD: `EVNICT` |
| `year` | integer | ✅ | Năm kế hoạch, VD: `2026` |
| `entityCode` | string | ✅ | Mã đơn vị, VD: `EVN` |
| `period` | string | ✅ | Kỳ báo cáo, VD: `Kỳ 1`, `T1` |
| `scenario` | string | ✅ | Kịch bản, VD: `Kế hoạch` |

#### Response Body

```json
{
  "succeeded": true,
  "statusCode": 200,
  "message": null,
  "data": {
    "submissionId": 42,
    "formCode": "EVNICT",
    "formName": "Kế hoạch tài chính 2026",
    "dataStatus": "DRAFT",
    "lastModifiedAt": "2026-04-06T07:00:00Z",
    "lastModifiedBy": "nguyen.van.a@evn.com.vn",
    "submittedAt": null,
    "approvedAt": null,
    "layoutJSON": "{ ... }",
    "cells": [
      {
        "rowCode": "NV",
        "colCode": "SL_T1",
        "value": 360,
        "formula": null,
        "isReadOnly": false
      },
      {
        "rowCode": "NV_NO",
        "colCode": "SL_T1",
        "value": 124,
        "formula": null,
        "isReadOnly": false
      }
    ]
  },
  "errors": null
}
```

#### Mô tả các trường trong `data`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `submissionId` | long | ID bản ghi submission. `null` nếu chưa tồn tại |
| `formCode` | string | Mã biểu mẫu |
| `formName` | string | Tên biểu mẫu hiển thị |
| `dataStatus` | string enum | Xem bảng enum bên dưới |
| `lastModifiedAt` | ISO 8601 datetime | Thời điểm chỉnh sửa cuối cùng. `null` nếu chưa có data |
| `lastModifiedBy` | string | Email người chỉnh sửa cuối |
| `submittedAt` | ISO 8601 datetime | Thời điểm nộp. `null` nếu chưa nộp |
| `approvedAt` | ISO 8601 datetime | Thời điểm duyệt. `null` nếu chưa duyệt |
| `layoutJSON` | string (JSON) | Cấu hình layout grid |
| `cells` | array | Danh sách ô với giá trị thực tế đã lưu |

#### `dataStatus` Enum

| Giá trị | Ý nghĩa | Mô tả |
|---|---|---|
| `EMPTY` | Chưa có dữ liệu | Chưa nhập gì, cells trả về value=0 |
| `DRAFT` | Bản nháp | Đã lưu, chưa nộp |
| `SUBMITTED` | Đã nộp | Chờ phê duyệt, có thể bị trả về |
| `APPROVED` | Đã duyệt | Dữ liệu chính thức |
| `REJECTED` | Bị trả về | Cần sửa và nộp lại |

#### Logic ưu tiên khi load

```
IF EXISTS bản ghi REJECTED/DRAFT cho (formCode, year, entityCode, period, scenario):
    → Trả về bản nháp/bị trả về (để người dùng tiếp tục chỉnh sửa)
ELSE IF EXISTS bản ghi SUBMITTED:
    → Trả về bản đã nộp, dataStatus="SUBMITTED"
ELSE IF EXISTS bản ghi APPROVED:
    → Trả về bản đã duyệt, dataStatus="APPROVED"
ELSE:
    → Trả về layout + cells mặc định value=0, dataStatus="EMPTY", submissionId=null
```

---

### 3.3 `POST /save-draft` — Lưu bản nháp

> ⚠️ **Đề xuất đổi tên từ `save-submission` sang `save-draft`** để phản ánh đúng nghĩa nghiệp vụ.

#### Mô tả
Lưu hoặc cập nhật bản nháp. Nếu `submissionId = null/0` → tạo mới. Nếu có `submissionId` → cập nhật bản ghi cũ (UPSERT).

#### Request Body

```json
{
  "submissionId": 42,
  "formCode": "EVNICT",
  "year": 2026,
  "entityCode": "EVN",
  "period": "Kỳ 1",
  "scenario": "Kế hoạch",
  "cells": [
    {
      "rowCode": "NV",
      "colCode": "SL_T1",
      "value": 360,
      "formula": null,
      "isReadOnly": false
    },
    {
      "rowCode": "NV_NO",
      "colCode": "SL_T1",
      "value": 124,
      "formula": null,
      "isReadOnly": false
    }
  ]
}
```

> **Lưu ý:** `submissionId = 0` hoặc `null` = tạo submission mới. FE sẽ dùng `submissionId` trả về cho lần save tiếp theo để tránh duplicate records.

#### Response Body

```json
{
  "succeeded": true,
  "statusCode": 200,
  "message": "Lưu bản nháp thành công",
  "data": {
    "submissionId": 42,
    "savedCellCount": 48,
    "dataStatus": "DRAFT",
    "lastModifiedAt": "2026-04-06T07:00:00Z"
  },
  "errors": null
}
```

#### Mô tả các trường trong `data`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `submissionId` | long | ID submission đã tạo/cập nhật. **FE sẽ dùng ID này cho lần save tiếp** |
| `savedCellCount` | integer | Số ô thực sự được lưu vào DB |
| `dataStatus` | string | Luôn là `"DRAFT"` |
| `lastModifiedAt` | ISO 8601 | Timestamp server-side |

#### Business Rules

- Chỉ cho phép lưu nháp khi `dataStatus` là `EMPTY`, `DRAFT`, hoặc `REJECTED`
- Nếu bản ghi đang ở `SUBMITTED` hoặc `APPROVED` → trả về lỗi `403 Forbidden`

---

### 3.4 `POST /submit` — Nộp báo cáo (chờ phê duyệt)

#### Mô tả
Chuyển trạng thái submission từ `DRAFT` → `SUBMITTED`. Sau khi nộp, người dùng không thể chỉnh sửa cho đến khi bị trả về hoặc phê duyệt xong.

#### Request Body

```json
{
  "submissionId": 42,
  "comment": "Nộp kế hoạch Q1 theo yêu cầu của phòng tài chính"
}
```

#### Response Body

```json
{
  "succeeded": true,
  "statusCode": 200,
  "message": "Nộp báo cáo thành công. Đang chờ phê duyệt.",
  "data": {
    "submissionId": 42,
    "dataStatus": "SUBMITTED",
    "submittedAt": "2026-04-06T07:05:00Z",
    "submittedBy": "nguyen.van.a@evn.com.vn"
  },
  "errors": null
}
```

---

### 3.5 `GET /get-submission-status` — Truy vấn trạng thái

#### Mô tả
Trả về trạng thái nhanh mà không tải toàn bộ data/layout. Dùng để FE hiển thị badge trạng thái trong danh sách biểu mẫu.

#### Query Parameters

| Tham số | Kiểu | Bắt buộc |
|---|---|---|
| `formCode` | string | ✅ |
| `year` | integer | ✅ |
| `entityCode` | string | ✅ |
| `period` | string | ✅ |
| `scenario` | string | ✅ |

#### Response Body

```json
{
  "succeeded": true,
  "statusCode": 200,
  "message": null,
  "data": {
    "submissionId": 42,
    "dataStatus": "DRAFT",
    "lastModifiedAt": "2026-04-06T07:00:00Z",
    "lastModifiedBy": "nguyen.van.a@evn.com.vn",
    "submittedAt": null,
    "approvedAt": null,
    "rejectReason": null
  },
  "errors": null
}
```

---

### 3.6 `POST /approve` — Phê duyệt (dành cho module Phê duyệt)

#### Mô tả
Chuyển trạng thái `SUBMITTED` → `APPROVED` hoặc `REJECTED`. Chỉ người có quyền Approver mới được gọi endpoint này.

#### Request Body

```json
{
  "submissionId": 42,
  "action": "APPROVE",
  "comment": "Đã kiểm tra và phê duyệt"
}
```

> `action` enum: `"APPROVE"` | `"REJECT"`

#### Response Body

```json
{
  "succeeded": true,
  "statusCode": 200,
  "message": "Phê duyệt thành công",
  "data": {
    "submissionId": 42,
    "dataStatus": "APPROVED",
    "approvedAt": "2026-04-06T09:00:00Z",
    "approvedBy": "tran.thi.b@evn.com.vn"
  },
  "errors": null
}
```

---

## 4. QUY CHUẨN ERROR HANDLING

### 4.1 HTTP Status Codes

| Code | Tình huống |
|---|---|
| `200 OK` | Thành công |
| `400 Bad Request` | Thiếu/sai tham số. `errors` array phải mô tả rõ từng field lỗi |
| `403 Forbidden` | Không có quyền (VD: approve không phải Approver, save khi đang SUBMITTED) |
| `404 Not Found` | Không tìm thấy submissionId |
| `409 Conflict` | Xung đột nghiệp vụ (VD: submit khi đang SUBMITTED) |
| `500 Internal Server Error` | Lỗi hệ thống |

### 4.2 Error Response Format

```json
{
  "succeeded": false,
  "statusCode": 400,
  "message": "Dữ liệu đầu vào không hợp lệ",
  "data": null,
  "errors": [
    "formCode: Không được để trống",
    "year: Phải trong khoảng 2020-2030"
  ]
}
```

---

## 5. DANH SÁCH CÔNG VIỆC VÀ MỨC ĐỘ ƯU TIÊN

### 🔴 Priority 1 — Blocking (phải xong trước khi deploy)

| # | Công việc | API liên quan |
|---|---|---|
| 1.1 | `load-form` phải trả về dữ liệu từ submission/draft table theo logic ưu tiên đã mô tả | `GET /load-form` |
| 1.2 | `load-form` response phải thêm field `dataStatus`, `lastModifiedAt`, `lastModifiedBy`, `submissionId` | `GET /load-form` |
| 1.3 | `save-draft` (hiện là `save-submission`) phải trả về `submissionId` và `savedCellCount` | `POST /save-draft` |

### 🟡 Priority 2 — High (sprint này)

| # | Công việc | API liên quan |
|---|---|---|
| 2.1 | Tách `save-draft` và `submit` thành 2 endpoint riêng biệt | `POST /save-draft`, `POST /submit` |
| 2.2 | Implement `GET /get-submission-status` để FE query nhanh trạng thái | `GET /get-submission-status` |
| 2.3 | Chuẩn hóa tất cả response theo format wrapper `{ succeeded, statusCode, message, data, errors }` | Tất cả |

### 🟢 Priority 3 — Medium (backlog)

| # | Công việc | API liên quan |
|---|---|---|
| 3.1 | Implement `POST /approve` cho module Phê duyệt | `POST /approve` |
| 3.2 | Thêm `submittedAt`, `approvedAt`, `rejectReason` vào load-form response khi có data | `GET /load-form` |
| 3.3 | Thêm field `savedBy` (email người lưu) vào submission cell records | Database |

---

## 6. PHẠM VI TÁC ĐỘNG SAU KHI HOÀN THÀNH

### Frontend (không cần code thêm sau khi BE fix P1)
- ✅ Hiển thị đúng dữ liệu đã lưu khi người dùng reload/quay lại biểu mẫu
- ✅ Hiển thị badge trạng thái `Bản nháp` / `Đã nộp` / `Đã duyệt` trong header
- ✅ Hiển thị `"Lần lưu cuối: HH:mm DD/MM bởi [email]"` trong status bar
- ✅ Disable tự động nút Lưu/Nộp khi form đã ở trạng thái `SUBMITTED`/`APPROVED`
- ✅ Nút "Nộp báo cáo" sẽ active sau khi lưu nháp thành công

### Người dùng cuối
- ✅ Không còn mất dữ liệu sau khi lưu
- ✅ Hiểu rõ trạng thái hiện tại của báo cáo mình đang làm
- ✅ Luồng làm việc chuyên nghiệp: Nhập → Lưu nháp → Nộp → Phê duyệt

---

## 7. GHI CHÚ KỸ THUẬT BỔ SUNG

### 7.1 Backward Compatibility
- Endpoint `POST /save-submission` cũ có thể giữ lại (deprecated) và internally delegate sang `save-draft` mới — để không ảnh hưởng trong thời gian chuyển đổi

### 7.2 Security
- Endpoint `POST /approve` phải kiểm tra role. Chỉ người dùng có role `APPROVER` hoặc `ADMIN` mới được gọi
- Endpoint `POST /submit` phải kiểm tra người dùng đang submit có phải owner của submission không

### 7.3 Audit Trail
- Tất cả thay đổi trạng thái (DRAFT→SUBMITTED, SUBMITTED→APPROVED) cần được ghi vào bảng audit log với `userId`, `timestamp`, `action`, `oldStatus`, `newStatus`

---

*Tài liệu này được lập bởi Frontend Team dựa trên phân tích thực tế từ console log ngày 06/04/2026.*  
*Mọi thắc mắc về spec, liên hệ trực tiếp với Frontend Team để làm rõ.*
