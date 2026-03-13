// ============================================
// Page: Hộp thư phê duyệt (Approval Inbox)
// ============================================
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../services/workflow.service';
import { PheDuyetItem } from '../../../../core/models/workflow.model';

@Component({
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './hop-thu-duyet.component.html',
    styleUrl: './hop-thu-duyet.component.scss',
})
export class HopThuDuyetComponent implements OnInit {
    private workflowService = inject(WorkflowService);

    danhSach = signal<PheDuyetItem[]>([]);
    dangTai = signal(false);
    dangXuLy = signal(false);
    thongBao = signal<{ noiDung: string; loai: 'success' | 'error' } | null>(null);

    // Dialog xác nhận
    hienDialog = signal(false);
    itemDangXuLy = signal<PheDuyetItem | null>(null);
    hanhDongChon: 'duyet' | 'tu_choi' | 'tra_lai' = 'duyet';
    ghiChu = '';

    async ngOnInit(): Promise<void> {
        await this.taiDuLieu();
    }

    async taiDuLieu(): Promise<void> {
        this.dangTai.set(true);
        try {
            const kq = await this.workflowService.layHopThuPheDuyet();
            if (kq.trangThai) this.danhSach.set(kq.duLieu);
        } catch {
            this.hienThongBao('Không tải được danh sách phê duyệt', 'error');
        }
        this.dangTai.set(false);
    }

    moDialog(item: PheDuyetItem, hanhDong: 'duyet' | 'tu_choi' | 'tra_lai'): void {
        this.itemDangXuLy.set(item);
        this.hanhDongChon = hanhDong;
        this.ghiChu = '';
        this.hienDialog.set(true);
    }

    async xacNhan(): Promise<void> {
        const item = this.itemDangXuLy();
        if (!item) return;

        this.dangXuLy.set(true);
        try {
            const kq = await this.workflowService.xuLyPheDuyet({
                hoSoId: item.hoSo.id,
                hanhDong: this.hanhDongChon,
                ghiChu: this.ghiChu.trim() || undefined,
            });
            if (kq.trangThai) {
                this.hienThongBao(kq.thongBao, 'success');
                this.hienDialog.set(false);
                await this.taiDuLieu();
            } else {
                this.hienThongBao(kq.thongBao, 'error');
            }
        } catch {
            this.hienThongBao('Lỗi khi xử lý phê duyệt', 'error');
        }
        this.dangXuLy.set(false);
    }

    tenMucDo(mucDo: string): string {
        const map: Record<string, string> = { cao: 'Cao', trung_binh: 'Trung bình', thap: 'Thấp' };
        return map[mucDo] || mucDo;
    }

    classMucDo(mucDo: string): string {
        const map: Record<string, string> = { cao: 'high', trung_binh: 'medium', thap: 'low' };
        return map[mucDo] || '';
    }

    tenHanhDong(hd: string): string {
        const map: Record<string, string> = { duyet: 'Duyệt', tu_choi: 'Từ chối', tra_lai: 'Trả lại' };
        return map[hd] || hd;
    }

    classHanhDong(hd: string): string {
        const map: Record<string, string> = { duyet: 'approve', tu_choi: 'reject', tra_lai: 'return' };
        return map[hd] || '';
    }

    private hienThongBao(noiDung: string, loai: 'success' | 'error'): void {
        this.thongBao.set({ noiDung, loai });
        setTimeout(() => this.thongBao.set(null), 3000);
    }
}
