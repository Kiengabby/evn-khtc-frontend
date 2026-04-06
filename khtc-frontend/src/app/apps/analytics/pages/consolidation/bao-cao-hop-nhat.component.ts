// ============================================
// Page: BÃ¡o cÃ¡o há»£p nháº¥t â€” Tá»•ng há»£p sá»‘ liá»‡u Ä‘Æ¡n vá»‹
// ============================================
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockApiService } from '../../../service/_deprecated/mock-api.service';
import { DonVi } from '../../../../config/models/don-vi.model';

interface ConsolidationRow {
    maDonVi: string;
    tenDonVi: string;
    doanhThu: number;
    chiPhi: number;
    loiNhuan: number;
    tongHoSo: number;
    daDuyet: number;
    trangThai: 'hoan_thanh' | 'dang_lam' | 'chua_nop';
}

@Component({
    standalone: true,
    imports: [CommonModule],
    templateUrl: './bao-cao-hop-nhat.component.html',
    styleUrl: './bao-cao-hop-nhat.component.scss',
})
export class BaoCaoHopNhatComponent implements OnInit {
    private api = inject(MockApiService);

    duLieu = signal<ConsolidationRow[]>([]);
    dangTai = signal(false);

    tongDoanhThu = signal(0);
    tongChiPhi = signal(0);
    tongLoiNhuan = signal(0);

    async ngOnInit(): Promise<void> {
        this.dangTai.set(true);
        try {
            const kq = await this.api.layDanhSachDonVi();
            if (kq.trangThai) {
                this.taoMockConsolidation(kq.duLieu);
            }
        } catch { /* silent */ }
        this.dangTai.set(false);
    }

    private taoMockConsolidation(danhSachDV: DonVi[]): void {
        const trangThais: Array<'hoan_thanh' | 'dang_lam' | 'chua_nop'> = ['hoan_thanh', 'dang_lam', 'chua_nop', 'hoan_thanh', 'dang_lam', 'hoan_thanh'];
        const rows: ConsolidationRow[] = danhSachDV.slice(0, 8).map((dv, i) => {
            const dt = Math.round(8000 + Math.random() * 20000);
            const cp = Math.round(dt * (0.7 + Math.random() * 0.15));
            return {
                maDonVi: dv.maDonVi,
                tenDonVi: dv.tenDonVi,
                doanhThu: dt,
                chiPhi: cp,
                loiNhuan: dt - cp,
                tongHoSo: 3,
                daDuyet: trangThais[i % trangThais.length] === 'hoan_thanh' ? 3 : trangThais[i % trangThais.length] === 'dang_lam' ? 1 : 0,
                trangThai: trangThais[i % trangThais.length],
            };
        });

        this.duLieu.set(rows);
        this.tongDoanhThu.set(rows.reduce((s, r) => s + r.doanhThu, 0));
        this.tongChiPhi.set(rows.reduce((s, r) => s + r.chiPhi, 0));
        this.tongLoiNhuan.set(rows.reduce((s, r) => s + r.loiNhuan, 0));
    }

    formatSo(n: number): string {
        return n.toLocaleString('vi-VN');
    }

    tenTrangThai(tt: string): string {
        const map: Record<string, string> = {
            hoan_thanh: 'HoÃ n thÃ nh', dang_lam: 'Äang lÃ m', chua_nop: 'ChÆ°a ná»™p',
        };
        return map[tt] || tt;
    }

    classTrangThai(tt: string): string {
        const map: Record<string, string> = {
            hoan_thanh: 'success', dang_lam: 'warning', chua_nop: 'error',
        };
        return map[tt] || 'info';
    }
}
