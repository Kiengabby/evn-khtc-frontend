// ============================================
// FormRegistryService
// Quản lý mapping form code (templateId) → UUID
// Lưu vào sessionStorage để sync giữa Form Designer & Data Entry
// ============================================

import { Injectable } from '@angular/core';

interface FormRegistry {
  [formCode: string]: string; // formCode → UUID
}

const STORAGE_KEY = 'KHTC_FORM_REGISTRY';

@Injectable({ providedIn: 'root' })
export class FormRegistryService {
  private registry: FormRegistry = {};

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Đăng ký form: lưu mapping code → UUID
   * Gọi từ Form Designer sau khi tạo form thành công
   */
  registerForm(formCode: string, formUUID: string): void {
    this.registry[formCode] = formUUID;
    this.saveToStorage();
    console.log(`[FormRegistry] ✅ Registered: ${formCode} → ${formUUID}`);
  }

  /**
   * Lấy UUID của form theo code
   * Gọi từ Data Entry khi load form
   */
  getUUID(formCode: string): string | null {
    return this.registry[formCode] ?? null;
  }

  /**
   * Lấy tất cả registered forms
   */
  getAllForms(): FormRegistry {
    return { ...this.registry };
  }

  /** Xóa form từ registry */
  unregisterForm(formCode: string): void {
    delete this.registry[formCode];
    this.saveToStorage();
  }

  /** Xóa tất cả */
  clearAll(): void {
    this.registry = {};
    sessionStorage.removeItem(STORAGE_KEY);
  }

  // ── Private ──

  private loadFromStorage(): void {
    const json = sessionStorage.getItem(STORAGE_KEY);
    if (json) {
      try {
        this.registry = JSON.parse(json);
        console.log('[FormRegistry] 📥 Loaded from storage:', this.registry);
      } catch {
        console.warn('[FormRegistry] ⚠️ Failed to parse storage');
      }
    }
  }

  private saveToStorage(): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.registry));
  }
}
