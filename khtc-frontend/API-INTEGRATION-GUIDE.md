# 🚀 **API INTEGRATION GUIDE - HỆ THỐNG KẾ HOẠCH TÀI CHÍNH**

## 📋 **TỔNG QUAN API DESIGN**

Dựa trên database schema trong `main.tex`, hệ thống cần **5 API endpoints chính:**

### **🔥 1. LOAD FORM DATA (API chính)**
```typescript
POST /api/planning/load-form-data
Content-Type: application/json

Request: {
  formID: "F01_CP_IPP",
  orgCode: "EVNNPC", 
  year: 2026,
  scenarioCode: "PLAN",
  versionCode: "V1"
}

Response: {
  accounts: DimAccount[],       // Từ bảng DIM_ACCOUNT
  formLayout: FormLayoutConfig, // Từ bảng SYS_FORM_VERSION 
  mappings: FormMapping[],      // Từ bảng SYS_FORM_MAPPING
  factData: PlanningFactData[]  // Từ bảng FACT_PLANNING_DATA
}
```

### **💾 2. SAVE CHANGES**
```typescript
POST /api/planning/save-changes
Request: {
  formContext: FormDataRequest,
  changes: [
    {
      row: 1, col: 3,
      accountCode: "BAC_GIANG_1", 
      colKey: "C_BT",
      oldValue: 1250.5,
      newValue: 1300.0
    }
  ]
}
```

### **📊 3. MASTER DATA APIs**
```typescript
GET /api/master/entities    // DIM_ENTITY
GET /api/master/accounts    // DIM_ACCOUNT  
GET /api/master/versions    // DIM_VERSION
GET /api/forms/templates    // SYS_FORM_TEMPLATE
```

## 🔄 **DATA TRANSFORMATION FLOW**

### **Backend → Frontend (Load)**
```
Database Tables → API Response → Handsontable 2D Array

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ FACT_PLANNING_  │ => │ [                │ => │ [               │
│ DATA            │    │   {              │    │   ['1', 'Bắc    │  
│                 │    │     orgCode,     │    │    Giang 1',    │
│ orgCode         │    │     accountCode, │    │    1250.5, ...],│
│ accountCode     │    │     period,      │    │   ['2', 'Bắc    │
│ period          │    │     value        │    │    Kạn 1',      │
│ value           │    │   }              │    │    1180.3, ...] │
│ ...             │    │ ]                │    │ ]               │
└─────────────────┘    └──────────────────┘    └─────────────────┘
   SQL Result            JSON Response          Handsontable Data
```

### **Frontend → Backend (Save)**
```
Handsontable Change → API Payload → Database Update

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ {               │ => │ {                │ => │ UPDATE          │
│   row: 1,       │    │   orgCode,       │    │ FACT_PLANNING_  │
│   col: 3,       │    │   accountCode,   │    │ DATA            │
│   oldVal: 1250, │    │   period,        │    │ SET Value=1300  │
│   newVal: 1300  │    │   scenarioCode,  │    │ WHERE ...       │
│ }               │    │   newValue: 1300 │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
  Handsontable           API Request            SQL Command
```

## 📁 **FILE STRUCTURE CHO BACKEND DEV**

```
backend/
├── controllers/
│   ├── PlanningController.cs
│   ├── MasterDataController.cs 
│   └── FormTemplateController.cs
├── services/
│   ├── PlanningDataService.cs
│   ├── FormMappingService.cs
│   └── DataTransformService.cs
├── models/
│   ├── DimAccount.cs
│   ├── DimEntity.cs
│   ├── FactPlanningData.cs
│   └── DTOs/
│       ├── FormDataRequest.cs
│       └── FormDataResponse.cs
└── repositories/
    ├── IPlanningRepository.cs
    └── SqlPlanningRepository.cs
```

## 🎯 **INTEGRATION STEPS**

### **PHASE 1: Mock API (DONE ✅)**
- ✅ MockApiService created
- ✅ Interface definitions match DB schema  
- ✅ Component updated to use service
- ✅ Sample JSON data files

### **PHASE 2: Real API Integration**
```typescript
// Thay MockApiService bằng HttpApiService
constructor(
  private httpClient: HttpClient,
  private apiService: PlanningHttpService  // Thay cho MockApiService
) {}

// Same interface, chỉ thay implementation
loadFormData(request: FormDataRequest): Observable<FormDataResponse> {
  return this.httpClient.post<FormDataResponse>(
    '/api/planning/load-form-data', 
    request
  );
}
```

### **PHASE 3: Error Handling & Loading States**
```typescript
// Already implemented in component:
try {
  this.dangTai.set(true);
  const response = await this.apiService.loadFormData(request).toPromise();
  // Success handling
} catch (error) {
  this.hienThiThongBao('Lỗi tải dữ liệu: ' + error.message, 'error');
} finally {
  this.dangTai.set(false);
}
```

## 🔍 **DEBUGGING & TESTING**

### **Current Status:**
- ✅ Frontend component ready
- ✅ Mock data service working
- ✅ Data transformation logic implemented
- ⏳ Backend APIs pending

### **Test với Mock Data:**
```bash
# Server đang chạy tại:
http://localhost:4200/

# Navigate to:
http://localhost:4200/app/data-entry/planning

# Console sẽ hiển thị:
📡 Loading form data with request: {...}
✅ API Data loaded: {accounts: 7, mappings: 11, factData: 24}
```

### **Khi Backend sẵn sàng:**
1. Thay `MockApiService` → `HttpApiService`
2. Update base URL trong environment
3. Add authentication headers
4. Handle real error responses

## 💡 **NOTES CHO BACKEND TEAM**

### **Database Queries cần optimize:**
```sql
-- Query 1: Load form configuration
SELECT * FROM SYS_FORM_VERSION 
WHERE FormID = @formId AND Year = @year;

-- Query 2: Load account hierarchy  
WITH AccountCTE AS (
  SELECT *, 0 as Level FROM DIM_ACCOUNT WHERE ParentID IS NULL
  UNION ALL
  SELECT a.*, c.Level + 1 FROM DIM_ACCOUNT a 
  JOIN AccountCTE c ON a.ParentID = c.AccountID
)
SELECT * FROM AccountCTE WHERE FormID = @formId;

-- Query 3: Load fact data
SELECT * FROM FACT_PLANNING_DATA 
WHERE OrgCode = @orgCode 
  AND Year = @year 
  AND ScenarioCode = @scenario
  AND VersionCode = @version;
```

### **Performance Tips:**
- Cache form templates (rarely change)
- Use indexes on composite keys
- Implement pagination for large datasets
- Consider ClickHouse for read-heavy queries

## 🎉 **READY FOR DEMO!**

Current mock setup provides:
- ✅ Realistic data structure
- ✅ Working Handsontable integration  
- ✅ Save/load simulation
- ✅ Error handling
- ✅ Loading states
- ✅ Database-compatible interfaces

**Demo flow:** Filter change → API call → Data transform → Handsontable update → User edit → Save API → Success message