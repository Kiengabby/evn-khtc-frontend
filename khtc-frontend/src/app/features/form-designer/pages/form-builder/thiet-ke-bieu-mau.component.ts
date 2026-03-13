// ============================================
// Page: Thiết kế Biểu mẫu (Form Builder)
// ============================================
// Hiển thị cấu trúc cột của form template, preview với Handsontable.
// Route: /app/form-designer/builder/:id
//
// === LUỒNG DỮ LIỆU ===
// ActivatedRoute.params → formId → BieuMauService → cấu hình cột → Handsontable preview
// ============================================

import {
    Component, inject, signal, OnInit, AfterViewInit, OnDestroy,
    ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Handsontable from 'handsontable';
import { BieuMauService } from '../../services/bieu-mau.service';
import { FormTemplate, ColumnDefinition } from '../../../../core/models/form-template.model';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './thiet-ke-bieu-mau.component.html',
    styleUrl: './thiet-ke-bieu-mau.component.scss',
})
export class ThietKeBieuMauComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('hotContainer') hotContainerRef!: ElementRef<HTMLDivElement>;

    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private bieuMauService = inject(BieuMauService);

    // === State ===
    bieuMau = signal<FormTemplate | null>(null);
    danhSachCot = signal<ColumnDefinition[]>([]);
    dangTai = signal(false);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    tabHienTai: 'columns' | 'preview' | 'info' = 'columns';
    private hot: Handsontable | null = null;
    private formId = '';

    async ngOnInit(): Promise<void> {
        this.formId = this.route.snapshot.paramMap.get('id') || '';
        if (!this.formId) return;
        await this.taiDuLieu();
    }

    ngAfterViewInit(): void {
        // Preview will be initialized on tab switch
    }

    ngOnDestroy(): void {
        this.hot?.destroy();
    }

    // === LOAD ===
    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const [kqBM, kqCot] = await Promise.all([
                this.bieuMauService.layTheoId(this.formId),
                this.bieuMauService.layCauHinhCot(this.formId),
            ]);
            if (kqBM.trangThai && kqBM.duLieu) {
                this.bieuMau.set(kqBM.duLieu);
            }
            if (kqCot.trangThai) {
                this.danhSachCot.set(kqCot.duLieu);
            }
        } catch {
            this.hienThongBao('Không tải được dữ liệu biểu mẫu', 'error');
        }
        this.dangTai.set(false);
    }

    // === PREVIEW ===
    khoiTaoPreview(): void {
        // Wait for the DOM to render the container
        setTimeout(() => this.renderPreview(), 50);
    }

    private renderPreview(): void {
        if (!this.hotContainerRef?.nativeElement) return;

        this.hot?.destroy();

        const cols = this.danhSachCot();
        if (cols.length === 0) return;

        // Build column headers: STT + Tên chỉ tiêu + data columns
        const colHeaders = ['STT', 'Tên chỉ tiêu', ...cols.map(c => c.colName)];

        // Build column definitions for Handsontable
        const hotColumns: Handsontable.ColumnSettings[] = [
            { data: 0, type: 'numeric', readOnly: true, width: 50, className: 'htCenter' },
            { data: 1, type: 'text', readOnly: true, width: 200 },
            ...cols.map((c, i) => ({
                data: i + 2,
                type: c.dataType === 'formula' ? 'numeric' as const : 'numeric' as const,
                readOnly: !c.isEditable,
                width: c.width,
                numericFormat: { pattern: c.format || '#,##0.00' },
                className: c.isEditable ? '' : 'htReadOnly',
            })),
        ];

        // Sample data (3 rows)
        const sampleData = [
            [1, 'Bắc Giang 1', ...cols.map(() => Math.round(Math.random() * 1000) / 10)],
            [2, 'Bắc Kạn 1', ...cols.map(() => Math.round(Math.random() * 1000) / 10)],
            [3, 'Bắc Mê', ...cols.map(() => Math.round(Math.random() * 1000) / 10)],
            [4, 'Bạch Đằng', ...cols.map(() => Math.round(Math.random() * 1000) / 10)],
            [5, 'Bà Thước', ...cols.map(() => Math.round(Math.random() * 1000) / 10)],
        ];

        this.hot = new Handsontable(this.hotContainerRef.nativeElement, {
            data: sampleData,
            colHeaders,
            columns: hotColumns,
            rowHeaders: false,
            fixedColumnsStart: this.bieuMau()?.layoutConfig?.freezeColumns ?? 2,
            height: 400,
            stretchH: 'all',
            readOnly: true,
            licenseKey: 'non-commercial-and-evaluation',
            className: 'htMiddle',
        });
    }

    // === NAVIGATION ===
    quayLai(): void {
        this.router.navigate(['/app/form-designer/templates']);
    }

    // === HELPERS ===
    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3000);
    }
}
