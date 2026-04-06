// ============================================
// Sidebar — Narrow Icon Style (EVN Workflow)
// 72px wide, icon + small label, blue active border
// Khi thuNho = true → sidebar ẩn (width: 0)
// ============================================
import { Component, signal, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../apps/service/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: { label: string; route: string }[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  // Input: sidebar thu nhỏ hay không (nhận từ MainLayout)
  thuNho = input(false);
  activeGroup: string | null = null;
  activeChildren: { label: string; route: string }[] = [];

  navItems: NavItem[] = [
    // --- Core workflow ---
    { label: 'Tổng quan', icon: 'pi-th-large', route: '/app/dashboard' },
    { label: 'Tạo báo cáo', icon: 'pi-plus-circle', route: '/app/report-wizard' },
    { label: 'Biểu mẫu', icon: 'pi-list', route: '/app/form-designer/templates' },
    { label: 'Nhập liệu', icon: 'pi-file-edit', route: '/app/data-entry/planning' },
    {
      label: 'Phê duyệt',
      icon: 'pi-check-square',
      children: [
        { label: 'Hồ sơ đã nộp', route: '/app/workflow/submissions' },
        { label: 'Duyệt báo cáo', route: '/app/workflow/inbox' },
      ]
    },
    // --- Analytics ---
    {
      label: 'Báo cáo',
      icon: 'pi-chart-bar',
      children: [
        { label: 'Chênh lệch kế hoạch', route: '/app/analytics/variance' },
        { label: 'Hợp nhất đơn vị', route: '/app/analytics/consolidation' },
      ]
    },
    // --- Admin ---
    {
      label: 'Cài đặt',
      icon: 'pi-cog',
      children: [
        { label: 'Chỉ tiêu', route: '/app/metadata/accounts' },
        { label: 'Đơn vị', route: '/app/metadata/entities' },
        { label: 'Phiên bản', route: '/app/metadata/versions' },
        { label: 'Người dùng', route: '/app/admin/users' },
        { label: 'Nhóm quyền', route: '/app/admin/roles' },
      ]
    },
  ];

  selectGroup(item: NavItem): void {
    if (this.activeGroup === item.label) {
      this.activeGroup = null;
      this.activeChildren = [];
    } else {
      this.activeGroup = item.label;
      this.activeChildren = item.children || [];
    }
  }
}
