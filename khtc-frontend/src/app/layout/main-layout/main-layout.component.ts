// ============================================
// Main Layout — EVN Workflow (narrow sidebar)
// ============================================
// Layout cha bọc sidebar + topbar + router-outlet
// Nút menu ☰ trên topbar sẽ thu/mở sidebar
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent, FooterComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  })
export class MainLayoutComponent {
  // Signal điều khiển sidebar thu/mở
  sidebarThuNho = signal(false);

  // Ngày hiện tại hiển thị trên breadcrumb
  ngayHienTai = this.layNgayHienTai();

  /** Toggle sidebar — được gọi khi bấm nút ☰ trên topbar */
  toggleSidebar(): void {
    this.sidebarThuNho.update(v => !v);
  }

  /** Format ngày tiếng Việt */
  private layNgayHienTai(): string {
    const now = new Date();
    const ngayTrongTuan = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${ngayTrongTuan[now.getDay()]}, ${dd}/${mm}/${now.getFullYear()}`;
  }
}
