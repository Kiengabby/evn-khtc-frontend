// ============================================
// DimAccountApiService
// Gá»i API tháº­t: POST /api/v2/DimAccount/get-tree
//
// Transform cÃ¢y chá»‰ tiÃªu tá»« BE â†’ IndicatorGroup[]
// dÃ¹ng cho dialog chá»n chá»‰ tiÃªu trong Form Designer.
//
// Response BE (.NET PascalCase Ä‘Ã£ lowercase sáºµn):
//   { succeeded, data: AccountNode[], statusCode }
//
// AccountNode:
//   { accountId, accountCode, accountName, parentAccountId, children: AccountNode[] }
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, tap, shareReplay } from 'rxjs';
import { ConfigService } from '../../core/app-config.service';

// â”€â”€ BE Response Interfaces â”€â”€

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

// â”€â”€ FE Indicator Interfaces (khá»›p vá»›i thiet-ke-bieu-mau.component.ts) â”€â”€

export interface IndicatorItem {
  code: string;
  name: string;
  type?: string;
  level?: number;
  isGroupHeader?: boolean;
  /** UUID tá»« BE â€” dÃ¹ng cho mapping chÃ­nh xÃ¡c */
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

  /** Cache Observable â€” trÃ¡nh gá»i API nhiá»u láº§n */
  private cache$: Observable<IndicatorGroup[]> | null = null;

  private get apiBase(): string {
    return this.configService.apiBaseUrl;
  }

  // ================================================================
  //  PUBLIC: Láº¥y cÃ¢y chá»‰ tiÃªu dÆ°á»›i dáº¡ng IndicatorGroup[]
  // ================================================================

  /**
   * Gá»i API GET-TREE vÃ  transform thÃ nh IndicatorGroup[].
   * Káº¿t quáº£ Ä‘Æ°á»£c cache (shareReplay) â€” chá»‰ gá»i API 1 láº§n.
   *
   * Má»—i root account â†’ 1 IndicatorGroup
   *   group = accountName (VD: "Tá»”NG DOANH THU")
   *   items = [root(level=0), child1(level=1), child2(level=1), grandchild(level=2), ...]
   */
  loadAccountTree(): Observable<IndicatorGroup[]> {
    if (this.cache$) return this.cache$;

    const url = `${this.apiBase}/api/v2/DimAccount/get-tree`;
    console.log('[DimAccountApi] ðŸŒ POST:', url);

    this.cache$ = this.http.post<DimAccountApiResponse>(url, {}).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          console.warn('[DimAccountApi] âš ï¸ API returned succeeded=false');
          return [];
        }

        console.log('[DimAccountApi] âœ… Received', response.data.length, 'root accounts');
        return this.transformToIndicatorGroups(response.data);
      }),
      tap(groups => {
        const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
        console.log('[DimAccountApi] ðŸ“‹ Transformed:', groups.length, 'groups,', totalItems, 'items total');
      }),
      catchError(err => {
        console.error('[DimAccountApi] âŒ API error:', err);
        this.cache$ = null; // Cho phÃ©p retry láº§n sau
        return of([]);
      }),
      shareReplay(1),
    );

    return this.cache$;
  }

  /**
   * XÃ³a cache â€” dÃ¹ng khi cáº§n reload dá»¯ liá»‡u má»›i tá»« BE.
   */
  clearCache(): void {
    this.cache$ = null;
  }

  /**
   * Láº¥y flat list táº¥t cáº£ AccountNode (khÃ´ng phÃ¢n cáº¥p).
   * Há»¯u Ã­ch cho lookup nhanh theo accountCode.
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
   * Chuyá»ƒn Ä‘á»•i AccountNode[] (tree) â†’ IndicatorGroup[] (flat groups).
   *
   * VD:
   *   AccountNode: { code: "DT", name: "Tá»”NG DOANH THU", children: [DT_BH, DT_TC] }
   *   â†’
   *   IndicatorGroup: {
   *     group: "Tá»”NG DOANH THU",
   *     items: [
   *       { code: "DT", name: "Tá»”NG DOANH THU", level: 0 },
   *       { code: "DT_BH", name: "Doanh thu bÃ¡n hÃ ng...", level: 1 },
   *       { code: "DT_TC", name: "Doanh thu hoáº¡t Ä‘á»™ng tÃ i chÃ­nh", level: 1 },
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
   * Flatten 1 AccountNode + children thÃ nh máº£ng IndicatorItem[].
   * Pre-order traversal: parent trÆ°á»›c, children sau.
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
   * Flatten toÃ n bá»™ tree thÃ nh flat list.
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
