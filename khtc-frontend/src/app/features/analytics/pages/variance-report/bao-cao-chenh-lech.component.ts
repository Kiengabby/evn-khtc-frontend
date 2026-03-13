// ============================================
// Page: Báo cáo so sánh Plan vs Actual
// ============================================
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockApiService } from '../../../../core/services/mock-api.service';
import { DonVi } from '../../../../core/models/don-vi.model';

interface VarianceRow {
    maChiTieu: string;
    tenChiTieu: string;
    cap: number;
    keHoach: number;
    thucHien: number;
    chenhLech: number;
    tyLe: number;
}

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './bao-cao-chenh-lech.component.html',
    styleUrl: './bao-cao-chenh-lech.component.scss',
})
export class BaoCaoChenhLechComponent implements OnInit {
    private api = inject(MockApiService);

    danhSachDonVi = signal<DonVi[]>([]);
    duLieu = signal<VarianceRow[]>([]);
    dangTai = signal(false);

    // Bộ lọc
    donViChon = '';
    namChon = 2026;

    async ngOnInit(): Promise<void> {
        this.dangTai.set(true);
        try {
            const kq = await this.api.layDanhSachDonVi();
            if (kq.trangThai) this.danhSachDonVi.set(kq.duLieu);
            this.taoMockVariance();
        } catch { /* silent */ }
        this.dangTai.set(false);
    }

    locDuLieu(): void {
        this.taoMockVariance();
    }

    /** Tạo dữ liệu mock so sánh Plan vs Actual */
    private taoMockVariance(): void {
        const mockRows: VarianceRow[] = [
            { maChiTieu: 'DT', tenChiTieu: 'Doanh thu bán điện', cap: 0, keHoach: 125430, thucHien: 118920, chenhLech: -6510, tyLe: -5.19 },
            { maChiTieu: 'DT_SH', tenChiTieu: 'Doanh thu sinh hoạt', cap: 1, keHoach: 45000, thucHien: 43200, chenhLech: -1800, tyLe: -4.0 },
            { maChiTieu: 'DT_SX', tenChiTieu: 'Doanh thu sản xuất', cap: 1, keHoach: 52430, thucHien: 49720, chenhLech: -2710, tyLe: -5.17 },
            { maChiTieu: 'DT_KD', tenChiTieu: 'Doanh thu kinh doanh', cap: 1, keHoach: 28000, thucHien: 26000, chenhLech: -2000, tyLe: -7.14 },
            { maChiTieu: 'CP', tenChiTieu: 'Chi phí sản xuất kinh doanh', cap: 0, keHoach: 98750, thucHien: 95400, chenhLech: -3350, tyLe: -3.39 },
            { maChiTieu: 'CP_MUA', tenChiTieu: 'Chi phí mua điện', cap: 1, keHoach: 72000, thucHien: 70100, chenhLech: -1900, tyLe: -2.64 },
            { maChiTieu: 'CP_VH', tenChiTieu: 'Chi phí vận hành', cap: 1, keHoach: 15750, thucHien: 14800, chenhLech: -950, tyLe: -6.03 },
            { maChiTieu: 'CP_KHTSCĐ', tenChiTieu: 'Khấu hao TSCĐ', cap: 1, keHoach: 8500, thucHien: 8200, chenhLech: -300, tyLe: -3.53 },
            { maChiTieu: 'CP_KHAC', tenChiTieu: 'Chi phí khác', cap: 1, keHoach: 2500, thucHien: 2300, chenhLech: -200, tyLe: -8.0 },
            { maChiTieu: 'LN', tenChiTieu: 'Lợi nhuận trước thuế', cap: 0, keHoach: 26680, thucHien: 23520, chenhLech: -3160, tyLe: -11.84 },
            { maChiTieu: 'THUE', tenChiTieu: 'Thuế TNDN', cap: 0, keHoach: 5336, thucHien: 4704, chenhLech: -632, tyLe: -11.84 },
            { maChiTieu: 'LNST', tenChiTieu: 'Lợi nhuận sau thuế', cap: 0, keHoach: 21344, thucHien: 18816, chenhLech: -2528, tyLe: -11.85 },
        ];
        this.duLieu.set(mockRows);
    }

    formatSo(n: number): string {
        return n.toLocaleString('vi-VN');
    }

    classChenhLech(tyLe: number): string {
        if (tyLe > 2) return 'positive';
        if (tyLe < -5) return 'negative';
        return '';
    }
}
