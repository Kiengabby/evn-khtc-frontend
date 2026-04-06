// ============================================
// Page: Error (Server/Unexpected Error)
// ============================================
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    standalone: true,
    imports: [RouterModule],
    template: `
    <div class="error-page">
      <div class="error-content">
        <span class="error-code">500</span>
        <h1>Đã xảy ra lỗi</h1>
        <p>Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại sau hoặc liên hệ quản trị viên.</p>
        <a class="btn-home" routerLink="/app/dashboard">
          <i class="pi pi-home"></i> Về trang chủ
        </a>
      </div>
    </div>
  `,
    styles: [`
    .error-page {
      display: flex; align-items: center; justify-content: center;
      min-height: 70vh; text-align: center;
    }
    .error-content { max-width: 420px; }
    .error-code {
      font-size: 5rem; font-weight: 800; color: #FDECEA;
      line-height: 1;
    }
    h1 { font-size: 1.5rem; font-weight: 700; color: #2D3748; margin: 12px 0 8px; }
    p { color: #8A94A6; font-size: 0.9375rem; margin-bottom: 24px; }
    .btn-home {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 24px; background: #1E38C3; color: white;
      border-radius: 8px; text-decoration: none; font-weight: 500;
      font-size: 0.875rem;
      &:hover { filter: brightness(1.1); }
    }
  `]
})
export class ErrorPageComponent { }
