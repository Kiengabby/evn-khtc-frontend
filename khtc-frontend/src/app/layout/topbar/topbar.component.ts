// ============================================
// Topbar — Blue bar + White search (EVN Workflow)
// ============================================
import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './topbar.component.html',
    styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  authService = inject(AuthService);
  onMenuToggle = output<void>();
  showMenu = false;
  searchQuery = '';

  logout(): void {
    this.showMenu = false;
    this.authService.logout();
  }
}
