// ============================================
// DimAccountApiService
// Gọi API thật: /api/v2/DimAccount/*
//
// Các endpoint:
//   POST /get-tree              → Lấy cây chỉ tiêu
//   POST /create                → Tạo mới chỉ tiêu
//   PUT  /update/{id}           → Cập nhật chỉ tiêu
//   DELETE /delete/{id}         → Xóa chỉ tiêu
//
// Backend response format:
//   { succeeded, message, data, errors, statusCode, errorCode }
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, tap, shareReplay, firstValueFrom } from 'rxjs';
import { ConfigService } from '../../core/app-config.service';

// ─── BE Response Wrapper ───────────────────────────────────────────────────

export interface BeApiResponse<T> {
  succeeded: boolean;
  message: string | null;
  data: T;
  errors: string[] | null;
  statusCode: number;
  errorCode: number;
}

// ─── AccountNode: Node trong cây chỉ tiêu (từ GET-TREE) ───────────────────

export interface AccountNode {
  accountId: string;               // UUID — primary key
  accountCode: string;             // Mã chỉ tiêu (VD: "DT_BAN_DIEN")
  accountName: string;             // Tên chỉ tiêu (VD: "Doanh thu bán điện")
  parentAccountId: string | null;  // UUID của chỉ tiêu cha (null nếu là gốc)
  accountType: number;             // Loại tài khoản: 0=Thường, 1=Nhóm
  dataStorage: string;             // Loại lưu trữ: "STORE" | "DYNAMIC_CALC" | "LABEL_ONLY"
  formula: string | null;          // Công thức (nếu DYNAMIC_CALC)
  unit: string;                    // Đơn vị tính (VD: "Tỷ đồng")
  orderIndex: number;              // Thứ tự hiển thị
  children: AccountNode[];         // Danh sách chỉ tiêu con
}

// ─── AccountNode mở rộng khi đã flatten (bổ sung depth và parent info) ────

export interface FlatAccountNode extends AccountNode {
  depth: number;                   // Cấp độ trong cây (0=gốc, 1=con, ...)
  parentCode: string | null;       // accountCode của cha (để hiển thị)
}

// ─── DTOs gửi lên Backend ─────────────────────────────────────────────────

export interface DimAccountCreateDto {
  accountCode: string;
  accountName: string;
  parentAccountId: string | null;
  accountType: number;
  dataStorage: string;
  formula: string;
  unit: string;
  orderIndex: number;
}

export type DimAccountUpdateDto = DimAccountCreateDto;

// ─── FE Indicator Interfaces (dùng cho Form Designer) ────────────────────

export interface IndicatorItem {
  code: string;
  name: string;
  type?: string;
  level?: number;
  isGroupHeader?: boolean;
  /** UUID từ BE — dùng cho mapping chính xác */
  accountId?: string;
}

export interface IndicatorGroup {
  group: string;
  items: IndicatorItem[];
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DimAccountApiService {

  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  /** Cache Observable — tránh gọi API nhiều lần */
  private cache$: Observable<IndicatorGroup[]> | null = null;

  private get apiBase(): string {
    return this.configService.apiBaseUrl;
  }

  private get endpoint(): string {
    return `${this.apiBase}/api/v2/DimAccount`;
  }

  // =====================================================================
  //  PUBLIC: Lấy cây chỉ tiêu dưới dạng IndicatorGroup[] (cho Form Designer)
  // =====================================================================

  /**
   * Gọi API GET-TREE và transform thành IndicatorGroup[].
   * Kết quả được cache (shareReplay) — chỉ gọi API 1 lần.
   */
  loadAccountTree(): Observable<IndicatorGroup[]> {
    if (this.cache$) return this.cache$;

    const url = `${this.endpoint}/get-tree`;
    console.log('[DimAccountApi] 🌐 POST:', url);

    this.cache$ = this.http.post<BeApiResponse<AccountNode[]>>(url, {}).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          console.warn('[DimAccountApi] ⚠️ API returned succeeded=false');
          return [];
        }
        console.log('[DimAccountApi] ✅ Received', response.data.length, 'root accounts');
        return this.transformToIndicatorGroups(response.data);
      }),
      tap(groups => {
        const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
        console.log('[DimAccountApi] 📊 Transformed:', groups.length, 'groups,', totalItems, 'items total');
      }),
      catchError(err => {
        console.error('[DimAccountApi] ❌ API error:', err);
        this.cache$ = null;
        return of([]);
      }),
      shareReplay(1),
    );

    return this.cache$;
  }

  // =====================================================================
  //  PUBLIC: Lấy flat list (cho trang Quản lý Chỉ tiêu)
  // =====================================================================

  /**
   * Gọi API GET-TREE và flatten thành mảng có depth + parentCode.
   * Không cache — dùng khi cần dữ liệu mới nhất.
   */
  async getFlatList(): Promise<FlatAccountNode[]> {
    const url = `${this.endpoint}/get-tree`;
    try {
      const response = await firstValueFrom(
        this.http.post<BeApiResponse<AccountNode[]>>(url, {})
      );
      if (!response.succeeded || !response.data) return [];

      // Build map accountId → accountCode để tra cứu cha
      const codeMap = new Map<string, string>();
      this.buildCodeMap(response.data, codeMap);

      // Flatten tree → flat list có depth và parentCode
      const result: FlatAccountNode[] = [];
      this.flattenWithDepth(response.data, 0, codeMap, result);
      return result;
    } catch (err) {
      console.error('[DimAccountApi] getFlatList error:', err);
      return [];
    }
  }

  // =====================================================================
  //  PUBLIC: CRUD
  // =====================================================================

  /**
   * Tạo chỉ tiêu mới.
   * @returns accountId (UUID) của chỉ tiêu vừa tạo, hoặc null nếu lỗi.
   */
  async create(dto: DimAccountCreateDto): Promise<{ ok: boolean; id?: string; message?: string }> {
    const url = `${this.endpoint}/create`;
    try {
      const response = await firstValueFrom(
        this.http.post<BeApiResponse<string>>(url, dto)
      );
      if (response.succeeded) {
        this.clearCache();
        return { ok: true, id: response.data };
      }
      return { ok: false, message: response.message ?? 'Tạo mới thất bại' };
    } catch (err: any) {
      return { ok: false, message: err?.error?.message ?? 'Lỗi kết nối máy chủ' };
    }
  }

  /**
   * Cập nhật chỉ tiêu theo ID (UUID).
   */
  async update(id: string, dto: DimAccountUpdateDto): Promise<{ ok: boolean; message?: string }> {
    const url = `${this.endpoint}/update/${id}`;
    try {
      const response = await firstValueFrom(
        this.http.put<BeApiResponse<boolean>>(url, dto)
      );
      if (response.succeeded) {
        this.clearCache();
        return { ok: true, message: response.message ?? 'Cập nhật thành công' };
      }
      return { ok: false, message: response.message ?? 'Cập nhật thất bại' };
    } catch (err: any) {
      return { ok: false, message: err?.error?.message ?? 'Lỗi kết nối máy chủ' };
    }
  }

  /**
   * Xóa chỉ tiêu theo ID (UUID).
   */
  async delete(id: string): Promise<{ ok: boolean; message?: string }> {
    const url = `${this.endpoint}/delete/${id}`;
    try {
      const response = await firstValueFrom(
        this.http.delete<BeApiResponse<boolean>>(url)
      );
      if (response.succeeded) {
        this.clearCache();
        return { ok: true, message: response.message ?? 'Xóa thành công' };
      }
      return { ok: false, message: response.message ?? 'Xóa thất bại' };
    } catch (err: any) {
      return { ok: false, message: err?.error?.message ?? 'Lỗi kết nối máy chủ' };
    }
  }

  /**
   * Xóa cache — dùng khi cần reload dữ liệu mới từ BE.
   */
  clearCache(): void {
    this.cache$ = null;
  }

  // =====================================================================
  //  PRIVATE: Transform Logic
  // =====================================================================

  /** Build map: accountId → accountCode để tra cứu nhanh */
  private buildCodeMap(nodes: AccountNode[], map: Map<string, string>): void {
    for (const node of nodes) {
      map.set(node.accountId, node.accountCode);
      if (node.children?.length) this.buildCodeMap(node.children, map);
    }
  }

  /** Flatten cây thành mảng có depth và parentCode (pre-order) */
  private flattenWithDepth(
    nodes: AccountNode[],
    depth: number,
    codeMap: Map<string, string>,
    result: FlatAccountNode[]
  ): void {
    for (const node of nodes) {
      result.push({
        ...node,
        depth,
        parentCode: node.parentAccountId ? (codeMap.get(node.parentAccountId) ?? null) : null,
      });
      if (node.children?.length) {
        this.flattenWithDepth(node.children, depth + 1, codeMap, result);
      }
    }
  }

  /** Chuyển đổi AccountNode[] (tree) → IndicatorGroup[] (flat groups, cho Form Designer) */
  private transformToIndicatorGroups(roots: AccountNode[]): IndicatorGroup[] {
    const groups: IndicatorGroup[] = [];
    for (const root of roots) {
      const items: IndicatorItem[] = [];
      this.flattenNode(root, 0, items);
      groups.push({ group: root.accountName, items });
    }
    return groups;
  }

  /** Flatten 1 AccountNode + children thành IndicatorItem[] (pre-order) */
  private flattenNode(node: AccountNode, level: number, items: IndicatorItem[]): void {
    items.push({
      code: node.accountCode,
      name: node.accountName,
      level,
      accountId: node.accountId,
    });
    if (node.children?.length) {
      for (const child of node.children) {
        this.flattenNode(child, level + 1, items);
      }
    }
  }
}
