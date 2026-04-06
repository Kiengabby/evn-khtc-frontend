// ============================================
// Page: Wizard Táº¡o BÃ¡o CÃ¡o (Report Template Wizard)
// ============================================
// Giao diá»‡n dáº¡ng stepper 5 bÆ°á»›c, giá»‘ng CMIS:
// 1. ThÃ´ng tin chung  2. ÄÆ¡n vá»‹ bÃ¡o cÃ¡o  3. Thiáº¿t káº¿ cá»™t  4. PhÃ¢n quyá»n  5. HoÃ n thÃ nh
//
// === LUá»’NG ===
// Wizard â†’ MockApiService â†’ Táº¡o FormTemplate + phÃ¢n quyá»n
// ============================================

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Handsontable from 'handsontable';
import { MockApiService } from '../../service/_deprecated/mock-api.service';
import { DonVi } from '../../../config/models/don-vi.model';
import {
    BuocWizard, DuLieuWizard, NhomCot, DonViBaoCao, QuyenBaoCao,
    MauBaoCaoCu, taoDuLieuWizardMacDinh, taoDanhSachBuoc,
} from '../models/wizard.model';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './tao-bao-cao-wizard.component.html',
    styleUrl: './tao-bao-cao-wizard.component.scss',
})
export class TaoBaoCaoWizardComponent implements OnInit, OnDestroy {

    private api = inject(MockApiService);
    private router = inject(Router);

    // === State ===
    buocHienTai = signal(1);
    danhSachBuoc = signal<BuocWizard[]>(taoDanhSachBuoc());
    duLieu = signal<DuLieuWizard>(taoDuLieuWizardMacDinh());
    dangTai = signal(false);
    dangLuu = signal(false);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);
    loi = signal<Record<string, string>>({});

    // Dá»¯ liá»‡u phá»¥ trá»£
    danhSachDonViGoc = signal<DonVi[]>([]);
    tuKhoaDonVi = '';

    // BÆ°á»›c 3 â€” Handsontable grid
    danhSachMauCu = signal<MauBaoCaoCu[]>([]);
    mauDaChon = signal<string>('');
    hotInstance: Handsontable | null = null;
    private hotContainerEl: HTMLElement | null = null;
    tenNhomMoi = '';
    dangSuaCot = signal<{ nhomIdx: number; cotIdx: number } | null>(null);

    async ngOnInit(): Promise<void> {
        this.dangTai.set(true);
        const [kq, mauCu] = await Promise.all([
            this.api.layDanhSachDonVi(),
            fetch('assets/mock-data/mau-bao-cao-cu.json').then(r => r.json()).catch(() => ({ mauBaoCaoCu: [] })),
        ]);
        if (kq.trangThai && kq.duLieu) {
            this.danhSachDonViGoc.set(kq.duLieu);
        }
        this.danhSachMauCu.set(mauCu.mauBaoCaoCu || []);
        this.dangTai.set(false);
    }

    ngOnDestroy(): void {
        this.huyGrid();
    }

    private huyGrid(): void {
        if (this.hotInstance) {
            this.hotInstance.destroy();
            this.hotInstance = null;
        }
    }

    // ============================================
    // NAVIGATION
    // ============================================

    tiepTuc(): void {
        if (!this.kiemTraBuoc()) return;

        const buoc = this.buocHienTai();
        if (buoc >= 5) return;

        // Khi rá»i bÆ°á»›c 3: lÆ°u dá»¯ liá»‡u grid vÃ o wizard state
        if (buoc === 3) {
            this.luuGridVaoState();
            // auto táº¡o phÃ¢n quyá»n
            this.autoTaoQuyen();
        }

        // Khi rá»i bÆ°á»›c 3: há»§y grid
        if (buoc === 3) {
            this.huyGrid();
        }

        this.capNhatTrangThaiBuoc(buoc, 'da_hoan_thanh');
        this.capNhatTrangThaiBuoc(buoc + 1, 'dang_dien');
        this.buocHienTai.set(buoc + 1);

        // Khi vÃ o bÆ°á»›c 3: init grid sau khi DOM render
        if (buoc + 1 === 3) {
            this.initGridSauRender();
        }
    }

    quayLai(): void {
        const buoc = this.buocHienTai();
        if (buoc <= 1) return;

        // Khi rá»i bÆ°á»›c 3: lÆ°u + há»§y grid
        if (buoc === 3) {
            this.luuGridVaoState();
            this.huyGrid();
        }

        this.capNhatTrangThaiBuoc(buoc, 'chua_dien');
        this.capNhatTrangThaiBuoc(buoc - 1, 'dang_dien');
        this.buocHienTai.set(buoc - 1);

        // Khi vÃ o bÆ°á»›c 3: init grid sau khi DOM render
        if (buoc - 1 === 3) {
            this.initGridSauRender();
        }
    }

    nhayDenBuoc(soBuoc: number): void {
        const buocCu = this.buocHienTai();
        const buoc = this.danhSachBuoc().find(b => b.soBuoc === soBuoc);
        if (!buoc || buoc.trangThai === 'chua_dien') return;

        // Khi rá»i bÆ°á»›c 3
        if (buocCu === 3 && soBuoc !== 3) {
            this.luuGridVaoState();
            this.huyGrid();
        }

        this.buocHienTai.set(soBuoc);

        // Khi vÃ o bÆ°á»›c 3
        if (soBuoc === 3) {
            this.initGridSauRender();
        }
    }

    /** Init grid after Angular renders the container */
    private initGridSauRender(): void {
        setTimeout(() => {
            const el = document.getElementById('hot-wizard-grid');
            if (el) {
                this.hotContainerEl = el;
                this.khoiTaoGrid(el);
            }
        }, 50);
    }

    private capNhatTrangThaiBuoc(soBuoc: number, trangThai: 'chua_dien' | 'dang_dien' | 'da_hoan_thanh'): void {
        const ds = [...this.danhSachBuoc()];
        const idx = ds.findIndex(b => b.soBuoc === soBuoc);
        if (idx >= 0) {
            ds[idx] = { ...ds[idx], trangThai };
            this.danhSachBuoc.set(ds);
        }
    }

    // ============================================
    // VALIDATION â€” Má»—i bÆ°á»›c
    // ============================================

    kiemTraBuoc(): boolean {
        const d = this.duLieu();
        const loiMoi: Record<string, string> = {};

        switch (this.buocHienTai()) {
            case 1:
                if (!d.tenBaoCao.trim()) loiMoi['tenBaoCao'] = 'Vui lÃ²ng nháº­p tÃªn bÃ¡o cÃ¡o';
                if (!d.maBaoCao.trim()) loiMoi['maBaoCao'] = 'Vui lÃ²ng nháº­p mÃ£ bÃ¡o cÃ¡o';
                break;
            case 2:
                if (d.danhSachDonVi.filter(dv => dv.daChon).length === 0) {
                    loiMoi['donVi'] = 'Chá»n Ã­t nháº¥t 1 Ä‘Æ¡n vá»‹ bÃ¡o cÃ¡o';
                }
                break;
            case 3:
                if (d.danhSachNhomCot.length === 0) {
                    loiMoi['nhomCot'] = 'Táº¡o Ã­t nháº¥t 1 nhÃ³m cá»™t';
                }
                break;
            case 4:
                // PhÃ¢n quyá»n khÃ´ng báº¯t buá»™c
                break;
        }

        this.loi.set(loiMoi);
        return Object.keys(loiMoi).length === 0;
    }

    // ============================================
    // STEP 1: ThÃ´ng tin chung
    // ============================================

    capNhatField(field: string, event: Event): void {
        const val = (event.target as HTMLInputElement).value;
        this.duLieu.update(d => ({ ...d, [field]: val }));
        // Auto gen mÃ£
        if (field === 'tenBaoCao' && !this.duLieu().maBaoCao) {
            const ma = val.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/Ä‘/gi, 'd').replace(/[^a-zA-Z0-9]/g, '_')
                .toUpperCase().substring(0, 30);
            this.duLieu.update(d => ({ ...d, maBaoCao: ma }));
        }
    }

    capNhatKy(event: Event): void {
        const val = (event.target as HTMLSelectElement).value as 'thang' | 'quy' | 'nam';
        this.duLieu.update(d => ({ ...d, kyBaoCao: val }));
    }

    capNhatNam(event: Event): void {
        this.duLieu.update(d => ({ ...d, namBaoCao: +(event.target as HTMLInputElement).value }));
    }

    capNhatThang(event: Event): void {
        this.duLieu.update(d => ({ ...d, thangBaoCao: +(event.target as HTMLSelectElement).value }));
    }

    // ============================================
    // STEP 2: ÄÆ¡n vá»‹ bÃ¡o cÃ¡o
    // ============================================

    get donViDaLoc(): DonVi[] {
        const tk = this.tuKhoaDonVi.toLowerCase();
        if (!tk) return this.danhSachDonViGoc();
        return this.danhSachDonViGoc().filter(dv =>
            dv.maDonVi.toLowerCase().includes(tk) ||
            dv.tenDonVi.toLowerCase().includes(tk)
        );
    }

    donViDaChon(maDv: string): boolean {
        return this.duLieu().danhSachDonVi.some(d => d.maDonVi === maDv && d.daChon);
    }

    toggleDonVi(dv: DonVi): void {
        this.duLieu.update(d => {
            const ds = [...d.danhSachDonVi];
            const idx = ds.findIndex(x => x.maDonVi === dv.maDonVi);
            if (idx >= 0) {
                ds.splice(idx, 1);
            } else {
                ds.push({ maDonVi: dv.maDonVi, tenDonVi: dv.tenDonVi, daChon: true });
            }
            return { ...d, danhSachDonVi: ds };
        });
    }

    chonTatCa(): void {
        const tatCa: DonViBaoCao[] = this.danhSachDonViGoc()
            .filter(dv => dv.capDonVi !== 'TAP_DOAN')
            .map(dv => ({ maDonVi: dv.maDonVi, tenDonVi: dv.tenDonVi, daChon: true }));
        this.duLieu.update(d => ({ ...d, danhSachDonVi: tatCa }));
    }

    boChonTatCa(): void {
        this.duLieu.update(d => ({ ...d, danhSachDonVi: [] }));
    }

    get soDonViDaChon(): number {
        return this.duLieu().danhSachDonVi.filter(d => d.daChon).length;
    }

    // ============================================
    // STEP 3: Thiáº¿t káº¿ báº£ng â€” Handsontable Grid
    // ============================================

    /** Load máº«u cÅ© vÃ o grid */
    chonMauCu(event: Event): void {
        const maTemplate = (event.target as HTMLSelectElement).value;
        this.mauDaChon.set(maTemplate);
        if (!maTemplate) return;

        const mau = this.danhSachMauCu().find(m => m.maTemplate === maTemplate);
        if (!mau) return;

        // Build nestedHeaders + data tá»« template
        const { nestedHeaders, data, colWidths, cotCoDinh, mergeCells } = this.buildGridFromTemplate(mau);

        // LÆ°u vÃ o wizard state
        this.duLieu.update(d => ({
            ...d,
            gridNestedHeaders: nestedHeaders,
            gridData: data,
            gridColWidths: colWidths,
            gridCotCoDinh: cotCoDinh,
            gridMergeCells: mergeCells,
        }));

        // Reload grid
        this.huyGrid();
        this.initGridSauRender();
    }

    /** ThÃªm hÃ ng má»›i vÃ o grid */
    themHangGrid(): void {
        if (!this.hotInstance) return;
        const rowCount = this.hotInstance.countRows();
        this.hotInstance.alter('insert_row_below', rowCount, 1);
    }

    /** ThÃªm cá»™t má»›i vÃ o grid */
    themCotGrid(): void {
        if (!this.hotInstance) return;
        const colCount = this.hotInstance.countCols();
        this.hotInstance.alter('insert_col_end', colCount, 1);
    }

    /** Build Handsontable config from a MauBaoCaoCu */
    private buildGridFromTemplate(mau: MauBaoCaoCu): {
        nestedHeaders: any[][];
        data: any[][];
        colWidths: number[];
        cotCoDinh: number;
        mergeCells: { row: number; col: number; rowspan: number; colspan: number }[];
    } {
        const cauTruc = mau.cauTrucBang;
        const nestedHeaders: any[][] = [];
        const mergeCells: { row: number; col: number; rowspan: number; colspan: number }[] = [];

        // Build nested headers
        for (let ri = 0; ri < cauTruc.headerRows.length; ri++) {
            const row = cauTruc.headerRows[ri];
            const headerRow: any[] = [];
            for (const cell of row) {
                if (typeof cell === 'string') {
                    headerRow.push(cell);
                } else {
                    headerRow.push({ label: cell.label, colspan: cell.colspan });
                }
            }
            nestedHeaders.push(headerRow);
        }

        // Build data rows - resolve formulas with actual row references
        const baseRowOffset = 0; // Handsontable data rows are 0-indexed
        const data: any[][] = cauTruc.dataRows.map((row, rowIdx) => {
            return row.map(cell => {
                if (typeof cell === 'string' && cell.includes('{r}')) {
                    // Replace {r} with actual row+1 (Excel 1-based)
                    return cell.replace(/\{r\}/g, String(rowIdx + 1));
                }
                return cell;
            });
        });

        return {
            nestedHeaders,
            data,
            colWidths: cauTruc.colWidths,
            cotCoDinh: cauTruc.cotCoDinh,
            mergeCells,
        };
    }

    /** Init Handsontable on a container element */
    private khoiTaoGrid(el: HTMLElement): void {
        const d = this.duLieu();
        const data = d.gridData && d.gridData.length > 0
            ? d.gridData
            : this.buildDefaultGridData();

        const nestedHeaders = d.gridNestedHeaders && d.gridNestedHeaders.length > 0
            ? d.gridNestedHeaders
            : this.buildDefaultNestedHeaders();

        const colWidths = d.gridColWidths && d.gridColWidths.length > 0
            ? d.gridColWidths
            : [50, 230, 120, 130, 130, 120, 130, 130];

        const cotCoDinh = d.gridCotCoDinh ?? 2;

        this.hotInstance = new Handsontable(el, {
            data: JSON.parse(JSON.stringify(data)), // deep clone
            nestedHeaders: nestedHeaders,
            colWidths: colWidths,
            rowHeaders: true,
            stretchH: 'none',
            height: 500,
            width: '100%',
            licenseKey: 'non-commercial-and-evaluation',
            manualColumnResize: true,
            manualRowResize: true,
            contextMenu: ['row_above', 'row_below', 'col_left', 'col_right', 'remove_row', 'remove_col', '---------', 'undo', 'redo', '---------', 'copy', 'cut'],
            fixedColumnsStart: cotCoDinh,
            undo: true,
            fillHandle: true,
            autoWrapRow: true,
            autoWrapCol: true,
            className: 'htMiddle',
            mergeCells: d.gridMergeCells && d.gridMergeCells.length > 0 ? d.gridMergeCells : false,
            cells: (row: number, col: number) => {
                const cellProperties: any = {};
                // First 2 columns (STT + Ná»™i dung) are text
                if (col <= 1) {
                    cellProperties.type = 'text';
                }
                // Check if cell value is a formula
                if (data[row] && typeof data[row][col] === 'string' && data[row][col]?.startsWith('=')) {
                    cellProperties.readOnly = true;
                    cellProperties.className = 'hot-formula-cell';
                }
                // Row 0 (Tá»•ng cá»™ng) gets bold styling
                if (row === 0) {
                    cellProperties.className = (cellProperties.className || '') + ' hot-total-row';
                }
                return cellProperties;
            },
        });
    }

    /** Default grid náº¿u chÆ°a chá»n máº«u */
    private buildDefaultGridData(): any[][] {
        const d = this.duLieu();
        const donViChon = d.danhSachDonVi.filter(dv => dv.daChon);
        const thang = d.thangBaoCao || new Date().getMonth() + 1;

        const rows: any[][] = [];
        // HÃ ng tá»•ng cá»™ng
        rows.push(['', 'Tá»•ng cá»™ng', null, null, '=D1/C1', null, null, '=G1/F1']);
        // HÃ ng Ä‘Æ¡n vá»‹
        donViChon.forEach((dv, i) => {
            const r = i + 2; // 1-based row
            rows.push([this.soLaMa(i + 1), dv.tenDonVi, null, null, `=D${r}/C${r}`, null, null, `=G${r}/F${r}`]);
        });
        return rows;
    }

    /** Default nested headers */
    private buildDefaultNestedHeaders(): any[][] {
        const d = this.duLieu();
        const thang = d.thangBaoCao || new Date().getMonth() + 1;
        return [
            ['STT', 'Ná»™i dung', { label: `Thá»±c hiá»‡n ThÃ¡ng ${thang}`, colspan: 3 }, { label: 'LÅ©y káº¿ tá»« Ä‘áº§u nÄƒm', colspan: 3 }],
            ['', '', 'CÃ´ng suáº¥t (MW)', 'Sáº£n lÆ°á»£ng (MWh)', 'Sá»‘ giá» (h)', 'CÃ´ng suáº¥t (MW)', 'Sáº£n lÆ°á»£ng (MWh)', 'Sá»‘ giá» (h)'],
        ];
    }

    private soLaMa(n: number): string {
        const vals = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
        return vals[n - 1] || String(n);
    }

    /** LÆ°u dá»¯ liá»‡u tá»« grid vÃ o wizard state */
    private luuGridVaoState(): void {
        if (!this.hotInstance) return;
        const data = this.hotInstance.getData();
        const colWidths: number[] = [];
        const colCount = this.hotInstance.countCols();
        for (let c = 0; c < colCount; c++) {
            colWidths.push(this.hotInstance.getColWidth(c) || 100);
        }
        this.duLieu.update(d => ({
            ...d,
            gridData: data,
            gridColWidths: colWidths,
        }));

        // CÅ©ng cáº­p nháº­t danhSachNhomCot cho bÆ°á»›c 5 summary
        this.capNhatNhomCotTuGrid();
    }

    /** Parse grid headers thÃ nh NhomCot cho summary */
    private capNhatNhomCotTuGrid(): void {
        const d = this.duLieu();
        const headers = d.gridNestedHeaders;
        if (!headers || headers.length === 0) return;

        const nhomCotMoi: NhomCot[] = [];
        const row0 = headers[0];
        const row1 = headers.length > 1 ? headers[1] : null;

        let colIdx = 0;
        for (const item of row0) {
            if (typeof item === 'string') {
                colIdx++;
                continue;
            }
            // This is a group header
            const nhom: NhomCot = { tenNhom: item.label, danhSachCot: [] };
            const span = item.colspan || 1;
            for (let c = 0; c < span; c++) {
                const colName = row1 ? (typeof row1[colIdx] === 'string' ? row1[colIdx] : '') : `Cá»™t ${c + 1}`;
                nhom.danhSachCot.push({
                    id: `col_${colIdx}`,
                    tenCot: colName,
                    donViTinh: '',
                    loai: 'nhap_lieu',
                    doRong: 100,
                    format: '#,##0.00',
                });
                colIdx++;
            }
            nhomCotMoi.push(nhom);
        }

        this.duLieu.update(dl => ({ ...dl, danhSachNhomCot: nhomCotMoi }));
    }
    get tongSoCot(): number {
        return this.duLieu().danhSachNhomCot.reduce((s, n) => s + n.danhSachCot.length, 0);
    }

    get gridSoHang(): number {
        return this.hotInstance ? this.hotInstance.countRows() : (this.duLieu().gridData?.length || 0);
    }

    get gridSoCot(): number {
        return this.hotInstance ? this.hotInstance.countCols() : (this.duLieu().gridColWidths?.length || 0);
    }

    get soDonViDaGanQuyen(): number {
        return this.duLieu().danhSachQuyen.filter(q => q.nguoiNhapLieu).length;
    }

    // ============================================
    // STEP 4: PhÃ¢n quyá»n
    // ============================================

    private autoTaoQuyen(): void {
        const donViDaChon = this.duLieu().danhSachDonVi.filter(d => d.daChon);
        const quyenHienTai = this.duLieu().danhSachQuyen;

        const quyenMoi: QuyenBaoCao[] = donViDaChon.map(dv => {
            const exist = quyenHienTai.find(q => q.maDonVi === dv.maDonVi);
            return exist || {
                maDonVi: dv.maDonVi,
                tenDonVi: dv.tenDonVi,
                nguoiNhapLieu: '',
                nguoiDuyet: '',
            };
        });
        this.duLieu.update(d => ({ ...d, danhSachQuyen: quyenMoi }));
    }

    capNhatQuyen(idx: number, field: 'nguoiNhapLieu' | 'nguoiDuyet', event: Event): void {
        const val = (event.target as HTMLInputElement).value;
        this.duLieu.update(d => {
            const ds = [...d.danhSachQuyen];
            ds[idx] = { ...ds[idx], [field]: val };
            return { ...d, danhSachQuyen: ds };
        });
    }

    // ============================================
    // STEP 5: HoÃ n thÃ nh â€” Submit
    // ============================================

    get previewCots(): { nhom: string; cot: string; loai: string }[] {
        const result: { nhom: string; cot: string; loai: string }[] = [];
        for (const nhom of this.duLieu().danhSachNhomCot) {
            for (const cot of nhom.danhSachCot) {
                result.push({ nhom: nhom.tenNhom, cot: cot.tenCot, loai: cot.loai === 'cong_thuc' ? `CÃ´ng thá»©c: ${cot.congThuc}` : 'Nháº­p liá»‡u' });
            }
        }
        return result;
    }

    async xuatBan(): Promise<void> {
        this.dangLuu.set(true);
        try {
            const d = this.duLieu();

            // Táº¡o FormTemplate thÃ´ng qua MockApiService
            await this.api.taoBieuMau({
                formId: d.maBaoCao,
                formName: d.tenBaoCao,
                orgList: d.danhSachDonVi.filter(dv => dv.daChon).map(dv => dv.maDonVi),
                isDynamicRow: false,
                layoutConfig: {
                    type: 'table',
                    allowDynamicRows: false,
                    freezeColumns: 1,
                },
            });

            this.hienThongBao(`Táº¡o bÃ¡o cÃ¡o "${d.tenBaoCao}" thÃ nh cÃ´ng!`, 'success');

            // Chuyá»ƒn vá» trang danh sÃ¡ch sau 1.5s
            setTimeout(() => {
                this.router.navigate(['/app/form-designer/templates']);
            }, 1500);
        } catch {
            this.hienThongBao('CÃ³ lá»—i xáº£y ra khi táº¡o bÃ¡o cÃ¡o', 'error');
        } finally {
            this.dangLuu.set(false);
        }
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 4000);
    }
}
