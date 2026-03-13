// ============================================
// Page: Danh sách Biểu mẫu (Template List)
// ============================================
// Hiển thị danh sách form template — Tìm kiếm, thêm/sửa/xóa, link sang builder.
//
// === LUỒNG DỮ LIỆU ===
// Component → BieuMauService → MockApiService → form-templates.json
// ============================================

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BieuMauService } from '../../services/bieu-mau.service';
import { FormTemplate, FormTemplateTaoMoi, FormLayoutSummary } from '../../../../core/models/form-template.model';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './danh-sach-bieu-mau.component.html',
    styleUrl: './danh-sach-bieu-mau.component.scss',
})
export class DanhSachBieuMauComponent implements OnInit {

    private bieuMauService = inject(BieuMauService);
    private router = inject(Router);

    // === State ===
    danhSach = signal<FormTemplate[]>([]);
    dangTai = signal(false);
    hienDialog = signal(false);
    dangSua = signal(false);
    dangLuu = signal(false);
    loiForm = signal<string | null>(null);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    tuKhoa = '';
    form: any = this.formMacDinh();
    private formIdDangSua: string | null = null;
    private timerTimKiem: any;

    async ngOnInit(): Promise<void> { await this.taiDuLieu(); }

    // === LOAD ===
    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const kq = await this.bieuMauService.layDanhSach({
                tuKhoa: this.tuKhoa || undefined,
            });
            if (kq.trangThai) {
                this.danhSach.set(kq.duLieu);
            }
        } catch {
            this.danhSach.set([]);
        }
        this.dangTai.set(false);
    }

    onTimKiem(): void {
        clearTimeout(this.timerTimKiem);
        this.timerTimKiem = setTimeout(() => this.taiDuLieu(), 300);
    }

    // === THÊM / SỬA ===
    moFormThemMoi(): void {
        this.form = this.formMacDinh();
        this.formIdDangSua = null;
        this.dangSua.set(false);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    moFormSua(bm: FormTemplate): void {
        this.form = {
            formId: bm.formId,
            formName: bm.formName,
            orgListStr: bm.orgList.join(', '),
            isDynamicRow: bm.isDynamicRow,
            layoutType: bm.layoutConfig?.type || 'financial_planning',
            freezeColumns: bm.layoutConfig?.freezeColumns ?? 2,
        };
        this.formIdDangSua = bm.formId;
        this.dangSua.set(true);
        this.loiForm.set(null);
        this.hienDialog.set(true);
    }

    async luuBieuMau(): Promise<void> {
        if (!this.form.formId?.trim()) { this.loiForm.set('Vui lòng nhập mã biểu mẫu'); return; }
        if (!this.form.formName?.trim()) { this.loiForm.set('Vui lòng nhập tên biểu mẫu'); return; }

        this.dangLuu.set(true);
        const orgList = this.form.orgListStr
            ? this.form.orgListStr.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];

        const layoutConfig: FormLayoutSummary = {
            type: this.form.layoutType,
            allowDynamicRows: this.form.isDynamicRow,
            freezeColumns: this.form.freezeColumns,
        };

        try {
            if (this.dangSua() && this.formIdDangSua) {
                const kq = await this.bieuMauService.capNhat(this.formIdDangSua, {
                    formName: this.form.formName,
                    orgList,
                    isDynamicRow: this.form.isDynamicRow,
                    layoutConfig,
                });
                if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
                this.hienThongBao(kq.thongBao, 'success');
            } else {
                const dto: FormTemplateTaoMoi = {
                    formId: this.form.formId,
                    formName: this.form.formName,
                    orgList,
                    isDynamicRow: this.form.isDynamicRow,
                    layoutConfig,
                };
                const kq = await this.bieuMauService.taoMoi(dto);
                if (!kq.trangThai) { this.loiForm.set(kq.thongBao); this.dangLuu.set(false); return; }
                this.hienThongBao(kq.thongBao, 'success');
            }
            await this.taiDuLieu();
            this.dongDialog();
        } catch {
            this.loiForm.set('Đã xảy ra lỗi hệ thống');
        }
        this.dangLuu.set(false);
    }

    // === XÓA ===
    async xacNhanXoa(bm: FormTemplate): Promise<void> {
        if (!confirm(`Xóa biểu mẫu "${bm.formName}"?`)) return;
        const kq = await this.bieuMauService.xoa(bm.formId);
        if (kq.trangThai) {
            this.hienThongBao(kq.thongBao, 'success');
            await this.taiDuLieu();
        } else {
            this.hienThongBao(kq.thongBao, 'error');
        }
    }

    // === NAVIGATION ===
    moThietKe(formId: string): void {
        this.router.navigate(['/app/form-designer/builder', formId]);
    }

    // === HELPERS ===
    dongDialog(): void { this.hienDialog.set(false); this.loiForm.set(null); }

    private formMacDinh() {
        return {
            formId: '',
            formName: '',
            orgListStr: 'EVNNPC, EVNCPC, EVNSPC',
            isDynamicRow: false,
            layoutType: 'financial_planning',
            freezeColumns: 2,
        };
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3000);
    }
}
