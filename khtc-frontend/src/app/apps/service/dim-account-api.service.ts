// ============================================
// DimAccountApiService
// Gọi API thật: POST /api/v2/DimAccount/get-tree
//
// Transform cây ch�0 tiêu từ BE �  IndicatorGroup[]
// dùng cho dialog chọn ch�0 tiêu trong Form Designer.
//
// Response BE (.NET PascalCase �ã lowercase sẵn):
//   { succeeded, data: AccountNode[], statusCode }
//
// AccountNode:
//   { accountId, accountCode, accountName, parentAccountId, children: AccountNode[] }
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, tap, shareReplay } from 'rxjs';
import { ConfigService } from '../../core/app-config.service';

// ���� BE Response Interfaces ����

export interface AccountNode {
  accountId: string;
  accountCode: string;
  accountName: string;
  parentAccountId: string | null;
  children: AccountNode[];
}

interface DimAccountApiResponse {
  succeeded: boolean;
  message: string | null;
  data: AccountNode[];
  errors: string[] | null;
  statusCode: number;
  errorCode: number;
}

// ���� FE Indicator Interfaces (kh�:p v�:i thiet-ke-bieu-mau.component.ts) ����

export interface IndicatorItem {
  code: string;
  name: string;
  type?: string;
  level?: number;
  isGroupHeader?: boolean;
  /** UUID từ BE � dùng cho mapping chính xác */
  accountId?: string;
}

export interface IndicatorGroup {
  group: string;
  items: IndicatorItem[];
}

@Injectable({ providedIn: 'root' })
export class DimAccountApiService {

  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  /** Cache Observable � tránh gọi API nhiều lần */
  private cache$: Observable<IndicatorGroup[]> | null = null;

  private get apiBase(): string {
    return this.configService.apiBaseUrl;
  }

  // ================================================================
  //  PUBLIC: Lấy cây ch�0 tiêu dư�:i dạng IndicatorGroup[]
  // ================================================================

  /**
   * Gọi API GET-TREE và transform thành IndicatorGroup[].
   * Kết quả �ược cache (shareReplay) � ch�0 gọi API 1 lần.
   *
   * M�i root account �  1 IndicatorGroup
   *   group = accountName (VD: "T�NG DOANH THU")
   *   items = [root(level=0), child1(level=1), child2(level=1), grandchild(level=2), ...]
   */
  loadAccountTree(): Observable<IndicatorGroup[]> {
    if (this.cache$) return this.cache$;

    const url = `${this.apiBase}/api/v2/DimAccount/get-tree`;
    console.log('[DimAccountApi] �xR� POST:', url);

    this.cache$ = this.http.post<DimAccountApiResponse>(url, {}).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          console.warn('[DimAccountApi] �a�️ API returned succeeded=false');
          return [];
        }

        console.log('[DimAccountApi] �S& Received', response.data.length, 'root accounts');
        return this.transformToIndicatorGroups(response.data);
      }),
      tap(groups => {
        const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
        console.log('[DimAccountApi] �x9 Transformed:', groups.length, 'groups,', totalItems, 'items total');
      }),
      catchError(err => {
        console.error('[DimAccountApi] �R API error:', err);
        this.cache$ = null; // Cho phép retry lần sau
        return of([]);
      }),
      shareReplay(1),
    );

    return this.cache$;
  }

  /**
   * Xóa cache � dùng khi cần reload dữ li�!u m�:i từ BE.
   */
  clearCache(): void {
    this.cache$ = null;
  }

  /**
   * Lấy flat list tất cả AccountNode (không phân cấp).
   * Hữu ích cho lookup nhanh theo accountCode.
   */
  loadFlatList(): Observable<AccountNode[]> {
    const url = `${this.apiBase}/api/v2/DimAccount/get-tree`;
    return this.http.post<DimAccountApiResponse>(url, {}).pipe(
      map(response => {
        if (!response.succeeded || !response.data) return [];
        return this.flattenTree(response.data);
      }),
      catchError(() => of([])),
    );
  }

  // ================================================================
  //  PRIVATE: Transform Logic
  // ================================================================

  /**
   * ChuyỒn ��"i AccountNode[] (tree) �  IndicatorGroup[] (flat groups).
   *
   * VD:
   *   AccountNode: { code: "DT", name: "T�NG DOANH THU", children: [DT_BH, DT_TC] }
   *   � 
   *   IndicatorGroup: {
   *     group: "T�NG DOANH THU",
   *     items: [
   *       { code: "DT", name: "T�NG DOANH THU", level: 0 },
   *       { code: "DT_BH", name: "Doanh thu bán hàng...", level: 1 },
   *       { code: "DT_TC", name: "Doanh thu hoạt ��"ng tài chính", level: 1 },
   *     ]
   *   }
   */
  private transformToIndicatorGroups(roots: AccountNode[]): IndicatorGroup[] {
    const groups: IndicatorGroup[] = [];

    for (const root of roots) {
      const items: IndicatorItem[] = [];

      // Recursively flatten the tree into items with levels
      this.flattenNode(root, 0, items);

      groups.push({
        group: root.accountName,
        items,
      });
    }

    return groups;
  }

  /**
   * Flatten 1 AccountNode + children thành mảng IndicatorItem[].
   * Pre-order traversal: parent trư�:c, children sau.
   */
  private flattenNode(node: AccountNode, level: number, items: IndicatorItem[]): void {
    items.push({
      code: node.accountCode,
      name: node.accountName,
      level,
      accountId: node.accountId,
    });

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.flattenNode(child, level + 1, items);
      }
    }
  }

  /**
   * Flatten toàn b�" tree thành flat list.
   */
  private flattenTree(nodes: AccountNode[]): AccountNode[] {
    const result: AccountNode[] = [];
    const walk = (list: AccountNode[]) => {
      for (const node of list) {
        result.push(node);
        if (node.children?.length) walk(node.children);
      }
    };
    walk(nodes);
    return result;
  }
}
